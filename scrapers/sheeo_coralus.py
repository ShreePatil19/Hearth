"""Scraper for SheEO / Coralus — radical generosity model for women founders"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.coralus.world"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

PAGES = [
    {
        "url": f"{BASE_URL}/ventures",
        "name": "Coralus (SheEO) Venture Fund",
        "defaults": {
            "type": "fund",
            "description": "Coralus (formerly SheEO) provides zero-interest loans to women and non-binary-led ventures working on the UN Sustainable Development Goals. Funded by a community of Activators.",
            "eligibility_summary": "Women and non-binary-led ventures working on UN SDGs. Must be revenue-generating and based in Canada, US, UK, Australia, or New Zealand.",
            "stage": ["seed", "series_a", "growth"],
            "industry": ["social", "climate", "health", "any"],
            "geo": ["AU", "US", "UK", "Global"],
            "currency": "USD",
            "women_focused": True,
        },
    },
    {
        "url": f"{BASE_URL}/activators",
        "name": "Coralus Activator Program",
        "defaults": {
            "type": "fellowship",
            "description": "Become a Coralus Activator: contribute to the venture fund, vote on which ventures receive funding, and join a global community of women supporting women entrepreneurs.",
            "eligibility_summary": "Open to anyone who wants to support women-led ventures. Annual contribution of $1,100 to join the Activator community.",
            "stage": ["any"],
            "industry": ["any"],
            "geo": ["AU", "US", "UK", "Global"],
            "amount_min": 0,
            "amount_max": 100000,
            "currency": "USD",
            "women_focused": True,
        },
    },
]


def scrape() -> list[dict]:
    session = requests.Session()
    session.headers.update(HEADERS)
    opportunities: list[dict] = []

    for page in PAGES:
        try:
            resp = session.get(page["url"], timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            content = soup.find("main") or soup.find("article") or soup.body
            raw_text = content.get_text(separator="\n", strip=True) if content else ""

            if raw_text:
                opportunities.append({
                    "name": page["name"],
                    "organisation": "Coralus (SheEO)",
                    "source_url": page["url"],
                    "application_url": page["url"],
                    "raw_text": raw_text,
                    "defaults": page["defaults"],
                })
            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {page['url']}: {e}")

    return opportunities


def run() -> int:
    opportunities = scrape()
    print(f"Coralus/SheEO: found {len(opportunities)} opportunities")
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
    print(f"Coralus/SheEO: upserted {total} opportunities")
