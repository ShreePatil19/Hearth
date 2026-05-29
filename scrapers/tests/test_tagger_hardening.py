"""Regression tests for the tagger hardening fixes (#90, #93, #95)."""
from datetime import datetime, timezone

from shared.tagger import _parse_date, _parse_geo


# --- #90: geo "US" must match the country, not the pronoun "us" ---

def test_geo_does_not_tag_us_for_pronoun():
    assert "US" not in _parse_geo("Please contact us for more information.")
    assert "US" not in _parse_geo("This grant helps us support local founders.")


def test_geo_tags_us_for_country_abbreviation():
    assert "US" in _parse_geo("Open to startups in the US and UK.")
    assert "US" in _parse_geo("Applicants from the USA are welcome.")
    assert "US" in _parse_geo("Founders based in the United States.")


# --- #95: ambiguous slash dates resolve as DD/MM; US order is no longer parsed ---

def test_date_parses_ddmm_slash_format():
    # 13/06/2099 is unambiguously DD/MM (month 13 would be invalid).
    assert _parse_date("Applications close 13/06/2099.") == "2099-06-13"


def test_date_does_not_parse_us_order_slash_format():
    # 06/13/2099 only parses under %m/%d/%Y, which is intentionally removed.
    assert _parse_date("Applications close 06/13/2099.") is None


# --- #93: a deadline that lands today (UTC) is kept, not dropped ---

def test_date_keeps_today_utc_deadline():
    today = datetime.now(timezone.utc).date()
    text = f"Applications close {today.strftime('%d/%m/%Y')}."
    assert _parse_date(text) == today.strftime("%Y-%m-%d")
