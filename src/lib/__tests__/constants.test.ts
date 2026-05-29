import { describe, expect, it } from "vitest";
import {
  APPLICATION_CYCLES,
  GEOS,
  INDUSTRIES,
  OPPORTUNITY_TYPES,
  STAGES,
} from "@/lib/constants";

const allHaveValueAndLabel = (items: readonly { value: string; label: string }[]): boolean =>
  items.every((item) => item.value.length > 0 && item.label.length > 0);

describe("constants", () => {
  it("OPPORTUNITY_TYPES has six value/label pairs including grant", () => {
    expect(OPPORTUNITY_TYPES).toHaveLength(6);
    expect(allHaveValueAndLabel(OPPORTUNITY_TYPES)).toBe(true);
    expect(OPPORTUNITY_TYPES.map((o) => o.value)).toContain("grant");
  });

  it("STAGES includes idea through any", () => {
    const values = STAGES.map((s) => s.value);
    expect(values).toContain("idea");
    expect(values).toContain("any");
    expect(allHaveValueAndLabel(STAGES)).toBe(true);
  });

  it("INDUSTRIES has ten entries", () => {
    expect(INDUSTRIES).toHaveLength(10);
    expect(allHaveValueAndLabel(INDUSTRIES)).toBe(true);
  });

  it("GEOS includes AU and Global", () => {
    const values = GEOS.map((g) => g.value);
    expect(values).toContain("AU");
    expect(values).toContain("Global");
  });

  it("APPLICATION_CYCLES includes rolling and ongoing", () => {
    const values = APPLICATION_CYCLES.map((c) => c.value);
    expect(values).toEqual(expect.arrayContaining(["rolling", "ongoing"]));
  });
});
