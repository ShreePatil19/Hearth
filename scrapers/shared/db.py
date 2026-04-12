from __future__ import annotations
import hashlib
import json
from datetime import datetime, timezone
from .config import get_client
from .slug import generate_slug
from .tagger import tag_opportunity


def compute_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()


def upsert_opportunity(
    name: str,
    organisation: str | None,
    source_url: str,
    application_url: str | None,
    raw_text: str,
    defaults: dict | None = None,
) -> dict | None:
    """Tag and upsert a single opportunity. Returns the row dict or None on failure."""
    client = get_client()
    slug = generate_slug(name, organisation)
    content_hash = compute_hash(raw_text)
    now = datetime.now(timezone.utc).isoformat()

    # Check if content has changed
    resp = client.get(
        "/opportunities",
        params={"slug": f"eq.{slug}", "select": "content_hash"},
    )
    existing = resp.json() if resp.status_code == 200 else []

    if existing and existing[0].get("content_hash") == content_hash:
        # Unchanged — just update last_checked_at
        client.patch(
            "/opportunities",
            params={"slug": f"eq.{slug}"},
            content=json.dumps({"last_checked_at": now}),
        )
        print(f"  [skip] {name} — unchanged")
        return existing[0]

    # Tag with rule-based tagger
    tagged = tag_opportunity(raw_text, name, defaults=defaults)
    if tagged is None:
        print(f"  [fail] {name} — tagging failed")
        return None

    row = {
        "name": name,
        "organisation": organisation,
        "slug": slug,
        "source_url": source_url,
        "application_url": application_url,
        "content_hash": content_hash,
        "last_checked_at": now,
        "is_active": True,
        **tagged.model_dump(),
    }

    if row.get("deadline"):
        row["deadline"] = str(row["deadline"])

    # Upsert via POST with on_conflict
    resp = client.post(
        "/opportunities",
        content=json.dumps(row),
        headers={"Prefer": "return=representation,resolution=merge-duplicates"},
        params={"on_conflict": "slug"},
    )

    if resp.status_code in (200, 201):
        action = "update" if existing else "new"
        print(f"  [{action}] {name}")
        data = resp.json()
        return data[0] if data else row
    else:
        print(f"  [error] {name} — {resp.status_code}: {resp.text}")
        return None
