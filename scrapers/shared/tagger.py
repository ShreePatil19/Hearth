"""Rule-based tagger — no LLM needed. Extracts structured metadata using
regex patterns and source-specific defaults."""
from __future__ import annotations
import re
from datetime import datetime
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


def _parse_date(text: str) -> str | None:
    """Try to extract the earliest future deadline from text."""
    now = datetime.now()
    dates: list[datetime] = []

    for pattern in DATE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            date_str = match.group(1).replace(",", "").replace(".", "").strip()
            for fmt in [
                "%B %d %Y", "%b %d %Y", "%d %B %Y", "%d %b %Y",
                "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
            ]:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    if dt > now:
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


def tag_opportunity(raw_text: str, name: str, defaults: dict | None = None) -> TaggedFields | None:
    """Extract structured metadata using regex + source-specific defaults.

    Args:
        raw_text: The scraped page text
        name: Opportunity name
        defaults: Source-specific overrides (type, geo, stage, industry, description, etc.)
    """
    defaults = defaults or {}

    deadline = defaults.get("deadline") or _parse_date(raw_text)
    amount_min, amount_max, currency = _parse_amounts(raw_text)

    # Allow defaults to override extracted amounts
    if "amount_min" in defaults:
        amount_min = defaults["amount_min"]
    if "amount_max" in defaults:
        amount_max = defaults["amount_max"]
    if "currency" in defaults:
        currency = defaults["currency"]

    try:
        tagged = TaggedFields(
            type=defaults.get("type", "grant"),
            description=defaults.get("description", f"Funding opportunity: {name}"),
            eligibility_summary=defaults.get("eligibility_summary"),
            stage=defaults.get("stage", ["any"]),
            industry=defaults.get("industry", ["any"]),
            geo=defaults.get("geo", ["Global"]),
            amount_min=amount_min,
            amount_max=amount_max,
            currency=currency,
            deadline=deadline,
            women_focused=defaults.get("women_focused", True),
        )
        return tagged
    except Exception as e:
        print(f"  [tagger] Validation error for {name}: {e}")
        return None
