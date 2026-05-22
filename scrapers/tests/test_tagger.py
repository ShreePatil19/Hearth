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
