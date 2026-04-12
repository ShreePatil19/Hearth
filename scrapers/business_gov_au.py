"""Scraper for business.gov.au grants and programs"""
from __future__ import annotations
import time
import requests
from bs4 import BeautifulSoup
from shared.db import upsert_opportunity

BASE_URL = "https://business.gov.au"
SEARCH_URL = f"{BASE_URL}/grants-and-programs"
HEADERS = {"User-Agent": "HearthBot/1.0 (+https://github.com/ShreePatil19/Hearth)"}

MAX_PAGES = 5  # Limit pagination to avoid excessive scraping
MAX_DETAIL_FETCHES = 30  # Safety cap on detail page requests


def _fetch_listing_page(session: requests.Session, url: str) -> tuple[list[dict], str | None]:
    """Fetch a listing page and return (opportunity stubs, next_page_url)."""
    resp = session.get(url, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    stubs: list[dict] = []

    # Find grant/program listing items
    items = soup.select(".listing-item, .views-row, article.node, .grant-item, li.search-result")
    if not items:
        # Fallback: try finding links in the main content
        main = soup.find("main") or soup.body
        if main:
            for link in main.find_all("a", href=True):
                href = link["href"]
                if "/grants-and-programs/" in href and href != "/grants-and-programs":
                    full_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                    stubs.append({
                        "name": link.get_text(strip=True),
                        "detail_url": full_url,
                    })

    for item in items:
        link = item.find("a", href=True)
        if link:
            href = link["href"]
            full_url = href if href.startswith("http") else f"{BASE_URL}{href}"
            stubs.append({
                "name": link.get_text(strip=True),
                "detail_url": full_url,
            })

    # Find next page link
    next_link = soup.select_one("a.pager-next, a[rel='next'], .pagination a[aria-label='Next']")
    next_url = None
    if next_link and next_link.get("href"):
        href = next_link["href"]
        next_url = href if href.startswith("http") else f"{BASE_URL}{href}"

    return stubs, next_url


def _fetch_detail(session: requests.Session, url: str) -> str:
    """Fetch a grant detail page and return its text content."""
    resp = session.get(url, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    content = soup.find("main") or soup.find("article") or soup.body
    return content.get_text(separator="\n", strip=True) if content else ""


def scrape() -> list[dict]:
    """Fetch and parse business.gov.au grants listing with pagination."""
    session = requests.Session()
    session.headers.update(HEADERS)
    all_stubs: list[dict] = []

    url: str | None = SEARCH_URL
    page_count = 0

    while url and page_count < MAX_PAGES:
        try:
            stubs, next_url = _fetch_listing_page(session, url)
            all_stubs.extend(stubs)
            url = next_url
            page_count += 1
            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to fetch listing page {url}: {e}")
            break

    # Deduplicate by URL
    seen_urls: set[str] = set()
    unique_stubs: list[dict] = []
    for stub in all_stubs:
        if stub["detail_url"] not in seen_urls and stub["name"]:
            seen_urls.add(stub["detail_url"])
            unique_stubs.append(stub)

    # Fetch detail pages
    opportunities: list[dict] = []
    for i, stub in enumerate(unique_stubs[:MAX_DETAIL_FETCHES]):
        try:
            raw_text = _fetch_detail(session, stub["detail_url"])
            if raw_text:
                opportunities.append({
                    "name": stub["name"],
                    "organisation": "Australian Government",
                    "source_url": stub["detail_url"],
                    "application_url": stub["detail_url"],
                    "raw_text": raw_text,
                })
            time.sleep(3)
        except Exception as e:
            print(f"  [error] Failed to fetch detail {stub['detail_url']}: {e}")

    return opportunities


def run() -> int:
    """Scrape and upsert all business.gov.au opportunities. Returns count."""
    opportunities = scrape()
    print(f"business.gov.au: found {len(opportunities)} opportunities")
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
    print(f"business.gov.au: upserted {total} opportunities")
