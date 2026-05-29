"""Shared HTTP helpers for the scrapers."""
from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


def make_session(total: int = 3, backoff_factor: float = 1.0) -> requests.Session:
    """A requests.Session with retry + exponential backoff on transient HTTP
    failures (429 and 5xx).

    Replaces bare ``requests.Session()`` so a single timeout or rate-limit
    response does not silently drop a whole source for the day. See #91.
    """
    session = requests.Session()
    retry = Retry(
        total=total,
        backoff_factor=backoff_factor,
        status_forcelist=(429, 500, 502, 503, 504),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session
