import { describe, expect, it } from "vitest";
import { parseFilters, type FilterState } from "@/lib/filters";

describe("parseFilters", () => {
  it("returns an all-empty filter state when no params are provided", () => {
    const expected: FilterState = {
      type: [],
      stage: [],
      industry: [],
      geo: [],
      aussieOnly: false,
      equityFree: false,
      impactFocus: false,
      applicationCycle: [],
    };

    expect(parseFilters({})).toEqual(expected);
  });

  it("splits comma-separated strings into arrays", () => {
    const result = parseFilters({
      type: "grant,fund",
      stage: "seed,series_a",
      industry: "tech,climate",
      geo: "AU,Global",
      cycle: "rolling,ongoing",
    });

    expect(result.type).toEqual(["grant", "fund"]);
    expect(result.stage).toEqual(["seed", "series_a"]);
    expect(result.industry).toEqual(["tech", "climate"]);
    expect(result.geo).toEqual(["AU", "Global"]);
    expect(result.applicationCycle).toEqual(["rolling", "ongoing"]);
  });

  it("preserves array params as-is", () => {
    const result = parseFilters({
      type: ["grant", "fund"],
      stage: ["seed"],
    });

    expect(result.type).toEqual(["grant", "fund"]);
    expect(result.stage).toEqual(["seed"]);
  });

  it("filters out empty segments from comma-separated strings", () => {
    const result = parseFilters({ type: "grant,,fund,," });

    expect(result.type).toEqual(["grant", "fund"]);
  });

  it("parses boolean flags only when set to the literal 'true'", () => {
    expect(parseFilters({ aussie: "true" }).aussieOnly).toBe(true);
    expect(parseFilters({ aussie: "false" }).aussieOnly).toBe(false);
    expect(parseFilters({ aussie: "1" }).aussieOnly).toBe(false);
    expect(parseFilters({}).aussieOnly).toBe(false);

    expect(parseFilters({ equity: "true" }).equityFree).toBe(true);
    expect(parseFilters({ impact: "true" }).impactFocus).toBe(true);
  });

  it("ignores undefined params", () => {
    const result = parseFilters({
      type: undefined,
      stage: undefined,
      aussie: undefined,
    });

    expect(result.type).toEqual([]);
    expect(result.stage).toEqual([]);
    expect(result.aussieOnly).toBe(false);
  });
});
