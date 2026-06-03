"""Tests for the business.gov.au scraper's token handling (#96).

config.py reads Supabase env at import time, so set dummy values before
importing the scraper (mirrors test_imports.py).
"""
import importlib
import os

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://dummy.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "dummy-service-key")

business_gov_au = importlib.import_module("business_gov_au")


def test_scrape_skips_when_token_missing(monkeypatch, capsys):
    """With no COVEO_SEARCH_TOKEN, scrape() returns [] without a network call."""
    monkeypatch.delenv("COVEO_SEARCH_TOKEN", raising=False)
    result = business_gov_au.scrape()
    assert result == []
    assert "COVEO_SEARCH_TOKEN not set" in capsys.readouterr().out


def test_token_is_read_from_env_not_hardcoded():
    """The Coveo token must come from the environment, not a source literal (#96)."""
    source_path = os.path.join(os.path.dirname(__file__), "..", "business_gov_au.py")
    with open(source_path, encoding="utf-8") as fh:
        source = fh.read()
    # Reads the token from the environment...
    assert "COVEO_SEARCH_TOKEN" in source
    # ...and no hardcoded token assignment remains.
    assert 'COVEO_TOKEN = "' not in source
