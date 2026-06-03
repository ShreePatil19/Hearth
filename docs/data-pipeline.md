# Data Pipeline (Scrapers)

A Python pipeline of 10 source scrapers plus a shared layer (`scrapers/shared/`), orchestrated by `scrapers/run_all.py`, that upserts grants/accelerators/competitions/funds into the Supabase `opportunities` table once a day via GitHub Actions to power the public Funding Radar.

> See also: [architecture.md](architecture.md) · [setup.md](setup.md) · [database.md](database.md) · [deployment.md](deployment.md) · [contributing.md](contributing.md) · root [CLAUDE.md](../CLAUDE.md). The target table schema (`opportunities`) is documented in [database.md](database.md).

---

## 1. Overview

| Piece | Location | Role |
|---|---|---|
| Orchestrator | `scrapers/run_all.py` | Imports each source module, calls its `run()`, aggregates results, then runs an "expire" pass over stale rows. |
| Source scrapers (10) | `scrapers/*.py` | One module per funding source. Each exposes `scrape()` → list of dicts and `run()` → count. |
| Shared layer | `scrapers/shared/` | `config.py`, `db.py`, `slug.py`, `models.py`, `tagger.py`, `http.py`. |
| Tests | `scrapers/tests/` | `pytest` suite for the tagger/model and HTTP helpers. |
| Daily job | `.github/workflows/refresh.yml` | Cron `0 18 * * *` (6pm UTC = 4am AEST) runs `python run_all.py`. |
| Target | Supabase `opportunities` table | Written via the PostgREST REST API using the service-role key. |

Data flow:

```
source website / API
  └─ <source>.scrape()        # fetch + parse → list[{name, organisation, source_url, application_url, raw_text, defaults?}]
       └─ <source>.run()      # loop, call upsert_opportunity(...)
            └─ shared.db.upsert_opportunity()
                 ├─ shared.slug.generate_slug()   # dedup key
                 ├─ content_hash check            # skip if unchanged
                 ├─ shared.tagger.tag_opportunity()# regex → TaggedFields
                 └─ POST /opportunities (on_conflict=slug, merge-duplicates)
run_all.expire_stale_opportunities()  # PATCH rows past deadline / stale → is_active=false
```

> Note: unverified — the exact column set of the `opportunities` table is not defined inside `scrapers/`; see [database.md](database.md). The fields written are the keys assembled in `scrapers/shared/db.py` plus the `TaggedFields` model (`scrapers/shared/models.py`).

---

## 2. Orchestration (`scrapers/run_all.py`)

`run_all.py` does **not** auto-discover scrapers. Each module is imported explicitly at the top of the file and registered in a hard-coded `SCRAPERS` list of `(display_name, module)` tuples (`scrapers/run_all.py`). To add or remove a source you edit this list.

`main()`:

1. Iterates `SCRAPERS`. For each, calls `module.run()` inside a `try/except`.
   - Success → records `(name, count)` and prints `OK: <count> opportunities`.
   - Exception → records `(name, None)`, appends to `failures`, prints `FAIL: <e>`. **One scraper failing never aborts the others.**
2. Prints a summary table and the total count of upserted opportunities.
3. Runs an **expire pass** (`expire_stale_opportunities()`), wrapped in its own `try/except` so an expire failure only logs a `WARN` and does not fail the run.
4. If any scraper failed, calls `sys.exit(1)` at the end (so the GitHub Actions job is marked failed), but only after every scraper and the expire pass have run.

### Expire pass

`expire_stale_opportunities()` uses the shared client (`get_client()`) to issue two PostgREST `PATCH /opportunities` calls and returns `(expired_by_deadline, expired_by_staleness)`:

| Rule | Filter | Action |
|---|---|---|
| Past deadline | `deadline=lt.<today>` AND `is_active=eq.true` | set `is_active=false` |
| Stale rolling | `deadline=is.null` AND `last_checked_at=lt.<now − 180d>` AND `is_active=eq.true` | set `is_active=false` |

`STALENESS_GRACE_DAYS = 180` (`scrapers/run_all.py`). Counts are derived from the length of the JSON response (which relies on the `Prefer: return=representation` header set on the shared client).

---

## 3. The shared layer (`scrapers/shared/`)

`scrapers/shared/__init__.py` is empty (the package is namespaced; modules are imported as `shared.<name>`).

### `config.py` — env + HTTP client to Supabase

- Loads `.env.local` from the **repo root** (`Path(__file__).resolve().parent.parent.parent / ".env.local"`) via `python-dotenv`; a no-op in CI where vars come from the environment.
- Requires two env vars (by name): `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Both are read with `os.environ[...]`, so a missing value raises `KeyError` immediately.
- `get_client()` returns a lazily-created, module-level singleton `httpx.Client` pointed at `<SUPABASE_URL>/rest/v1`, with the **service-role key** in both the `apikey` and `Authorization: Bearer` headers, `Content-Type: application/json`, `Prefer: return=representation`, and a 15s timeout.

> The service-role key bypasses Row-Level Security — this is why writes must go through this server-side pipeline and never the browser. See [auth-and-access.md](auth-and-access.md).

### `db.py` — upsert logic

`upsert_opportunity(name, organisation, source_url, application_url, raw_text, defaults=None)` (`scrapers/shared/db.py`):

1. Computes `slug = generate_slug(name, organisation)` and `content_hash = md5(raw_text)` (`compute_hash`).
2. `GET /opportunities?slug=eq.<slug>&select=content_hash`. If a row exists with the **same `content_hash`**, it only PATCHes `last_checked_at` and returns early (`[skip] … unchanged`) — no re-tagging, no rewrite.
3. Otherwise calls `tag_opportunity(raw_text, name, defaults=defaults)`. If tagging returns `None`, logs `[fail]` and returns `None`.
4. Builds the row dict from the passed fields + `slug`, `content_hash`, `last_checked_at`, `is_active=True`, and `**tagged.model_dump()`. A non-null `deadline` is coerced to `str`.
5. **Upsert** via `POST /opportunities?on_conflict=slug` with header `Prefer: return=representation,resolution=merge-duplicates`. On HTTP 200/201 returns the row; otherwise logs `[error] … HTTP <status>` and returns `None`.

> Security note (in-code, `scrapers/shared/db.py`): error responses are **not** logged verbatim because PostgREST error bodies can echo the request's `Authorization` header and leak the service-role key into CI logs (ref #94).

### `slug.py` — slug / dedup strategy

`generate_slug(name, organisation=None)` (`scrapers/shared/slug.py`): builds `"<name>-<organisation>"` (or just `name`), NFKD-normalises to ASCII, lowercases, replaces any run of non-`[a-z0-9]` with `-`, strips leading/trailing `-`, and truncates to **120 chars**. The slug is the **conflict key** for upserts, so it is the de-duplication identity: the same `(name, organisation)` always maps to the same row.

### `models.py` — the opportunity data model

`TaggedFields` is a Pydantic v2 `BaseModel` (`scrapers/shared/models.py`). These are the tagged/classified fields merged into every upserted row:

| Field | Type | Default | Notes |
|---|---|---|---|
| `type` | `OpportunityType` | — | `grant` \| `accelerator` \| `pitch_competition` \| `fund` \| `fellowship` \| `other` |
| `description` | `str` | — | validator truncates to 500 chars |
| `eligibility_summary` | `str \| None` | `None` | validator truncates to 500 chars |
| `stage` | `list[Stage]` | — | `idea`/`pre_seed`/`seed`/`series_a`/`growth`/`any`; must be non-empty |
| `industry` | `list[Industry]` | — | `tech`/`health`/`climate`/`fintech`/`edtech`/`agritech`/`consumer`/`deep_tech`/`social`/`any`; non-empty |
| `geo` | `list[Geo]` | — | `AU`/`US`/`UK`/`EU`/`Global`/`APAC`; non-empty |
| `amount_min` | `int \| None` | `None` | |
| `amount_max` | `int \| None` | `None` | |
| `currency` | `str` | `"AUD"` | |
| `deadline` | `str \| None` | `None` | ISO `YYYY-MM-DD` |
| `women_focused` | `bool` | `True` | |
| `equity_free` | `bool` | `True` | |
| `support_types` | `list[SupportType]` | `["funding"]` | `funding`/`mentorship`/`network`/`loan`/`education`/`workspace`; non-empty |
| `impact_focus` | `bool` | `False` | |
| `revenue_required` | `bool \| None` | `None` | |
| `application_cycle` | `ApplicationCycle` | `"ongoing"` | `rolling`/`annual`/`cohort`/`ongoing` |

Validators: `description`/`eligibility_summary` are capped at 500 chars; `stage`, `industry`, `geo`, `support_types` must each contain at least one value (raises `ValueError` otherwise, which surfaces as a tagging failure).

### `tagger.py` — classification

> **Important discrepancy:** `scrapers/shared/tagger.py` is a **rule-based tagger** ("Rule-based tagger — no LLM needed", line 1). It uses regex + keyword maps + source-supplied `defaults` only. **It does NOT call the Anthropic API**, and `ANTHROPIC_API_KEY` is not read anywhere under `scrapers/` (confirmed: zero matches for `anthropic`/`ANTHROPIC`). The repo's `CLAUDE.md` and the daily workflow still reference Anthropic tagging / pass `ANTHROPIC_API_KEY` — that env var is currently unused by this pipeline. See "Daily refresh" below.

`tag_opportunity(raw_text, name, defaults=None) -> TaggedFields | None` (`scrapers/shared/tagger.py`):

- For each field it prefers a value from `defaults`, else derives one from `raw_text`. Booleans use `defaults.get(key, _parse_...(text))` so an explicit `False` default still wins.
- Helpers (all regex/keyword based): `_parse_date` (extracts the earliest deadline **today-or-later**, compared in **UTC**; AU `%d/%m/%Y` supported, ambiguous US `%m/%d/%Y` intentionally omitted — ref #95/#93), `_parse_amounts` (currency + min/max from `$`/AUD/USD/etc.), `_parse_type`, `_parse_stage`, `_parse_industry`, `_parse_geo`, `_parse_women_focused`, `_parse_eligibility`, `_parse_equity_free`, `_parse_support_types`, `_parse_impact_focus`, `_parse_revenue_required`, `_parse_application_cycle`.
- Fallbacks when nothing matches: `type→grant`, `stage/industry→[any]`, `geo→[Global]`, `women_focused→True` (unless an explicit negative phrase), `support_types→[funding]`, `application_cycle→ongoing`, `description→f"Funding opportunity: {name}"`.
- Returns `None` (logging a validation error) if `TaggedFields(...)` construction fails.

> Note: the `GEO_KEYWORDS` "US" pattern is intentionally case-sensitive (`(?-i:US)`) so the pronoun "us" does not false-match (ref #90).

### `http.py` — resilient sessions

`make_session(total=3, backoff_factor=1.0)` (`scrapers/shared/http.py`) returns a `requests.Session` with a `Retry`/`HTTPAdapter` mounted for both schemes: retries with exponential backoff on `429, 500, 502, 503, 504`, `raise_on_status=False`. Used by the `requests`/BeautifulSoup scrapers so a single timeout/rate-limit does not drop a whole source for the day (ref #91).

---

## 4. The 10 sources

Registered in `SCRAPERS` (`scrapers/run_all.py`):

| Module (`scrapers/<file>.py`) | Source name |
|---|---|
| `amber_grant.py` | Amber Grant |
| `cartier.py` | Cartier Women's Initiative |
| `scale_investors.py` | Scale Investors |
| `business_gov_au.py` | business.gov.au |
| `ifundwomen.py` | IFundWomen |
| `tory_burch.py` | Tory Burch Foundation |
| `heads_over_heels.py` | Heads Over Heels |
| `sbe_australia.py` | SBE Australia |
| `techstars.py` | Techstars |
| `sheeo_coralus.py` | Coralus/SheEO |

### Common scraper shape / contract

Verified against `amber_grant.py`, `business_gov_au.py`, and `techstars.py`. Every source module must expose:

- **`scrape() -> list[dict]`** — fetch + parse and return one dict per opportunity with keys: `name`, `organisation`, `source_url`, `application_url`, `raw_text`, and (optionally) `defaults`. Network/parse errors are caught per-URL and logged so a single bad page doesn't kill the source.
- **`run() -> int`** — call `scrape()`, loop the results into `upsert_opportunity(...)`, increment a counter for each non-`None` result, and return the count. This is what `run_all.py` invokes.
- An `if __name__ == "__main__":` block that calls `run()` so the scraper can be run standalone.

Two fetch styles are in use:

| Style | Example | How it works |
|---|---|---|
| HTML scrape | `amber_grant.py`, `techstars.py` | `make_session()` + a `HearthBot/1.0` `User-Agent`, `BeautifulSoup(resp.text, "html.parser")`, extract text from `main`/`article`/`body`, `time.sleep(3)` between pages. Static per-source `DEFAULTS`/`PROGRAMS`. |
| JSON / API | `business_gov_au.py` | Hits the site's Coveo search API directly (the listing page is JS-rendered), builds `raw_text` from response fields, derives `deadline`/amounts/geo, and passes a per-item `defaults`. Uses `httpx.Client(transport=httpx.HTTPTransport(retries=3))`. |

> Note: the remaining seven modules (`cartier`, `scale_investors`, `ifundwomen`, `tory_burch`, `heads_over_heels`, `sbe_australia`, `sheeo_coralus`) were not read line-by-line for this doc; they are assumed to follow the same `scrape()`/`run()` contract because `run_all.py` calls `module.run()` uniformly. Unverified — confirm before relying on per-source details.

---

## 5. How to add a new scraper

1. **Create** `scrapers/<source>.py`.
2. **Pick a fetch style:** for HTML use `from shared.http import make_session` (+ a `HearthBot/1.0` `User-Agent` and a polite `time.sleep`); for an API, prefer `httpx` with retries like `business_gov_au.py`.
3. **Implement `scrape() -> list[dict]`** returning dicts with `name`, `organisation`, `source_url`, `application_url`, `raw_text`, and an optional `defaults`. Catch and log per-URL errors instead of raising.
4. **Set `defaults`** for anything the regex tagger can't reliably infer (e.g. `type`, `geo`, `currency`, `amount_min/max`, `women_focused`, `equity_free`, `application_cycle`). Keys must match `TaggedFields` fields (`scrapers/shared/models.py`); list fields must be non-empty. An explicit boolean `False`/`True` default overrides auto-detection.
5. **Implement `run() -> int`**: loop `scrape()` results into `upsert_opportunity(...)`, count non-`None` returns, return the count. Add the `if __name__ == "__main__":` runner.
6. **Register it** in `run_all.py`: add `import <source>` and an entry `("<Display Name>", <source>)` to the `SCRAPERS` list. (Discovery is manual — this step is required or the scraper won't run.)
7. **Verify the slug** is stable for your `(name, organisation)` — it is the upsert conflict key (`scrapers/shared/slug.py`).
8. **Run locally** from `scrapers/`: `python <source>.py` (needs `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), or the whole pipeline with `python run_all.py`.
9. **Run the tests:** `python -m pytest scrapers/tests -q` (these cover the shared tagger/model, not your fetch logic).

---

## 6. The daily refresh

Defined in `.github/workflows/refresh.yml` (job `scrape`):

| Setting | Value |
|---|---|
| Trigger | `schedule: cron "0 18 * * *"` (6pm UTC = 4am AEST) + manual `workflow_dispatch` |
| Runner | `ubuntu-latest`, `timeout-minutes: 10` |
| Python | `3.12` (with pip cache keyed on `scrapers/requirements.txt`) |
| Env (secret-backed) | `NEXT_PUBLIC_SUPABASE_URL` ← `secrets.SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY`; `ANTHROPIC_API_KEY` |
| Command | `python run_all.py` with `working-directory: scrapers` |

> Discrepancy: the workflow exports `ANTHROPIC_API_KEY`, but no code under `scrapers/` reads it (the tagger is rule-based). It is effectively a no-op for the current pipeline and can be removed when the tagger is confirmed to never need an LLM.

### How it differs from the CI scrapers test job

`.github/workflows/ci.yml` contains a separate `scrapers` job (alongside the Node `build` job):

| | CI `scrapers` (`ci.yml`) | Daily `scrape` (`refresh.yml`) |
|---|---|---|
| Trigger | push / PR to `main` | cron `0 18 * * *` + manual dispatch |
| Python | `3.11` | `3.12` |
| Secrets / env | none | Supabase URL + service-role key (+ `ANTHROPIC_API_KEY`) |
| Command | `python -m pytest scrapers/tests -q` | `python run_all.py` |
| Touches the DB? | No (unit tests only) | Yes (real upserts + expire pass) |
| Timeout | 5 min | 10 min |

In short: CI **validates the tagger/model logic** on every change with no network/DB access; the daily job **actually scrapes and writes** to Supabase.

---

## 7. Tests

`scrapers/tests/test_tagger.py` is a `pytest` suite covering `scrapers/shared/tagger.py` and `scrapers/shared/models.py`:

- **Model:** `TaggedFields` accepts the newer fields (`equity_free`, `support_types`, `impact_focus`, `revenue_required`, `application_cycle`) and applies their defaults.
- **Per-helper unit tests:** `_parse_type` (accelerator/fellowship/fund/default-grant), `_parse_stage` (multi + `[any]` fallback), `_parse_industry` (multi + fallback), `_parse_geo` (single/multi/`[Global]` fallback), `_parse_women_focused` (positive / negative phrase / default-true), `_parse_eligibility` (finds an eligibility sentence / `None` when absent), `_parse_equity_free`, `_parse_support_types` (always includes `funding`; multi-keyword), `_parse_impact_focus` (impact/SDG/false), `_parse_revenue_required` (true/false/none), `_parse_application_cycle` (rolling/cohort/annual/default-ongoing).
- **Golden / integration tests** over `tag_opportunity()`: an equity-taking accelerator, an impact zero-interest loan, a no-signal input that falls back to defaults, and a case proving **`defaults` override auto-detection**.

> Note: the broader suite (`scrapers/tests/`) also includes `test_http.py`, `test_imports.py`, and `test_tagger_hardening.py`, run by the same `pytest scrapers/tests -q` command; only `test_tagger.py` is detailed here per scope.
