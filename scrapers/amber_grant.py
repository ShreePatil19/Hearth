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
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}


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

            # Extract main content
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

            time.sleep(3)  # Polite delay
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    # Deduplicate by name — keep the richest raw_text
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
        )
        if result is not None:
            count += 1
    return count


if __name__ == "__main__":
    total = run()
    print(f"Amber Grant: upserted {total} opportunities")
