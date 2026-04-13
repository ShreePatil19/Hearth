"""Scraper for Heads Over Heels (AU accelerator for women-led startups)"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.headsoverheels.com.au"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

DEFAULTS = {
    "type": "accelerator",
    "description": "Heads Over Heels connects women-led startups with corporates, investors, and mentors through pitch events, programs, and accelerator opportunities across Australia.",
    "eligibility_summary": "Women-led startups in Australia seeking growth-stage support, corporate partnerships, and investment connections.",
    "stage": ["seed", "series_a", "growth"],
    "industry": ["tech", "health", "fintech", "any"],
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
        "name": "Heads Over Heels Programs",
        "organisation": "Heads Over Heels",
        "source_url": f"{BASE_URL}/",
        "application_url": f"{BASE_URL}/programs/",
        "raw_text": "\n\n".join(all_text),
    }]


def run() -> int:
    opportunities = scrape()
    print(f"Heads Over Heels: found {len(opportunities)} opportunities")
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
    print(f"Heads Over Heels: upserted {total} opportunities")
