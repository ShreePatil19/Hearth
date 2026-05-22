"""Scraper for Amber Grant (ambergrantsforwomen.com)"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://ambergrantsforwomen.com"
PAGES = [
    f"{BASE_URL}/get-an-amber-grant/",
    f"{BASE_URL}/all-grants/",
]
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/systems-collab/Hearth)"}

# Source-specific metadata — no AI needed
DEFAULTS = {
    "type": "grant",
    "description": "Monthly grant of $10,000 awarded to women-owned businesses by WomensNet. Additional $25,000 year-end grant available.",
    "eligibility_summary": "Open to women-owned businesses at any stage. Must be at least 18 years old. US and international applicants welcome.",
    "stage": ["idea", "pre_seed", "seed", "any"],
    "industry": ["any"],
    "geo": ["US", "Global"],
    "amount_min": 10000,
    "amount_max": 25000,
    "currency": "USD",
    "women_focused": True,
    "equity_free": True,
    "support_types": ["funding"],
    "impact_focus": False,
    "revenue_required": None,
    "application_cycle": "rolling",
}


def scrape() -> list[dict]:
    """Fetch and parse Amber Grant opportunity pages."""
    session = requests.Session()
    session.headers.update(HEADERS)
    opportunities: list[dict] = []

    for url in PAGES:
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            content = soup.find("main") or soup.find("article") or soup.find("div", class_="entry-content")
            if not content:
                content = soup.body

            raw_text = content.get_text(separator="\n", strip=True) if content else ""

            if raw_text:
                opportunities.append({
                    "name": "Amber Grant",
                    "organisation": "WomensNet",
                    "source_url": url,
                    "application_url": f"{BASE_URL}/get-an-amber-grant/",
                    "raw_text": raw_text,
                })

            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    # Deduplicate — keep the richest raw_text
    seen: dict[str, dict] = {}
    for opp in opportunities:
        key = opp["name"]
        if key not in seen or len(opp["raw_text"]) > len(seen[key]["raw_text"]):
            seen[key] = opp
    return list(seen.values())


def run() -> int:
    """Scrape and upsert all Amber Grant opportunities. Returns count."""
    opportunities = scrape()
    print(f"Amber Grant: found {len(opportunities)} opportunities")
    count = 0
    for opp in opportunities:
        result = upsert_opportunity(
            name=opp["name"],
            organisation=opp["organisation"],
            source_url=opp["source_url"],
            application_url=opp["application_url"],
            raw_text=opp["raw_text"],
            defaults=DEFAULTS,
        )
        if result is not None:
            count += 1
    return count


if __name__ == "__main__":
    total = run()
    print(f"Amber Grant: upserted {total} opportunities")
