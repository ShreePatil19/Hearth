import os
from pathlib import Path
from dotenv import load_dotenv
import httpx

# Load .env.local from project root (no-op in GitHub Actions)
env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
load_dotenv(env_path)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

_client: httpx.Client | None = None


def get_client() -> httpx.Client:
    """Returns an httpx client configured for Supabase REST API."""
    global _client
    if _client is None:
        _client = httpx.Client(
            base_url=f"{SUPABASE_URL}/rest/v1",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            timeout=15,
        )
    return _client
