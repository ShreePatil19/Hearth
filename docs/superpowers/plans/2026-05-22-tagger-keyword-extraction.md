# Tagger Keyword Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the rule-based tagger to auto-classify all opportunity fields from raw text using keyword/regex matching, and add 5 new fields (`equity_free`, `support_types`, `impact_focus`, `revenue_required`, `application_cycle`) to the model and database.

**Architecture:** All keyword maps live as module-level constants in `tagger.py`. Each field has a dedicated private helper (`_parse_*`) that reads those constants. `tag_opportunity` calls every helper; explicit scraper `DEFAULTS` always win over auto-detected values. `models.py` adds 2 new Literal types and 5 new Pydantic fields. A single SQL migration adds the 5 columns to `opportunities`.

**Tech Stack:** Python 3.11, Pydantic v2, pytest, PostgreSQL (Supabase). All detection is pure regex — no network, no LLM.

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Modify | `scrapers/shared/models.py` | Add `SupportType`, `ApplicationCycle` Literals + 5 new `TaggedFields` |
| Modify | `scrapers/shared/tagger.py` | Add 11 keyword maps + 11 helper functions + update `tag_opportunity` |
| Create | `scrapers/pytest.ini` | Tell pytest where to find tests + set rootdir |
| Create | `scrapers/tests/__init__.py` | Empty — makes `tests/` a package |
| Create | `scrapers/tests/test_tagger.py` | All pytest tests |
| Modify | `scrapers/requirements.txt` | Add `pytest>=8.0` |
| Create | `supabase/migrations/004_tagger_extended_fields.sql` | 5 new columns on `opportunities` |

---

## Task 1: Test infrastructure setup

**Files:**
- Modify: `scrapers/requirements.txt`
- Create: `scrapers/pytest.ini`
- Create: `scrapers/tests/__init__.py`
- Create: `scrapers/tests/test_tagger.py`

- [ ] **Step 1: Add pytest to requirements**

In `scrapers/requirements.txt`, add after the last line:
```
pytest>=8.0
```

Full file after edit:
```
requests>=2.31.0
beautifulsoup4>=4.12.0
httpx>=0.27.0
python-dotenv>=1.0.0
pydantic>=2.0.0
pytest>=8.0
```

- [ ] **Step 2: Create pytest.ini**

Create `scrapers/pytest.ini`:
```ini
[pytest]
testpaths = tests
pythonpath = .
```

- [ ] **Step 3: Install pytest into venv**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pip.exe install pytest>=8.0
```

Expected output ends with: `Successfully installed pytest-...`

- [ ] **Step 4: Create tests package**

Create `scrapers/tests/__init__.py` — empty file.

- [ ] **Step 5: Create test file with imports only**

Create `scrapers/tests/test_tagger.py`:
```python
from shared.models import TaggedFields
```

Each test function will do its own local import (e.g. `from shared.tagger import _parse_type`). This avoids import failures when helpers don't exist yet.

- [ ] **Step 6: Verify import works**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py --collect-only
```

Expected: `no tests ran` (no errors — just no tests yet).

- [ ] **Step 7: Commit**

```powershell
cd D:\Fishburners\Hearth
git add scrapers/requirements.txt scrapers/pytest.ini scrapers/tests/__init__.py scrapers/tests/test_tagger.py
git commit -m "test(tagger): scaffold pytest infrastructure"
```

---

## Task 2: Extend models.py with new types and fields

**Files:**
- Modify: `scrapers/shared/models.py`

- [ ] **Step 1: Write failing test for new model fields**

Add to `scrapers/tests/test_tagger.py`:
```python
def test_tagged_fields_has_new_fields():
    t = TaggedFields(
        type="grant",
        description="Test grant",
        stage=["seed"],
        industry=["tech"],
        geo=["AU"],
        equity_free=True,
        support_types=["funding", "mentorship"],
        impact_focus=False,
        revenue_required=None,
        application_cycle="rolling",
    )
    assert t.equity_free is True
    assert t.support_types == ["funding", "mentorship"]
    assert t.impact_focus is False
    assert t.revenue_required is None
    assert t.application_cycle == "rolling"


def test_tagged_fields_new_field_defaults():
    t = TaggedFields(
        type="grant",
        description="Test",
        stage=["any"],
        industry=["any"],
        geo=["Global"],
    )
    assert t.equity_free is True
    assert t.support_types == ["funding"]
    assert t.impact_focus is False
    assert t.revenue_required is None
    assert t.application_cycle == "ongoing"
```

- [ ] **Step 2: Run to verify they fail**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v
```

Expected: `FAILED` — `TaggedFields` has no `equity_free` attribute.

- [ ] **Step 3: Update models.py**

Replace the entire contents of `scrapers/shared/models.py`:
```python
from __future__ import annotations
from pydantic import BaseModel, field_validator
from typing import Literal

OpportunityType = Literal["grant", "accelerator", "pitch_competition", "fund", "fellowship", "other"]
Stage = Literal["idea", "pre_seed", "seed", "series_a", "growth", "any"]
Industry = Literal["tech", "health", "climate", "fintech", "edtech", "agritech", "consumer", "deep_tech", "social", "any"]
Geo = Literal["AU", "US", "UK", "EU", "Global", "APAC"]
SupportType = Literal["funding", "mentorship", "network", "loan", "education", "workspace"]
ApplicationCycle = Literal["rolling", "annual", "cohort", "ongoing"]


class TaggedFields(BaseModel):
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
    women_focused: bool = True
    equity_free: bool = True
    support_types: list[SupportType] = ["funding"]
    impact_focus: bool = False
    revenue_required: bool | None = None
    application_cycle: ApplicationCycle = "ongoing"

    @field_validator("description")
    @classmethod
    def description_max_length(cls, v: str) -> str:
        if len(v) > 500:
            return v[:500]
        return v

    @field_validator("eligibility_summary")
    @classmethod
    def eligibility_max_length(cls, v: str | None) -> str | None:
        if v and len(v) > 500:
            return v[:500]
        return v

    @field_validator("stage", "industry", "geo", "support_types")
    @classmethod
    def non_empty_list(cls, v: list) -> list:
        if not v:
            raise ValueError("Must contain at least one value")
        return v
```

- [ ] **Step 4: Run tests — expect pass**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```powershell
cd D:\Fishburners\Hearth
git add scrapers/shared/models.py scrapers/tests/test_tagger.py
git commit -m "feat(tagger): add SupportType, ApplicationCycle + 5 new TaggedFields"
```

---

## Task 3: Add keyword constants to tagger.py

**Files:**
- Modify: `scrapers/shared/tagger.py`

No tests for constants (they're data, not logic — tested implicitly by helper tests).

- [ ] **Step 1: Add keyword maps after existing MONTH_MAP**

In `scrapers/shared/tagger.py`, after the `MONTH_MAP` dict (around line 32), insert:

```python
# --- Field classification keyword maps ---

TYPE_KEYWORDS: dict[str, str] = {
    r"\baccelerator\b": "accelerator",
    r"\bfellowship\b": "fellowship",
    r"\bpitch\s+competition\b|\bpitching\s+competition\b": "pitch_competition",
    r"\bfund\b|\bvc\b|\bventure\s+capital\b|\bangel\s+invest": "fund",
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

WOMEN_POSITIVE = r"\bwomen\b|\bfemale\b|\bwoman.owned\b|\bwomen.led\b|\bfemale\s+founder"
WOMEN_NEGATIVE = [
    r"\bnot\s+limited\s+to\s+women\b",
    r"\bopen\s+to\s+all\b",
    r"\bgender.neutral\b",
    r"\bgender.inclusive\b",
]

ELIGIBILITY_SIGNALS = [
    "eligible", "eligibility", "open to", "must be",
    "requirements", "who can apply", "applicant",
]

EQUITY_NEGATIVE = [
    r"\bequity\s+stake\b|\btakes?\s+equity\b|\bdilutive\b",
    r"\bin\s+exchange\s+for\s+equity\b|\bshareholders?\b",
]
EQUITY_POSITIVE = [
    r"\bnon.dilutive\b", r"\bno\s+equity\b",
    r"\bzero.interest\s+loan\b", r"\brepayable\s+grant\b",
]

SUPPORT_KEYWORDS: dict[str, str] = {
    r"\bmentor(?:ship|ing|s)?\b|\bcoach(?:ing)?\b": "mentorship",
    r"\bnetwork(?:ing)?\b|\bcommunity\b|\bconnect(?:ions?)?\b": "network",
    r"\bloan\b|\brepayable\b|\bzero.interest\b": "loan",
    r"\bworkshop\b|\btraining\b|\bcurriculum\b|\beducation\s+program": "education",
    r"\bworkspace\b|\bcoworking\b|\boffice\s+space\b": "workspace",
}

IMPACT_KEYWORDS = [
    r"\bsocial\s+impact\b|\benvironmental\s+impact\b",
    r"\bsdg\b|\bsustainable\s+development\s+goal",
    r"\bpositive\s+impact\b|\bb\s*corp\b|\bbenefit\s+corp",
    r"\bimpact\s+entrepreneur\b|\bimpact.driven\b",
]

REVENUE_POSITIVE = [
    r"\brevenue.generating\b|\brevenue.positive\b",
    r"\bestablished\s+business\b|\babn\s+required\b|\bacn\s+required\b",
    r"\bmust\s+have\s+revenue\b|\bexisting\s+customers?\b|\btrading\b",
]
REVENUE_NEGATIVE = [
    r"\bpre.revenue\b|\bno\s+revenue\s+required\b",
    r"\bidea\s+stage\b|\bconcept\s+stage\b|\bpre.launch\b",
]

CYCLE_KEYWORDS: dict[str, str] = {
    r"\brolling\s+applications?\b|\bapply\s+anytime\b|\bopen\s+year.round\b": "rolling",
    r"\bannual\b|\bonce\s+a\s+year\b|\byearly\b": "annual",
    r"\bcohort\b|\bbatch\b|\bintake\b|\bprogram\s+cycle\b": "cohort",
}
```

- [ ] **Step 2: Verify tagger still imports cleanly**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\python.exe -c "from shared.tagger import tag_opportunity; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```powershell
cd D:\Fishburners\Hearth
git add scrapers/shared/tagger.py
git commit -m "feat(tagger): add keyword classification maps"
```

---

## Task 4: Implement existing-field helpers

**Files:**
- Modify: `scrapers/shared/tagger.py`
- Modify: `scrapers/tests/test_tagger.py`

- [ ] **Step 1: Write failing tests for existing-field helpers**

Add to `scrapers/tests/test_tagger.py`:
```python
def test_parse_type_accelerator():
    from shared.tagger import _parse_type
    assert _parse_type("This is an accelerator program for startups") == "accelerator"

def test_parse_type_fellowship():
    from shared.tagger import _parse_type
    assert _parse_type("Annual fellowship for women entrepreneurs") == "fellowship"

def test_parse_type_fund():
    from shared.tagger import _parse_type
    assert _parse_type("Venture capital fund investing in seed stage") == "fund"

def test_parse_type_default_grant():
    from shared.tagger import _parse_type
    assert _parse_type("Apply now for funding support") == "grant"

def test_parse_stage_multi():
    from shared.tagger import _parse_stage
    result = _parse_stage("Open to pre-seed and seed stage startups in growth markets")
    assert "pre_seed" in result
    assert "seed" in result

def test_parse_stage_fallback():
    from shared.tagger import _parse_stage
    assert _parse_stage("Some text with no stage signals") == ["any"]

def test_parse_industry_multi():
    from shared.tagger import _parse_industry
    result = _parse_industry("Supporting fintech and healthcare startups using AI")
    assert "fintech" in result
    assert "health" in result
    assert "deep_tech" in result

def test_parse_industry_fallback():
    from shared.tagger import _parse_industry
    assert _parse_industry("No industry mentioned here") == ["any"]

def test_parse_geo_single():
    from shared.tagger import _parse_geo
    assert "AU" in _parse_geo("Open to Australian businesses only")

def test_parse_geo_multi():
    from shared.tagger import _parse_geo
    result = _parse_geo("Programs in the US and UK welcome European applicants")
    assert "US" in result
    assert "UK" in result
    assert "EU" in result

def test_parse_geo_fallback():
    from shared.tagger import _parse_geo
    assert _parse_geo("No location mentioned") == ["Global"]

def test_parse_women_focused_positive():
    from shared.tagger import _parse_women_focused
    assert _parse_women_focused("Supporting women-led startups") is True

def test_parse_women_focused_negative_signal():
    from shared.tagger import _parse_women_focused
    assert _parse_women_focused("Open to all genders, gender-neutral program") is False

def test_parse_women_focused_default():
    from shared.tagger import _parse_women_focused
    assert _parse_women_focused("No gender signals in this text at all") is True

def test_parse_eligibility_finds_sentence():
    from shared.tagger import _parse_eligibility
    text = "We fund great startups. Open to all women entrepreneurs based in Australia. Apply by June."
    result = _parse_eligibility(text)
    assert result is not None
    assert "women" in result.lower()

def test_parse_eligibility_none_when_no_signal():
    from shared.tagger import _parse_eligibility
    assert _parse_eligibility("Great opportunity. Apply now. Deadline soon.") is None
```

- [ ] **Step 2: Run to verify all fail**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v
```

Expected: all new tests fail with `ImportError: cannot import name '_parse_type'`.

- [ ] **Step 3: Implement helpers in tagger.py**

In `scrapers/shared/tagger.py`, after the keyword maps (before `tag_opportunity`), add:

```python
def _parse_type(text: str) -> str:
    for pattern, value in TYPE_KEYWORDS.items():
        if re.search(pattern, text, re.IGNORECASE):
            return value
    return "grant"


def _parse_stage(text: str) -> list[str]:
    found = list(dict.fromkeys(
        value for pattern, value in STAGE_KEYWORDS.items()
        if re.search(pattern, text, re.IGNORECASE)
    ))
    return found or ["any"]


def _parse_industry(text: str) -> list[str]:
    found = list(dict.fromkeys(
        value for pattern, value in INDUSTRY_KEYWORDS.items()
        if re.search(pattern, text, re.IGNORECASE)
    ))
    return found or ["any"]


def _parse_geo(text: str) -> list[str]:
    found = list(dict.fromkeys(
        value for pattern, value in GEO_KEYWORDS.items()
        if re.search(pattern, text, re.IGNORECASE)
    ))
    return found or ["Global"]


def _parse_women_focused(text: str) -> bool:
    if any(re.search(p, text, re.IGNORECASE) for p in WOMEN_NEGATIVE):
        return False
    return bool(re.search(WOMEN_POSITIVE, text, re.IGNORECASE))


def _parse_eligibility(text: str) -> str | None:
    sentences = re.split(r"(?<=[.!?])\s+|\n", text)
    for sentence in sentences:
        lower = sentence.lower()
        if any(signal in lower for signal in ELIGIBILITY_SIGNALS):
            return sentence.strip()[:500] or None
    return None
```

- [ ] **Step 4: Run tests for existing-field helpers only**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v -k "type or stage or industry or geo or women or eligibility or new_fields or defaults"
```

Expected: all targeted tests pass. Import error on new-field helpers is expected until Task 5.

- [ ] **Step 6: Commit**

```powershell
cd D:\Fishburners\Hearth
git add scrapers/shared/tagger.py scrapers/tests/test_tagger.py
git commit -m "feat(tagger): existing-field keyword helpers (type/stage/industry/geo/women/eligibility)"
```

---

## Task 5: Implement new-field helpers

**Files:**
- Modify: `scrapers/shared/tagger.py`
- Modify: `scrapers/tests/test_tagger.py`

- [ ] **Step 1: Write failing tests for new-field helpers**

Add to `scrapers/tests/test_tagger.py`:
```python
def test_parse_equity_free_grant_language():
    from shared.tagger import _parse_equity_free
    assert _parse_equity_free("This is a non-dilutive grant for startups") is True

def test_parse_equity_free_equity_taken():
    from shared.tagger import _parse_equity_free
    assert _parse_equity_free("We take an equity stake in your company") is False

def test_parse_equity_free_default_true():
    from shared.tagger import _parse_equity_free
    assert _parse_equity_free("Apply for funding support today") is True

def test_parse_support_types_always_includes_funding():
    from shared.tagger import _parse_support_types
    result = _parse_support_types("No keywords here at all")
    assert "funding" in result

def test_parse_support_types_multiple():
    from shared.tagger import _parse_support_types
    result = _parse_support_types("Mentorship, workshops, and coworking space included")
    assert "mentorship" in result
    assert "education" in result
    assert "workspace" in result
    assert "funding" in result

def test_parse_impact_focus_true():
    from shared.tagger import _parse_impact_focus
    assert _parse_impact_focus("Targeting ventures with clear social impact mandate") is True

def test_parse_impact_focus_sdg():
    from shared.tagger import _parse_impact_focus
    assert _parse_impact_focus("Must address UN SDG goals") is True

def test_parse_impact_focus_false():
    from shared.tagger import _parse_impact_focus
    assert _parse_impact_focus("Early stage tech startups welcome") is False

def test_parse_revenue_required_true():
    from shared.tagger import _parse_revenue_required
    assert _parse_revenue_required("Must be a revenue-generating business with existing customers") is True

def test_parse_revenue_required_false():
    from shared.tagger import _parse_revenue_required
    assert _parse_revenue_required("Open to pre-revenue idea stage founders") is False

def test_parse_revenue_required_none():
    from shared.tagger import _parse_revenue_required
    assert _parse_revenue_required("Great funding opportunity for startups") is None

def test_parse_application_cycle_rolling():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Rolling applications accepted year-round") == "rolling"

def test_parse_application_cycle_cohort():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Join our next cohort starting in March") == "cohort"

def test_parse_application_cycle_annual():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Annual award ceremony held every year") == "annual"

def test_parse_application_cycle_default():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Apply for funding") == "ongoing"
```

- [ ] **Step 2: Run to verify fail**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v -k "equity or support or impact or revenue or cycle"
```

Expected: `ImportError` on the new helpers.

- [ ] **Step 3: Implement new-field helpers in tagger.py**

In `scrapers/shared/tagger.py`, add after `_parse_eligibility`:

```python
def _parse_equity_free(text: str) -> bool:
    if any(re.search(p, text, re.IGNORECASE) for p in EQUITY_POSITIVE):
        return True
    if any(re.search(p, text, re.IGNORECASE) for p in EQUITY_NEGATIVE):
        return False
    return True


def _parse_support_types(text: str) -> list[str]:
    found = ["funding"]
    for pattern, value in SUPPORT_KEYWORDS.items():
        if re.search(pattern, text, re.IGNORECASE) and value not in found:
            found.append(value)
    return found


def _parse_impact_focus(text: str) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in IMPACT_KEYWORDS)


def _parse_revenue_required(text: str) -> bool | None:
    if any(re.search(p, text, re.IGNORECASE) for p in REVENUE_POSITIVE):
        return True
    if any(re.search(p, text, re.IGNORECASE) for p in REVENUE_NEGATIVE):
        return False
    return None


def _parse_application_cycle(text: str) -> str:
    for pattern, value in CYCLE_KEYWORDS.items():
        if re.search(pattern, text, re.IGNORECASE):
            return value
    return "ongoing"
```

- [ ] **Step 4: Run all tests**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
cd D:\Fishburners\Hearth
git add scrapers/shared/tagger.py scrapers/tests/test_tagger.py
git commit -m "feat(tagger): new-field helpers (equity_free/support_types/impact_focus/revenue_required/application_cycle)"
```

---

## Task 6: Update tag_opportunity + golden fixture tests

**Files:**
- Modify: `scrapers/shared/tagger.py`
- Modify: `scrapers/tests/test_tagger.py`

- [ ] **Step 1: Write three golden fixture tests**

Add to `scrapers/tests/test_tagger.py`:
```python
def test_golden_accelerator_with_equity():
    result = tag_opportunity(
        raw_text=(
            "Techstars runs a 3-month cohort accelerator program for pre-seed Australian fintech startups. "
            "We take an equity stake of 6%. Mentorship and networking included. "
            "Join our next intake and scale your startup."
        ),
        name="Techstars AU",
    )
    assert result is not None
    assert result.type == "accelerator"
    assert result.equity_free is False
    assert result.application_cycle == "cohort"
    assert "mentorship" in result.support_types
    assert "network" in result.support_types
    assert "funding" in result.support_types
    assert "fintech" in result.industry
    assert "pre_seed" in result.stage
    assert "AU" in result.geo


def test_golden_impact_grant_rolling():
    result = tag_opportunity(
        raw_text=(
            "Zero-interest loan for women-led social impact ventures working on UN SDG goals. "
            "Rolling applications accepted year-round. Must be revenue-generating. "
            "Open to businesses in Australia, US, and UK."
        ),
        name="Coralus Venture",
    )
    assert result is not None
    assert result.equity_free is True
    assert result.impact_focus is True
    assert result.women_focused is True
    assert result.application_cycle == "rolling"
    assert result.revenue_required is True
    assert "loan" in result.support_types
    assert "AU" in result.geo
    assert "US" in result.geo
    assert "UK" in result.geo


def test_golden_no_signals_uses_defaults():
    result = tag_opportunity(
        raw_text="Some text with absolutely no classifiable signals whatsoever.",
        name="Mystery Grant",
    )
    assert result is not None
    assert result.type == "grant"
    assert result.stage == ["any"]
    assert result.industry == ["any"]
    assert result.geo == ["Global"]
    assert result.equity_free is True
    assert result.impact_focus is False
    assert result.revenue_required is None
    assert result.application_cycle == "ongoing"
    assert result.women_focused is True


def test_defaults_override_auto_detection():
    result = tag_opportunity(
        raw_text="This is an accelerator with equity stake for US tech startups",
        name="Override Test",
        defaults={
            "type": "grant",
            "equity_free": True,
            "geo": ["AU"],
        },
    )
    assert result is not None
    assert result.type == "grant"       # default wins over "accelerator"
    assert result.equity_free is True   # default wins over False
    assert result.geo == ["AU"]         # default wins over ["US"]
```

- [ ] **Step 2: Run to verify golden tests fail**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v -k "golden or defaults_override"
```

Expected: all 4 fail — `tag_opportunity` doesn't call the new helpers yet.

- [ ] **Step 3: Update tag_opportunity**

Replace the `tag_opportunity` function in `scrapers/shared/tagger.py`:

```python
def tag_opportunity(raw_text: str, name: str, defaults: dict | None = None) -> TaggedFields | None:
    """Extract structured metadata using regex + source-specific defaults."""
    defaults = defaults or {}

    deadline = defaults.get("deadline") or _parse_date(raw_text)
    amount_min, amount_max, currency = _parse_amounts(raw_text)
    if "amount_min" in defaults:
        amount_min = defaults["amount_min"]
    if "amount_max" in defaults:
        amount_max = defaults["amount_max"]
    if "currency" in defaults:
        currency = defaults["currency"]

    opp_type    = defaults.get("type")                or _parse_type(raw_text)
    stage       = defaults.get("stage")               or _parse_stage(raw_text)
    industry    = defaults.get("industry")            or _parse_industry(raw_text)
    geo         = defaults.get("geo")                 or _parse_geo(raw_text)
    women       = defaults.get("women_focused",          _parse_women_focused(raw_text))
    eligibility = defaults.get("eligibility_summary") or _parse_eligibility(raw_text)
    description = defaults.get("description")         or f"Funding opportunity: {name}"

    equity_free   = defaults.get("equity_free",         _parse_equity_free(raw_text))
    support_types = defaults.get("support_types")     or _parse_support_types(raw_text)
    impact_focus  = defaults.get("impact_focus",        _parse_impact_focus(raw_text))
    rev_required  = defaults.get("revenue_required",    _parse_revenue_required(raw_text))
    cycle         = defaults.get("application_cycle")  or _parse_application_cycle(raw_text)

    try:
        return TaggedFields(
            type=opp_type,
            description=description,
            eligibility_summary=eligibility,
            stage=stage,
            industry=industry,
            geo=geo,
            amount_min=amount_min,
            amount_max=amount_max,
            currency=currency,
            deadline=deadline,
            women_focused=women,
            equity_free=equity_free,
            support_types=support_types,
            impact_focus=impact_focus,
            revenue_required=rev_required,
            application_cycle=cycle,
        )
    except Exception as e:
        print(f"  [tagger] Validation error for {name}: {e}")
        return None
```

- [ ] **Step 4: Run full test suite**

```powershell
cd D:\Fishburners\Hearth\scrapers
.\venv\Scripts\pytest.exe tests\test_tagger.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
cd D:\Fishburners\Hearth
git add scrapers/shared/tagger.py scrapers/tests/test_tagger.py
git commit -m "feat(tagger): wire all helpers into tag_opportunity + golden fixture tests"
```

---

## Task 7: Supabase migration

**Files:**
- Create: `supabase/migrations/004_tagger_extended_fields.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/004_tagger_extended_fields.sql`:
```sql
-- Migration 004: Extended tagger fields
-- Adds 5 new columns to support richer opportunity classification

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS equity_free       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS support_types     TEXT[]  NOT NULL DEFAULT '{funding}',
  ADD COLUMN IF NOT EXISTS impact_focus      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS revenue_required  BOOLEAN,
  ADD COLUMN IF NOT EXISTS application_cycle TEXT    NOT NULL DEFAULT 'ongoing';

-- Backfill existing rows with sensible defaults (already applied via column defaults above)
-- Partial index for common filter: equity-free opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_equity_free
  ON opportunities (equity_free)
  WHERE equity_free = TRUE;

-- Partial index for impact-focused filter
CREATE INDEX IF NOT EXISTS idx_opportunities_impact
  ON opportunities (impact_focus)
  WHERE impact_focus = TRUE;
```

- [ ] **Step 2: Apply in Supabase**

Open the Supabase Dashboard → SQL Editor → paste and run the migration.

Verify with:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'opportunities'
  AND column_name IN ('equity_free','support_types','impact_focus','revenue_required','application_cycle');
```

Expected: 5 rows returned.

- [ ] **Step 3: Commit migration**

```powershell
cd D:\Fishburners\Hearth
git add supabase/migrations/004_tagger_extended_fields.sql
git commit -m "feat(db): migration 004 — add 5 extended tagger columns to opportunities"
```

---

## Task 8: Open PR

- [ ] **Step 1: Push branch**

```powershell
cd D:\Fishburners\Hearth
git push -u origin HEAD
```

- [ ] **Step 2: Create PR**

```powershell
gh pr create --title "feat(tagger): keyword auto-extraction + 5 new opportunity fields" --body "Closes #36

## Changes
- \`models.py\`: Added \`SupportType\`, \`ApplicationCycle\` types + 5 new \`TaggedFields\`
- \`tagger.py\`: 11 keyword maps + 11 helpers + updated \`tag_opportunity\`
- \`tests/test_tagger.py\`: 35 tests, 3 golden fixtures
- Migration 004: 5 new columns on \`opportunities\`

## Test plan
- [ ] \`cd scrapers && .\\venv\\Scripts\\pytest.exe tests\\ -v\` — all pass
- [ ] Apply migration 004 in Supabase, verify 5 columns exist
- [ ] Run \`python run_all.py\` against staging to confirm new fields populate"
```
