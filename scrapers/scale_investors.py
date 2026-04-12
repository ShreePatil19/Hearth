"""Scraper for Scale Investors (AU angel network for women-led startups)"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.scaleinvestors.com.au"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}


def scrape() -> list[dict]:
    """Fetch and parse Scale Investors pages."""
    session = requests.Session()
    session.headers.update(HEADERS)
    opportunities: list[dict] = []

    pages = [
        (f"{BASE_URL}/", "Scale Investors Angel Network"),
        (f"{BASE_URL}/for-entrepreneurs/", "Scale Investors — For Entrepreneurs"),
    ]

    for url, name in pages:
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")

            content = soup.find("main") or soup.find("article") or soup.body
            raw_text = content.get_text(separator="\n", strip=True) if content else ""

            if raw_text:
                opportunities.append({
                    "name": name,
                    "organisation": "Scale Investors",
                    "source_url": url,
                    "application_url": url,
                    "raw_text": raw_text,
                })

            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    # Keep only the richest entry if both pages scraped the same program
    if len(opportunities) > 1:
        # Merge text from both pages into a single opportunity
        combined_text = "\n\n".join(o["raw_text"] for o in opportunities)
        return [{
            "name": "Scale Investors Angel Network",
            "organisation": "Scale Investors",
            "source_url": f"{BASE_URL}/",
            "application_url": f"{BASE_URL}/for-entrepreneurs/",
            "raw_text": combined_text,
        }]

    return opportunities


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
        )
        if result is not None:
            count += 1
    return count


if __name__ == "__main__":
    total = run()
    print(f"Scale Investors: upserted {total} opportunities")
