"""Smoke test: every scraper module imports cleanly.

Catches broken imports (e.g. a mistyped shared.http import) that the tagger
tests would not exercise. config.py reads Supabase env at import, so set dummy
values before importing anything that pulls it in.
"""
import importlib
import os

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-key")

SCRAPER_MODULES = [
    "amber_grant",
    "business_gov_au",
    "cartier",
    "heads_over_heels",
    "ifundwomen",
    "sbe_australia",
    "scale_investors",
    "sheeo_coralus",
    "techstars",
    "tory_burch",
]


def test_all_scraper_modules_import():
    for name in SCRAPER_MODULES:
        importlib.import_module(name)
