"""Rule-based tagger — no LLM needed. Extracts structured metadata using
regex patterns and source-specific defaults."""
from __future__ import annotations
import re
from datetime import datetime, timezone
from .models import TaggedFields

# Common date patterns
DATE_PATTERNS = [
    # "January 15, 2026" or "Jan 15, 2026"
    r"(\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.,]?\s+\d{1,2}[,.]?\s+\d{4})",
    # "15 January 2026" or "15 Jan 2026"
    r"(\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[.,]?\s+\d{4})",
    # "2026-01-15"
    r"(\b\d{4}-\d{2}-\d{2}\b)",
    # "15/01/2026" or "01/15/2026"
    r"(\b\d{1,2}/\d{1,2}/\d{4}\b)",
]

# Money patterns
MONEY_PATTERNS = [
    # "$10,000" or "$10000" or "AUD 10,000"
    r"(?:(?:AUD|USD|EUR|GBP|NZD)\s*)?\$\s*([\d,]+(?:\.\d{2})?)",
    r"(?:AUD|USD|EUR|GBP|NZD)\s*([\d,]+(?:\.\d{2})?)",
]

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
    "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}

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
    # Case-sensitive (?-i:US) so the country abbreviation "US" matches but the
    # lowercase pronoun "us" (e.g. "contact us") does not. See #90.
    r"\bunited\s+states\b|\busa\b|\bu\.s\.\b|\bamerican\b|\b(?-i:US)\b": "US",
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
    r"\bworkshops?\b|\btraining\b|\bcurriculum\b|\beducation\s+program": "education",
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


def _parse_date(text: str) -> str | None:
    """Try to extract the earliest deadline that is today or later."""
    # Compare against the UTC date. GitHub Actions runs in UTC; using a naive
    # local datetime here dropped a deadline that was still hours away in AU
    # time, and on the runner it could drop a deadline that lands today. See #93.
    today = datetime.now(timezone.utc).date()
    dates: list[datetime] = []

    for pattern in DATE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            date_str = match.group(1).replace(",", "").replace(".", "").strip()
            # %m/%d/%Y (US order) is intentionally omitted: it is ambiguous with
            # %d/%m/%Y and the AU-format sources dominate. US sources should set
            # an explicit deadline default instead of relying on regex. See #95.
            for fmt in [
                "%B %d %Y", "%b %d %Y", "%d %B %Y", "%d %b %Y",
                "%Y-%m-%d", "%d/%m/%Y",
            ]:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    if dt.date() >= today:
                        dates.append(dt)
                    break
                except ValueError:
                    continue

    if dates:
        return min(dates).strftime("%Y-%m-%d")
    return None


def _parse_amounts(text: str) -> tuple[int | None, int | None, str]:
    """Extract dollar amounts and currency from text."""
    amounts: list[int] = []
    currency = "USD"  # default

    # Detect currency
    if re.search(r"\bAUD\b", text):
        currency = "AUD"
    elif re.search(r"\bGBP\b|£", text):
        currency = "GBP"
    elif re.search(r"\bEUR\b|€", text):
        currency = "EUR"
    elif re.search(r"\bNZD\b", text):
        currency = "NZD"

    for pattern in MONEY_PATTERNS:
        for match in re.finditer(pattern, text):
            amount_str = match.group(1).replace(",", "").split(".")[0]
            try:
                val = int(amount_str)
                if val > 0:
                    amounts.append(val)
            except ValueError:
                continue

    # Also catch plain "$X" without currency prefix
    for match in re.finditer(r"\$\s*([\d,]+)", text):
        amount_str = match.group(1).replace(",", "")
        try:
            val = int(amount_str)
            if val > 0 and val not in amounts:
                amounts.append(val)
        except ValueError:
            continue

    if not amounts:
        return None, None, currency

    amounts.sort()
    if len(amounts) == 1:
        return amounts[0], amounts[0], currency
    return amounts[0], amounts[-1], currency


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
    if re.search(WOMEN_POSITIVE, text, re.IGNORECASE):
        return True
    return True  # default: assume open to women unless explicitly excluded


def _parse_eligibility(text: str) -> str | None:
    sentences = re.split(r"(?<=[.!?])\s+|\n", text)
    for sentence in sentences:
        lower = sentence.lower()
        if any(signal in lower for signal in ELIGIBILITY_SIGNALS):
            return sentence.strip()[:500] or None
    return None


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
