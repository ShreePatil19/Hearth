"""Shared HTTP helpers for the scrapers."""
from __future__ import annotations

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Cap response bodies before scrapers hand them to BeautifulSoup. A grant info
# page is at most a few hundred KB; anything larger is a misconfigured redirect
# (e.g. a login wall with JS bundles) that would balloon memory across the ~10
# daily scrapers. See #108.
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5 MB


class ResponseTooLargeError(requests.RequestException):
    """Raised when a response body exceeds MAX_RESPONSE_BYTES."""


def _enforce_max_size(response: requests.Response, *args, **kwargs) -> requests.Response:
    """Response hook: reject bodies larger than MAX_RESPONSE_BYTES.

    Checks the declared Content-Length first (cheap), then the actual body
    length as a fallback for responses that omit or understate the header.
    Raising here surfaces as a per-URL error the scrapers already catch, so an
    oversized page is skipped without aborting the source.
    """
    declared = response.headers.get("Content-Length")
    if declared is not None:
        try:
            if int(declared) > MAX_RESPONSE_BYTES:
                raise ResponseTooLargeError(
                    f"Response from {response.url} declares {declared} bytes "
                    f"(over the {MAX_RESPONSE_BYTES}-byte limit)"
                )
        except ValueError:
            pass  # malformed header — fall through to the body-size check
    if len(response.content) > MAX_RESPONSE_BYTES:
        raise ResponseTooLargeError(
            f"Response from {response.url} is {len(response.content)} bytes "
            f"(over the {MAX_RESPONSE_BYTES}-byte limit)"
        )
    return response


def make_session(total: int = 3, backoff_factor: float = 1.0) -> requests.Session:
    """A requests.Session with retry + exponential backoff on transient HTTP
    failures (429 and 5xx), plus a response-size cap.

    Replaces bare ``requests.Session()`` so a single timeout or rate-limit
    response does not silently drop a whole source for the day (#91), and so an
    oversized / misconfigured response is rejected before parsing (#108).
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
    session.hooks["response"].append(_enforce_max_size)
    return session
