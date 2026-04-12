"""Scraper for Tory Burch Foundation Fellows Program"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.toryburchfoundation.org"
PAGES = [
    f"{BASE_URL}/programs/fellows",
]
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

DEFAULTS = {
    "type": "fellowship",
    "description": "Annual fellowship program providing women entrepreneurs with funding, mentorship, and business education. Fellows receive a share of $100,000 in grant funding.",
    "eligibility_summary": "Women entrepreneurs in the US running an early-stage business. Must demonstrate social impact and business viability.",
    "stage": ["pre_seed", "seed", "series_a"],
    "industry": ["any"],
    "geo": ["US"],
    "amount_min": 5000,
    "amount_max": 100000,
    "currency": "USD",
    "women_focused": True,
}


def scrape() -> list[dict]:
    """Fetch and parse Tory Burch Foundation pages."""
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

            if raw_text:
                opportunities.append({
                    "name": "Tory Burch Foundation Fellows Program",
                    "organisation": "Tory Burch Foundation",
                    "source_url": url,
                    "application_url": url,
                    "raw_text": raw_text,
                })

            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    return opportunities


def run() -> int:
    """Scrape and upsert Tory Burch Foundation opportunities. Returns count."""
    opportunities = scrape()
    print(f"Tory Burch: found {len(opportunities)} opportunities")
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
    print(f"Tory Burch: upserted {total} opportunities")
