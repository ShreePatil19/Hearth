"""Scraper for IFundWomen grants"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://ifundwomen.com"
PAGES = [
    f"{BASE_URL}/grants",
    f"{BASE_URL}/universal-grant-application",
]
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

DEFAULTS = {
    "type": "grant",
    "description": "IFundWomen offers grants for women-led businesses through their universal grant application. Multiple grant opportunities available year-round from corporate and foundation partners.",
    "eligibility_summary": "Women and non-binary entrepreneurs at any stage. US-based businesses preferred but some grants open internationally.",
    "stage": ["idea", "pre_seed", "seed", "any"],
    "industry": ["any"],
    "geo": ["US", "Global"],
    "currency": "USD",
    "women_focused": True,
}


def scrape() -> list[dict]:
    """Fetch and parse IFundWomen grant pages."""
    session = requests.Session()
    session.headers.update(HEADERS)
    opportunities: list[dict] = []

    for url in PAGES:
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            content = soup.find("main") or soup.find("article") or soup.body
            raw_text = content.get_text(separator="\n", strip=True) if content else ""

            if raw_text and len(raw_text) > 100:
                path = url.rstrip("/").split("/")[-1]
                name_map = {
                    "grants": "IFundWomen Grants",
                    "universal-grant-application": "IFundWomen Universal Grant",
                }
                name = name_map.get(path, f"IFundWomen — {path}")

                opportunities.append({
                    "name": name,
                    "organisation": "IFundWomen",
                    "source_url": url,
                    "application_url": f"{BASE_URL}/universal-grant-application",
                    "raw_text": raw_text,
                })

            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    # Deduplicate
    seen: dict[str, dict] = {}
    for opp in opportunities:
        key = opp["name"]
        if key not in seen or len(opp["raw_text"]) > len(seen[key]["raw_text"]):
            seen[key] = opp
    return list(seen.values())


def run() -> int:
    """Scrape and upsert IFundWomen opportunities. Returns count."""
    opportunities = scrape()
    print(f"IFundWomen: found {len(opportunities)} opportunities")
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
    print(f"IFundWomen: upserted {total} opportunities")
