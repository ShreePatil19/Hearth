"""Scraper for SBE Australia (Supporting and Backing Entrepreneurs)"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.sbeaustralia.com"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

DEFAULTS = {
    "type": "accelerator",
    "description": "SBE Australia runs accelerator programs and pitch competitions for women entrepreneurs across Australia, providing mentorship, funding, and connections.",
    "eligibility_summary": "Women entrepreneurs in Australia at early to growth stage. Programs vary — check individual program pages for specific requirements.",
    "stage": ["idea", "pre_seed", "seed", "series_a"],
    "industry": ["tech", "consumer", "social", "any"],
    "geo": ["AU"],
    "currency": "AUD",
    "women_focused": True,
}


def scrape() -> list[dict]:
    session = requests.Session()
    session.headers.update(HEADERS)

    urls = [f"{BASE_URL}/", f"{BASE_URL}/programs/"]
    all_text: list[str] = []

    for url in urls:
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            content = soup.find("main") or soup.find("article") or soup.body
            raw = content.get_text(separator="\n", strip=True) if content else ""
            if raw:
                all_text.append(raw)
            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {url}: {e}")

    if not all_text:
        return []

    return [{
        "name": "SBE Australia Programs",
        "organisation": "SBE Australia",
        "source_url": f"{BASE_URL}/",
        "application_url": f"{BASE_URL}/programs/",
        "raw_text": "\n\n".join(all_text),
    }]


def run() -> int:
    opportunities = scrape()
    print(f"SBE Australia: found {len(opportunities)} opportunities")
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
    print(f"SBE Australia: upserted {total} opportunities")
