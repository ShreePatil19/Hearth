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


def test_parse_equity_free_grant_language():
    from shared.tagger import _parse_equity_free
    assert _parse_equity_free("This is a non-dilutive grant for startups") is True

def test_parse_equity_free_equity_taken():
    from shared.tagger import _parse_equity_free
    assert _parse_equity_free("We take an equity stake in your company") is False

def test_parse_equity_free_default_true():
    from shared.tagger import _parse_equity_free
    assert _parse_equity_free("Apply for funding support today") is True

def test_parse_support_types_always_includes_funding():
    from shared.tagger import _parse_support_types
    result = _parse_support_types("No keywords here at all")
    assert "funding" in result

def test_parse_support_types_multiple():
    from shared.tagger import _parse_support_types
    result = _parse_support_types("Mentorship, workshops, and coworking space included")
    assert "mentorship" in result
    assert "education" in result
    assert "workspace" in result
    assert "funding" in result

def test_parse_impact_focus_true():
    from shared.tagger import _parse_impact_focus
    assert _parse_impact_focus("Targeting ventures with clear social impact mandate") is True

def test_parse_impact_focus_sdg():
    from shared.tagger import _parse_impact_focus
    assert _parse_impact_focus("Must address UN SDG goals") is True

def test_parse_impact_focus_false():
    from shared.tagger import _parse_impact_focus
    assert _parse_impact_focus("Early stage tech startups welcome") is False

def test_parse_revenue_required_true():
    from shared.tagger import _parse_revenue_required
    assert _parse_revenue_required("Must be a revenue-generating business with existing customers") is True

def test_parse_revenue_required_false():
    from shared.tagger import _parse_revenue_required
    assert _parse_revenue_required("Open to pre-revenue idea stage founders") is False

def test_parse_revenue_required_none():
    from shared.tagger import _parse_revenue_required
    assert _parse_revenue_required("Great funding opportunity for startups") is None

def test_parse_application_cycle_rolling():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Rolling applications accepted year-round") == "rolling"

def test_parse_application_cycle_cohort():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Join our next cohort starting in March") == "cohort"

def test_parse_application_cycle_annual():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Annual award ceremony held every year") == "annual"

def test_parse_application_cycle_default():
    from shared.tagger import _parse_application_cycle
    assert _parse_application_cycle("Apply for funding") == "ongoing"
