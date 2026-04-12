"""Scraper for business.gov.au grants via Coveo search API.
The listing page is 100% JavaScript-rendered, so we hit the Coveo API directly."""
from __future__ import annotations
import time
import re
from datetime import datetime, timezone
import httpx
from shared.db import upsert_opportunity

BASE_URL = "https://business.gov.au"
COVEO_URL = "https://departmentofindustryscienceenergyandresourcesproduxlo9oz8e.org.coveo.com/rest/search/v2"
COVEO_TOKEN = "xx9eeaa647-9038-418e-b985-9a469f276965"
COVEO_CQ = '(NOT @z95xtemplate==(ADB6CA4F03EF4F47B9AC9CE2BA53FF97,FE5DD82648C6436DB87A7C4210C7413B)) ((@z95xtemplate==64642b7d33654d6aabfaa209fe642da9) (@ez120xcludez32xfromz32xsearch==0) OR @z95xtemplate==03c2e6e6631e4ba9b889e4455d7eb090)'

MAX_RESULTS = 200


def _epoch_to_iso(epoch_ms: int | None) -> str | None:
    """Convert epoch milliseconds to ISO date string."""
    if not epoch_ms:
        return None
    try:
        dt = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except (ValueError, OSError):
        return None


def _strip_html(html: str | None) -> str:
    """Remove HTML tags from a string."""
    if not html:
        return ""
    return re.sub(r"<[^>]+>", " ", html).strip()


def _extract_amount(text: str) -> tuple[int | None, int | None]:
    """Extract dollar amounts from 'what you get' text."""
    amounts = []
    for match in re.finditer(r"\$\s*([\d,]+)", text):
        try:
            val = int(match.group(1).replace(",", ""))
            if val > 0:
                amounts.append(val)
        except ValueError:
            continue
    if not amounts:
        return None, None
    amounts.sort()
    return amounts[0], amounts[-1]


def scrape() -> list[dict]:
    """Fetch grants from the Coveo search API."""
    client = httpx.Client(timeout=15)
    opportunities: list[dict] = []

    body = {
        "q": "",
        "searchHub": "Grants and programs",
        "numberOfResults": MAX_RESULTS,
        "firstResult": 0,
        "aq": '@cgs=="Open"',
        "cq": COVEO_CQ,
    }

    try:
        resp = client.post(
            COVEO_URL,
            json=body,
            headers={
                "Authorization": f"Bearer {COVEO_TOKEN}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  [error] Coveo API call failed: {e}")
        return []

    results = data.get("results", [])
    print(f"  Coveo returned {len(results)} open grants (total: {data.get('totalCount', '?')})")

    for item in results:
        raw = item.get("raw", {})
        title = raw.get("ctitle", item.get("title", ""))
        url_path = raw.get("curl", "")
        full_url = url_path if url_path.startswith("http") else f"{BASE_URL}{url_path}"

        # Build raw text from available fields
        description = _strip_html(raw.get("csearchcarddescription", ""))
        short_desc = _strip_html(raw.get("fshortz32xdescription28333", ""))
        what_you_get = _strip_html(raw.get("whatz32xyouz32xget", ""))
        who_for = _strip_html(raw.get("whoz32xthisz32xisz32xfor", ""))
        eligibility = _strip_html(raw.get("fapplyz32xsection28333", ""))

        raw_text = f"{title}\n{description}\n{short_desc}\n{what_you_get}\n{who_for}\n{eligibility}"

        # Extract deadline from close date
        close_date_ms = raw.get("closez32xdate")
        deadline = _epoch_to_iso(close_date_ms)

        # Extract amounts
        amount_min, amount_max = _extract_amount(what_you_get)

        # Check if women-focused
        combined = f"{title} {description} {who_for} {eligibility}".lower()
        is_women_focused = any(
            kw in combined
            for kw in ["women", "female", "woman", "her business", "gender", "female founder"]
        )

        # Map locations to geo
        locations = raw.get("cloc", [])
        if isinstance(locations, str):
            locations = [locations]

        defaults = {
            "type": "grant",
            "description": short_desc or description[:300] or f"Australian Government grant: {title}",
            "eligibility_summary": (who_for[:300] if who_for else None),
            "stage": ["any"],
            "industry": ["any"],
            "geo": ["AU"],
            "currency": "AUD",
            "amount_min": amount_min,
            "amount_max": amount_max,
            "deadline": deadline,
            "women_focused": is_women_focused,
        }

        opportunities.append({
            "name": title,
            "organisation": "Australian Government",
            "source_url": full_url,
            "application_url": full_url,
            "raw_text": raw_text,
            "defaults": defaults,
        })

    return opportunities


def run() -> int:
    """Scrape and upsert all business.gov.au opportunities. Returns count."""
    opportunities = scrape()
    print(f"business.gov.au: found {len(opportunities)} opportunities")
    count = 0
    for opp in opportunities:
        result = upsert_opportunity(
            name=opp["name"],
            organisation=opp["organisation"],
            source_url=opp["source_url"],
            application_url=opp["application_url"],
            raw_text=opp["raw_text"],
            defaults=opp.get("defaults"),
        )
        if result is not None:
            count += 1
    return count


if __name__ == "__main__":
    total = run()
    print(f"business.gov.au: upserted {total} opportunities")
