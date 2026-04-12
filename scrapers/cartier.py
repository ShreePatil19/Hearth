"""Scraper for Cartier Women's Initiative"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.cartierwomensinitiative.com"
PAGES = [
    f"{BASE_URL}/awards",
    f"{BASE_URL}/regional-awards",
    f"{BASE_URL}/science-technology-pioneer-award",
]
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}


def scrape() -> list[dict]:
    """Fetch and parse Cartier Women's Initiative pages."""
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
                # Derive name from the URL path
                path = url.rstrip("/").split("/")[-1]
                name_map = {
                    "awards": "Cartier Women's Initiative",
                    "regional-awards": "Cartier Women's Initiative — Regional Awards",
                    "science-technology-pioneer-award": "Cartier Science & Technology Pioneer Award",
                }
                name = name_map.get(path, f"Cartier — {path.replace('-', ' ').title()}")

                opportunities.append({
                    "name": name,
                    "organisation": "Cartier",
                    "source_url": url,
                    "application_url": url,
                    "raw_text": raw_text,
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
        )
        if result is not None:
            count += 1
    return count


if __name__ == "__main__":
    total = run()
    print(f"Cartier: upserted {total} opportunities")
