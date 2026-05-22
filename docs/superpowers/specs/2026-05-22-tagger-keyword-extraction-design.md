# Tagger Keyword Extraction — Design Spec

**Date:** 2026-05-22  
**Status:** Approved (v2 — extended fields)  
**Files to change:** `scrapers/shared/tagger.py`, `scrapers/shared/models.py`, new Supabase migration

---

## Problem

The current tagger auto-extracts only two fields: `deadline` and `amount_min/max/currency`. Every other field comes from manually hardcoded `DEFAULTS` per scraper, collapsing to low-signal defaults (`"grant"` / `["any"]` / `["Global"]`) when absent. The model also lacks fields that distinguish opportunities in ways founders care about most: does it take equity? Does it require you to already have revenue? What does it give you beyond money?

## Goal

1. **Auto-classify all existing fields** from raw text using keyword/regex — `type`, `stage`, `industry`, `geo`, `women_focused`, `eligibility_summary`
2. **Add 5 new fields** that describe opportunity characteristics not currently captured

Existing scraper `DEFAULTS` always override auto-detection — zero migration needed for existing scrapers.

---

## New Fields (models.py + DB migration)

| Field | Type | Fallback | What it captures |
|---|---|---|---|
| `equity_free` | `bool` | `True` | Non-dilutive? Grants/loans = True; VC/angel/Techstars = False |
| `support_types` | `list[SupportType]` | `["funding"]` | What you actually get: funding, mentorship, network, loan, education, workspace |
| `impact_focus` | `bool` | `False` | Requires social/environmental impact mandate (Cartier, Coralus, Tory Burch) |
| `revenue_required` | `bool \| None` | `None` | Must have existing revenue/ABN (Coralus, many govt grants) |
| `application_cycle` | `ApplicationCycle` | `"ongoing"` | When you can apply: rolling, annual, cohort, ongoing |

### New Literal types for models.py

```python
SupportType = Literal["funding", "mentorship", "network", "loan", "education", "workspace"]
ApplicationCycle = Literal["rolling", "annual", "cohort", "ongoing"]
```

### Updated TaggedFields

```python
class TaggedFields(BaseModel):
    # Existing fields (unchanged)
    type: OpportunityType
    description: str
    eligibility_summary: str | None = None
    stage: list[Stage]
    industry: list[Industry]
    geo: list[Geo]
    amount_min: int | None = None
    amount_max: int | None = None
    currency: str = "AUD"
    deadline: str | None = None

    # Extended existing (now auto-extracted, not just defaulted)
    women_focused: bool = True

    # New fields
    equity_free: bool = True
    support_types: list[SupportType] = ["funding"]
    impact_focus: bool = False
    revenue_required: bool | None = None
    application_cycle: ApplicationCycle = "ongoing"
```

---

## Architecture — tagger.py

No new files. All additions follow the `_parse_date` / `_parse_amounts` pattern: module-level keyword constants + private helper functions.

### Keyword maps

```python
# --- Existing field detection ---

TYPE_KEYWORDS: dict[str, str] = {
    r"\baccelerator\b": "accelerator",
    r"\bfellowship\b": "fellowship",
    r"\bpitch\s+competition\b|\bpitching\s+competition\b": "pitch_competition",
    r"\bfund\b|\bvc\b|\bventure\s+capital\b|\bangel\b": "fund",
    # fallback: "grant"
}

STAGE_KEYWORDS: dict[str, str] = {
    r"\bidea\b|\bideation\b|\bconcept\s+stage\b": "idea",
    r"\bpre.?seed\b|\bpre.revenue\b": "pre_seed",
    r"\bseed\b|\bearly.stage\b|\bstartup\b": "seed",
    r"\bseries\s+a\b": "series_a",
    r"\bgrowth\b|\bscale.?up\b|\bscaling\b": "growth",
}

INDUSTRY_KEYWORDS: dict[str, str] = {
    r"\bfintech\b|\bfinancial\s+tech": "fintech",
    r"\bhealth(?:care|tech)?\b|\bmedtech\b|\bbiotech\b": "health",
    r"\bclimate\b|\bcleantech\b|\bsustainab": "climate",
    r"\bedtech\b|\beducation\s+tech": "edtech",
    r"\bagritech\b|\bagriculture\b|\bfarming\b": "agritech",
    r"\bconsumer\b|\bretail\b|\be.commerce\b": "consumer",
    r"\bdeep.tech\b|\bdeeptech\b|\bai\b|\bmachine\s+learning\b": "deep_tech",
    r"\bsocial\s+enterprise\b|\bsocial\s+impact\b|\bnot.for.profit\b|\bnfp\b": "social",
    r"\btech\b|\btechnology\b|\bsoftware\b|\bsaas\b": "tech",
}

GEO_KEYWORDS: dict[str, str] = {
    r"\baustralia[n]?\b|\bau\b|\banz\b": "AU",
    r"\bnew\s+zealand\b|\bnz\b": "APAC",
    r"\bunited\s+states\b|\busa\b|\bu\.s\.\b|\bamerican\b": "US",
    r"\bunited\s+kingdom\b|\buk\b|\bbritish\b": "UK",
    r"\beurope\b|\beu\b|\beuropean\b": "EU",
    r"\basia.pacific\b|\bapac\b|\bsoutheast\s+asia\b": "APAC",
}

WOMEN_KEYWORDS = r"\bwomen\b|\bfemale\b|\bwoman.owned\b|\bwomen.led\b|\bfemale\s+founder"
WOMEN_NEGATIVE = [
    r"\bnot\s+limited\s+to\s+women\b", r"\bopen\s+to\s+all\b",
    r"\bgender.neutral\b", r"\bgender.inclusive\b",
]

# --- New field detection ---

EQUITY_NEGATIVE = [   # these indicate equity IS taken → equity_free = False
    r"\bequity\b|\bequity\s+stake\b|\bdilut", r"\bshareholders?\b",
    r"\binvestment\s+in\s+exchange\b", r"\btakes?\s+equity\b",
]
EQUITY_POSITIVE = [   # these confirm equity-free
    r"\bnon.dilutive\b", r"\bno\s+equity\b", r"\bgrant\b",
    r"\bzero.interest\s+loan\b", r"\brepayable\s+grant\b",
]

SUPPORT_KEYWORDS: dict[str, str] = {
    r"\bmentor(?:ship|ing)?\b|\bcoach(?:ing)?\b": "mentorship",
    r"\bnetwork(?:ing)?\b|\bcommunity\b|\bconnect(?:ions?)?\b": "network",
    r"\bloan\b|\brepayable\b|\bzero.interest\b": "loan",
    r"\bworkshop\b|\btraining\b|\bcurriculum\b|\beducation\b": "education",
    r"\bworkspace\b|\bcoworking\b|\boffice\s+space\b": "workspace",
}

IMPACT_KEYWORDS = [
    r"\bsocial\s+impact\b|\benvironmental\s+impact\b|\bsdg\b",
    r"\bsustainable\s+development\s+goal", r"\bpositive\s+impact\b",
    r"\bb\s*corp\b|\bbenefit\s+corp", r"\bimpact\s+entrepreneur",
]

REVENUE_REQUIRED_POSITIVE = [
    r"\brevenue.generating\b|\brevenue.positive\b|\btrading\b",
    r"\bestablished\s+business\b|\babn\s+required\b|\bacn\s+required\b",
    r"\bmust\s+have\s+revenue\b|\bexisting\s+customers?\b",
]
REVENUE_REQUIRED_NEGATIVE = [
    r"\bpre.revenue\b|\bno\s+revenue\s+required\b",
    r"\bidea\s+stage\b|\bconcept\s+stage\b|\bpre.launch\b",
]

CYCLE_KEYWORDS: dict[str, str] = {
    r"\brolling\s+applications?\b|\bapply\s+anytime\b|\bopen\s+year.round\b": "rolling",
    r"\bannual\b|\beveryyear\b|\bonce\s+a\s+year\b|\byearly\b": "annual",
    r"\bcohort\b|\bbatch\b|\bintake\b|\bprogram\s+cycle\b": "cohort",
}
```

### Helper functions

**Existing-field helpers** (`_parse_type`, `_parse_stage`, `_parse_industry`, `_parse_geo`, `_parse_women_focused`, `_parse_eligibility`) — same as described in v1.

**New-field helpers:**

`_parse_equity_free(text)` → `bool`  
Check `EQUITY_POSITIVE` first (explicit grant/loan language → True). Then check `EQUITY_NEGATIVE` (equity stake language → False). Default: `True` (assume grant unless equity signals found).

`_parse_support_types(text)` → `list[SupportType]`  
Always include `"funding"` (every opportunity funds something). Then iterate `SUPPORT_KEYWORDS`, collect all matches. Return deduplicated list.

`_parse_impact_focus(text)` → `bool`  
Return `True` if any `IMPACT_KEYWORDS` match. Default: `False`.

`_parse_revenue_required(text)` → `bool | None`  
Return `True` if any `REVENUE_REQUIRED_POSITIVE` match. Return `False` if any `REVENUE_REQUIRED_NEGATIVE` match. Return `None` if neither (unknown).

`_parse_application_cycle(text)` → `ApplicationCycle`  
Iterate `CYCLE_KEYWORDS`; return first match. Default: `"ongoing"`.

---

## Integration into `tag_opportunity`

```python
def tag_opportunity(raw_text, name, defaults=None):
    defaults = defaults or {}

    # Existing extraction (unchanged)
    deadline = defaults.get("deadline") or _parse_date(raw_text)
    amount_min, amount_max, currency = _parse_amounts(raw_text)
    if "amount_min" in defaults: amount_min = defaults["amount_min"]
    if "amount_max" in defaults: amount_max = defaults["amount_max"]
    if "currency"   in defaults: currency   = defaults["currency"]

    # Auto-classify existing semantic fields
    opp_type    = defaults.get("type")               or _parse_type(raw_text)
    stage       = defaults.get("stage")              or _parse_stage(raw_text)
    industry    = defaults.get("industry")           or _parse_industry(raw_text)
    geo         = defaults.get("geo")                or _parse_geo(raw_text)
    women       = defaults.get("women_focused",         _parse_women_focused(raw_text))
    eligibility = defaults.get("eligibility_summary") or _parse_eligibility(raw_text)
    description = defaults.get("description")        or f"Funding opportunity: {name}"

    # New fields
    equity_free   = defaults.get("equity_free",        _parse_equity_free(raw_text))
    support_types = defaults.get("support_types")    or _parse_support_types(raw_text)
    impact_focus  = defaults.get("impact_focus",       _parse_impact_focus(raw_text))
    rev_required  = defaults.get("revenue_required",   _parse_revenue_required(raw_text))
    cycle         = defaults.get("application_cycle") or _parse_application_cycle(raw_text)

    return TaggedFields(
        type=opp_type, description=description, eligibility_summary=eligibility,
        stage=stage, industry=industry, geo=geo,
        amount_min=amount_min, amount_max=amount_max, currency=currency,
        deadline=deadline, women_focused=women,
        equity_free=equity_free, support_types=support_types,
        impact_focus=impact_focus, revenue_required=rev_required,
        application_cycle=cycle,
    )
```

---

## Database migration required

New columns on the `opportunities` table:

```sql
ALTER TABLE opportunities
  ADD COLUMN equity_free        boolean NOT NULL DEFAULT true,
  ADD COLUMN support_types      text[]  NOT NULL DEFAULT '{funding}',
  ADD COLUMN impact_focus       boolean NOT NULL DEFAULT false,
  ADD COLUMN revenue_required   boolean,          -- nullable
  ADD COLUMN application_cycle  text    NOT NULL DEFAULT 'ongoing';
```

---

## What doesn't change

- Existing scraper `DEFAULTS` — all still respected, no migrations needed
- `_parse_date` and `_parse_amounts` — untouched
- Pydantic validators on description/eligibility length — untouched

---

## Testing (golden fixtures)

1. Accelerator text with "equity stake", "cohort", "mentoring", "Australian fintech pre-seed" → `equity_free=False`, `type="accelerator"`, `application_cycle="cohort"`, `support_types=["funding","mentorship"]`, `industry=["fintech","tech"]`, `stage=["pre_seed"]`, `geo=["AU"]`
2. Grant text with "social impact", "women-led", "zero-interest loan", "rolling applications" → `equity_free=True`, `impact_focus=True`, `women_focused=True`, `support_types=["funding","loan"]`, `application_cycle="rolling"`
3. Plain text with no classifiable signals → all fields fall back to their defaults

---

## Out of scope

- LLM-based extraction
- Per-scraper DEFAULTS migration
- Frontend filter UI changes (separate issue)
