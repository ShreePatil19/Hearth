from __future__ import annotations
from pydantic import BaseModel, field_validator
from typing import Literal

OpportunityType = Literal["grant", "accelerator", "pitch_competition", "fund", "fellowship", "other"]
Stage = Literal["idea", "pre_seed", "seed", "series_a", "growth", "any"]
Industry = Literal["tech", "health", "climate", "fintech", "edtech", "agritech", "consumer", "deep_tech", "social", "any"]
Geo = Literal["AU", "US", "UK", "EU", "Global", "APAC"]
SupportType = Literal["funding", "mentorship", "network", "loan", "education", "workspace"]
ApplicationCycle = Literal["rolling", "annual", "cohort", "ongoing"]


class TaggedFields(BaseModel):
    type: OpportunityType
    description: str
    eligibility_summary: str | None = None
    stage: list[Stage]
    industry: list[Industry]
    geo: list[Geo]
    amount_min: int | None = None
    amount_max: int | None = None
    currency: str = "AUD"
    deadline: str | None = None
    women_focused: bool = True
    equity_free: bool = True
    support_types: list[SupportType] = ["funding"]
    impact_focus: bool = False
    revenue_required: bool | None = None
    application_cycle: ApplicationCycle = "ongoing"

    @field_validator("description")
    @classmethod
    def description_max_length(cls, v: str) -> str:
        if len(v) > 500:
            return v[:500]
        return v

    @field_validator("eligibility_summary")
    @classmethod
    def eligibility_max_length(cls, v: str | None) -> str | None:
        if v and len(v) > 500:
            return v[:500]
        return v

    @field_validator("stage", "industry", "geo", "support_types")
    @classmethod
    def non_empty_list(cls, v: list) -> list:
        if not v:
            raise ValueError("Must contain at least one value")
        return v
