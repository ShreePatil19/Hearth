from __future__ import annotations
import anthropic
from .config import ANTHROPIC_API_KEY
from .models import TaggedFields

_client: anthropic.Anthropic | None = None

SYSTEM_PROMPT = """You are a metadata extraction assistant for Hearth, a funding directory for women founders.

Given raw text about a funding opportunity, extract structured metadata.

RULES:
- Write the description and eligibility_summary in your OWN words. Do NOT copy text from the source.
- description: A concise 1-3 sentence summary of what the opportunity offers.
- eligibility_summary: Who can apply and key requirements.
- stage: Which startup stages are eligible. Use "any" only if truly open to all stages.
- industry: Which industries are targeted. Use "any" only if truly open to all.
- geo: Which regions can apply. Use "AU" for Australia-specific, "Global" if open worldwide.
- amount_min/amount_max: In the local currency. Null if not specified.
- currency: Three-letter code (AUD, USD, EUR, etc.)
- deadline: ISO date (YYYY-MM-DD) if a specific deadline exists. Null for rolling/ongoing.
- women_focused: true if the opportunity specifically targets or prioritises women founders.
"""

TOOL_SCHEMA = {
    "name": "tag_opportunity",
    "description": "Extract structured metadata from a funding opportunity description",
    "input_schema": {
        "type": "object",
        "properties": {
            "type": {
                "type": "string",
                "enum": ["grant", "accelerator", "pitch_competition", "fund", "fellowship", "other"],
            },
            "description": {"type": "string", "maxLength": 500},
            "eligibility_summary": {"type": ["string", "null"], "maxLength": 500},
            "stage": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["idea", "pre_seed", "seed", "series_a", "growth", "any"],
                },
                "minItems": 1,
            },
            "industry": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["tech", "health", "climate", "fintech", "edtech", "agritech", "consumer", "deep_tech", "social", "any"],
                },
                "minItems": 1,
            },
            "geo": {
                "type": "array",
                "items": {
                    "type": "string",
                    "enum": ["AU", "US", "UK", "EU", "Global", "APAC"],
                },
                "minItems": 1,
            },
            "amount_min": {"type": ["integer", "null"]},
            "amount_max": {"type": ["integer", "null"]},
            "currency": {"type": "string", "default": "AUD"},
            "deadline": {"type": ["string", "null"], "description": "ISO date YYYY-MM-DD or null"},
            "women_focused": {"type": "boolean", "default": True},
        },
        "required": ["type", "description", "stage", "industry", "geo"],
    },
}


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def tag_opportunity(raw_text: str, name: str, _retry: bool = False) -> TaggedFields | None:
    """Call Claude Haiku to extract structured metadata. Returns validated TaggedFields or None."""
    client = _get_client()

    # Truncate to keep costs minimal
    truncated = raw_text[:3000]

    user_message = f"Opportunity name: {name}\n\nRaw text:\n{truncated}"

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            tools=[TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "tag_opportunity"},
            messages=[{"role": "user", "content": user_message}],
        )

        # Extract tool use block
        tool_block = next(
            (b for b in response.content if b.type == "tool_use"),
            None,
        )
        if not tool_block:
            print(f"  [tagger] No tool_use block for: {name}")
            return None

        # Validate with Pydantic
        tagged = TaggedFields.model_validate(tool_block.input)
        return tagged

    except Exception as e:
        if not _retry:
            print(f"  [tagger] Retry for: {name} — {e}")
            return tag_opportunity(raw_text, name, _retry=True)
        print(f"  [tagger] Failed after retry for: {name} — {e}")
        return None
