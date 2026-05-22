from shared.models import TaggedFields


def test_tagged_fields_has_new_fields():
    t = TaggedFields(
        type="grant",
        description="Test grant",
        stage=["seed"],
        industry=["tech"],
        geo=["AU"],
        equity_free=True,
        support_types=["funding", "mentorship"],
        impact_focus=False,
        revenue_required=None,
        application_cycle="rolling",
    )
    assert t.equity_free is True
    assert t.support_types == ["funding", "mentorship"]
    assert t.impact_focus is False
    assert t.revenue_required is None
    assert t.application_cycle == "rolling"


def test_tagged_fields_new_field_defaults():
    t = TaggedFields(
        type="grant",
        description="Test",
        stage=["any"],
        industry=["any"],
        geo=["Global"],
    )
    assert t.equity_free is True
    assert t.support_types == ["funding"]
    assert t.impact_focus is False
    assert t.revenue_required is None
    assert t.application_cycle == "ongoing"


def test_parse_type_accelerator():
    from shared.tagger import _parse_type
    assert _parse_type("This is an accelerator program for startups") == "accelerator"

def test_parse_type_fellowship():
    from shared.tagger import _parse_type
    assert _parse_type("Annual fellowship for women entrepreneurs") == "fellowship"

def test_parse_type_fund():
    from shared.tagger import _parse_type
    assert _parse_type("Venture capital fund investing in seed stage") == "fund"

def test_parse_type_default_grant():
    from shared.tagger import _parse_type
    assert _parse_type("Apply now for funding support") == "grant"

def test_parse_stage_multi():
    from shared.tagger import _parse_stage
    result = _parse_stage("Open to pre-seed and seed stage startups in growth markets")
    assert "pre_seed" in result
    assert "seed" in result

def test_parse_stage_fallback():
    from shared.tagger import _parse_stage
    assert _parse_stage("Some text with no stage signals") == ["any"]

def test_parse_industry_multi():
    from shared.tagger import _parse_industry
    result = _parse_industry("Supporting fintech and healthcare startups using AI")
    assert "fintech" in result
    assert "health" in result
    assert "deep_tech" in result

def test_parse_industry_fallback():
    from shared.tagger import _parse_industry
    assert _parse_industry("No industry mentioned here") == ["any"]

def test_parse_geo_single():
    from shared.tagger import _parse_geo
    assert "AU" in _parse_geo("Open to Australian businesses only")

def test_parse_geo_multi():
    from shared.tagger import _parse_geo
    result = _parse_geo("Programs in the US and UK welcome European applicants")
    assert "US" in result
    assert "UK" in result
    assert "EU" in result

def test_parse_geo_fallback():
    from shared.tagger import _parse_geo
    assert _parse_geo("No location mentioned") == ["Global"]

def test_parse_women_focused_positive():
    from shared.tagger import _parse_women_focused
    assert _parse_women_focused("Supporting women-led startups") is True

def test_parse_women_focused_negative_signal():
    from shared.tagger import _parse_women_focused
    assert _parse_women_focused("Open to all genders, gender-neutral program") is False

def test_parse_women_focused_default():
    from shared.tagger import _parse_women_focused
    assert _parse_women_focused("No gender signals in this text at all") is True

def test_parse_eligibility_finds_sentence():
    from shared.tagger import _parse_eligibility
    text = "We fund great startups. Open to all women entrepreneurs based in Australia. Apply by June."
    result = _parse_eligibility(text)
    assert result is not None
    assert "women" in result.lower()

def test_parse_eligibility_none_when_no_signal():
    from shared.tagger import _parse_eligibility
    assert _parse_eligibility("Great opportunity. Apply now. Deadline soon.") is None
