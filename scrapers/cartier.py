"""Scraper for Cartier Women's Initiative"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.cartierwomensinitiative.com"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

# Each page gets its own metadata
PAGES = [
    {
        "url": f"{BASE_URL}/awards",
        "name": "Cartier Women's Initiative",
        "defaults": {
            "type": "fellowship",
            "description": "Annual award providing grants, mentorship, and networking for women impact entrepreneurs. Up to $100,000 in grant funding plus tailored support.",
            "eligibility_summary": "Women impact entrepreneurs running a for-profit business that is 1-6 years old. Must address a social or environmental challenge.",
            "stage": ["seed", "pre_seed"],
            "industry": ["social", "climate", "health", "tech", "any"],
            "geo": ["Global"],
            "amount_min": 30000,
            "amount_max": 100000,
            "currency": "USD",
            "women_focused": True,
        },
    },
    {
        "url": f"{BASE_URL}/science-technology-pioneer-award",
        "name": "Cartier Science & Technology Pioneer Award",
        "defaults": {
            "type": "grant",
            "description": "Award for women scientists and technologists transforming their research into market-ready solutions with social or environmental impact.",
            "eligibility_summary": "Women researchers or entrepreneurs with a science or technology innovation that has potential for commercial application and positive impact.",
            "stage": ["idea", "pre_seed", "seed"],
            "industry": ["deep_tech", "health", "climate", "tech"],
            "geo": ["Global"],
            "amount_min": 100000,
            "amount_max": 100000,
            "currency": "USD",
            "women_focused": True,
        },
    },
]


def scrape() -> list[dict]:
    """Fetch and parse Cartier Women's Initiative pages."""
    session = requests.Session()
    session.headers.update(HEADERS)
    opportunities: list[dict] = []

    for page in PAGES:
        url = page["url"]
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            content = soup.find("main") or soup.find("article") or soup.body
            raw_text = content.get_text(separator="\n", strip=True) if content else ""

            if raw_text:
                opportunities.append({
                    "name": page["name"],
                    "organisation": "Cartier",
                    "source_url": url,
                    "application_url": url,
                    "raw_text": raw_text,
                    "defaults": page["defaults"],
                })

            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    return opportunities


def run() -> int:
    """Scrape and upsert all Cartier opportunities. Returns count."""
    opportunities = scrape()
    print(f"Cartier: found {len(opportunities)} opportunities")
    count = 0
    for opp in opportunities:
        result = upsert_opportunity(
            name=opp["name"],
            organisation=opp["organisation"],
            source_url=opp["source_url"],
            application_url=opp["application_url"],
            raw_text=opp["raw_text"],
            defaults=opp["defaults"],
        )
        if result is not None:
            count += 1
    return count


if __name__ == "__main__":
    total = run()
    print(f"Cartier: upserted {total} opportunities")
