"""Scraper for Techstars accelerator programs"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://www.techstars.com"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

PROGRAMS = [
    {
        "url": f"{BASE_URL}/accelerators",
        "name": "Techstars Accelerator Programs",
        "defaults": {
            "type": "accelerator",
            "description": "Techstars runs 3-month accelerator programs worldwide, providing $120k in funding, mentorship, and access to a global network. Multiple industry-specific programs available.",
            "eligibility_summary": "Early-stage startups with a strong founding team and scalable business model. Applications open on rolling basis across different programs.",
            "stage": ["pre_seed", "seed"],
            "industry": ["tech", "health", "fintech", "climate", "any"],
            "geo": ["US", "Global"],
            "amount_min": 120000,
            "amount_max": 120000,
            "currency": "USD",
            "women_focused": False,
        },
    },
    {
        "url": f"{BASE_URL}/communities/techstars-rising-stars",
        "name": "Techstars Rising Stars — Women in Tech",
        "defaults": {
            "type": "accelerator",
            "description": "Techstars Rising Stars supports women and non-binary founders through mentorship, workshops, and access to the Techstars network. Part of Techstars commitment to diversity.",
            "eligibility_summary": "Women and non-binary founders building tech startups at pre-seed or seed stage.",
            "stage": ["idea", "pre_seed", "seed"],
            "industry": ["tech", "any"],
            "geo": ["US", "Global"],
            "currency": "USD",
            "women_focused": True,
        },
    },
]


def scrape() -> list[dict]:
    session = requests.Session()
    session.headers.update(HEADERS)
    opportunities: list[dict] = []

    for program in PROGRAMS:
        try:
            resp = session.get(program["url"], timeout=15)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            content = soup.find("main") or soup.find("article") or soup.body
            raw_text = content.get_text(separator="\n", strip=True) if content else ""

            if raw_text:
                opportunities.append({
                    "name": program["name"],
                    "organisation": "Techstars",
                    "source_url": program["url"],
                    "application_url": program["url"],
                    "raw_text": raw_text,
                    "defaults": program["defaults"],
                })
            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to scrape {program['url']}: {e}")

    return opportunities


def run() -> int:
    opportunities = scrape()
    print(f"Techstars: found {len(opportunities)} opportunities")
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
    print(f"Techstars: upserted {total} opportunities")
