# Tagger Keyword Extraction — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**File to change:** `scrapers/shared/tagger.py`

---

## Problem

The current tagger auto-extracts only two fields from raw text: `deadline` (regex date) and `amount_min/max/currency` (regex money). Every other `TaggedFields` field — `type`, `stage`, `industry`, `geo`, `women_focused`, `eligibility_summary` — comes from manually hardcoded `DEFAULTS` in each scraper. When no default is provided, everything collapses to `"grant"` / `["any"]` / `["Global"]` / `True`, which is low-signal.

## Goal

Make `tag_opportunity` attempt to classify all fields from raw text using keyword/regex matching, so:
- Adding a new scraper requires minimal `DEFAULTS` (only curator overrides, not mandatory classifications)
- Existing scrapers with explicit `DEFAULTS` are unaffected (defaults still take priority)

---

## Architecture

No new files. All additions go into `scrapers/shared/tagger.py` as private helper functions following the existing `_parse_date` / `_parse_amounts` pattern.

### New helpers

| Function | Returns | Fallback |
|---|---|---|
| `_parse_type(text)` | `OpportunityType` | `"grant"` |
| `_parse_stage(text)` | `list[Stage]` | `["any"]` |
| `_parse_industry(text)` | `list[Industry]` | `["any"]` |
| `_parse_geo(text)` | `list[Geo]` | `["Global"]` |
| `_parse_women_focused(text)` | `bool` | `True` |
| `_parse_eligibility(text)` | `str \| None` | `None` |

### Keyword maps (one dict per field)

Each map is a module-level constant (same style as `DATE_PATTERNS`, `MONEY_PATTERNS`):

```python
TYPE_KEYWORDS: dict[str, str] = {
    r"\baccelerator\b": "accelerator",
    r"\bfellowship\b": "fellowship",
    r"\bpitch\s+competition\b": "pitch_competition",
    r"\bfund\b|\bvc\b|\bventure\b": "fund",
    # "grant" is the fallback — no pattern needed
}

STAGE_KEYWORDS: dict[str, str] = {
    r"\bidea\b|\bideation\b|\bconcept\b": "idea",
    r"\bpre.?seed\b|\bpre-revenue\b": "pre_seed",
    r"\bseed\b|\bearly.stage\b|\bstartup\b": "seed",
    r"\bseries\s+a\b": "series_a",
    r"\bgrowth\b|\bscale.?up\b|\bscaling\b": "growth",
}

INDUSTRY_KEYWORDS: dict[str, str] = {
    r"\bfintech\b|\bfinancial\s+tech": "fintech",
    r"\bhealth\b|\bhealthcare\b|\bmedtech\b|\bbiotech\b": "health",
    r"\bclimate\b|\bcleantech\b|\bsustainab": "climate",
    r"\bedtech\b|\beducation\s+tech": "edtech",
    r"\bagritech\b|\bagriculture\b|\bfarming\b": "agritech",
    r"\bconsumer\b|\bretail\b|\be.commerce\b": "consumer",
    r"\bdeep.tech\b|\bdeeptech\b|\bai\b|\bmachine\s+learning\b": "deep_tech",
    r"\bsocial\s+enterprise\b|\bsocial\s+impact\b|\bnot.for.profit\b|\bnfp\b": "social",
    r"\btech\b|\btechnology\b|\bsoftware\b|\bsaas\b": "tech",
}

GEO_KEYWORDS: dict[str, str] = {
    r"\baustralia\b|\baustralia[n]?\b|\bau\b|\banz\b": "AU",
    r"\bnew\s+zealand\b|\bnz\b": "APAC",
    r"\bunited\s+states\b|\busa\b|\bu\.s\.\b|\bamerican\b": "US",
    r"\bunited\s+kingdom\b|\buk\b|\bbritish\b": "UK",
    r"\beurope\b|\beu\b|\beuropean\b": "EU",
    r"\basia.pacific\b|\bapac\b|\bsoutheast\s+asia\b": "APAC",
}

WOMEN_NEGATIVE: list[str] = [
    r"\bnot\s+limited\s+to\s+women\b",
    r"\bopen\s+to\s+all\b",
    r"\bgender.neutral\b",
    r"\bgender.inclusive\b",
]
```

> **Note on geo:** `Geo` literals are `AU | US | UK | EU | Global | APAC`. New Zealand doesn't map cleanly; `"AU"` is the closest cluster. If NZ-specific entries become common, add `"NZ"` to `models.py`.

### `_parse_type`

Iterate `TYPE_KEYWORDS`; return first match. Default: `"grant"`.

### `_parse_stage` / `_parse_industry` / `_parse_geo`

Iterate keyword map; collect all matches into a list (multi-label). If list is empty, return fallback. Deduplication via `dict.fromkeys`.

### `_parse_women_focused`

Return `False` if any `WOMEN_NEGATIVE` pattern matches. Otherwise return `True` if any positive women keyword (`r"\bwomen\b|\bfemale\b|\bwoman.owned\b|\bwomen.led\b"`) matches. Default: `True`.

### `_parse_eligibility`

Split text into sentences (split on `.` / `!` / `?` + newlines). Return the first sentence (up to 500 chars) that contains any of: `eligible`, `eligibility`, `open to`, `must be`, `requirements`, `who can apply`, `applicant`. Return `None` if none found. Truncation is handled by the existing `TaggedFields` validator.

---

## Integration into `tag_opportunity`

```python
def tag_opportunity(raw_text, name, defaults=None):
    defaults = defaults or {}

    deadline   = defaults.get("deadline")   or _parse_date(raw_text)
    amount_min, amount_max, currency = _parse_amounts(raw_text)
    if "amount_min"  in defaults: amount_min  = defaults["amount_min"]
    if "amount_max"  in defaults: amount_max  = defaults["amount_max"]
    if "currency"    in defaults: currency    = defaults["currency"]

    # New: auto-classify all semantic fields; defaults override
    opp_type   = defaults.get("type")        or _parse_type(raw_text)
    stage      = defaults.get("stage")       or _parse_stage(raw_text)
    industry   = defaults.get("industry")    or _parse_industry(raw_text)
    geo        = defaults.get("geo")         or _parse_geo(raw_text)
    women      = defaults.get("women_focused", _parse_women_focused(raw_text))
    eligibility = defaults.get("eligibility_summary") or _parse_eligibility(raw_text)
    description = defaults.get("description") or f"Funding opportunity: {name}"
    ...
```

Explicit `defaults` keys always win. Auto-detected values fill in when the key is absent.

---

## What doesn't change

- `TaggedFields` model — no changes to `models.py`
- All existing scraper `DEFAULTS` — still respected, no migrations needed
- `_parse_date` and `_parse_amounts` — untouched

---

## Testing

Covered by the separate test-infrastructure issue (#27). Minimum golden fixtures for this feature:
1. Grant text with "pre-seed Australian fintech" keywords → `stage=["pre_seed"]`, `industry=["tech","fintech"]`, `geo=["AU"]`
2. Text with "accelerator for women-led startups" → `type="accelerator"`, `women_focused=True`
3. Text with no classifiable content → all fields fall back to defaults

---

## Out of scope

- LLM-based extraction
- Changes to `models.py` literals
- Per-scraper DEFAULTS migration
