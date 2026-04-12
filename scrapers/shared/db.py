from __future__ import annotations
import hashlib
from datetime import datetime, timezone
from .config import get_supabase_client
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
) -> dict | None:
    """Tag and upsert a single opportunity. Returns the row dict or None on failure."""
    client = get_supabase_client()
    slug = generate_slug(name, organisation)
    content_hash = compute_hash(raw_text)
    now = datetime.now(timezone.utc).isoformat()

    # Check if content has changed
    existing = (
        client.table("opportunities")
        .select("content_hash")
        .eq("slug", slug)
        .execute()
    )

    if existing.data and existing.data[0].get("content_hash") == content_hash:
        # Content unchanged — just update last_checked_at
        client.table("opportunities").update({"last_checked_at": now}).eq("slug", slug).execute()
        print(f"  [skip] {name} — unchanged")
        return existing.data[0]

    # Content changed or new — tag with Claude Haiku
    tagged = tag_opportunity(raw_text, name)
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

    # Convert deadline to ISO string if present
    if row.get("deadline"):
        row["deadline"] = str(row["deadline"])

    result = (
        client.table("opportunities")
        .upsert(row, on_conflict="slug")
        .execute()
    )

    action = "update" if existing.data else "new"
    print(f"  [{action}] {name}")
    return result.data[0] if result.data else None
