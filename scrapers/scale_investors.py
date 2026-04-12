"""Scraper for Scale Investors (AU angel network for women-led startups)"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.scaleinvestors.com.au"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

DEFAULTS = {
    "type": "fund",
    "description": "Australia's leading angel investor network focused exclusively on women-led startups. Provides funding, mentorship, and access to investor networks.",
    "eligibility_summary": "Australian women-led startups seeking angel investment. Must have a scalable business model and be investment-ready.",
    "stage": ["pre_seed", "seed"],
    "industry": ["tech", "health", "fintech", "any"],
    "geo": ["AU"],
    "currency": "AUD",
    "women_focused": True,
}


def scrape() -> list[dict]:
    """Fetch and parse Scale Investors pages."""
    session = requests.Session()
    session.headers.update(HEADERS)

    pages = [
        f"{BASE_URL}/",
        f"{BASE_URL}/for-entrepreneurs/",
    ]

    all_text: list[str] = []
    for url in pages:
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            content = soup.find("main") or soup.find("article") or soup.body
            raw_text = content.get_text(separator="\n", strip=True) if content else ""
            if raw_text:
                all_text.append(raw_text)
            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    if not all_text:
        return []

    return [{
        "name": "Scale Investors Angel Network",
        "organisation": "Scale Investors",
        "source_url": f"{BASE_URL}/",
        "application_url": f"{BASE_URL}/for-entrepreneurs/",
        "raw_text": "\n\n".join(all_text),
    }]


def run() -> int:
    """Scrape and upsert Scale Investors opportunities. Returns count."""
    opportunities = scrape()
    print(f"Scale Investors: found {len(opportunities)} opportunities")
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
    print(f"Scale Investors: upserted {total} opportunities")
