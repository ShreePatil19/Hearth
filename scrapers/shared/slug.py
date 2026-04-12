import re
import unicodedata


def generate_slug(name: str, organisation: str | None = None) -> str:
    raw = f"{name}-{organisation}" if organisation else name
    normalized = unicodedata.normalize("NFKD", raw)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered)
    slug = slug.strip("-")
    return slug[:120]
