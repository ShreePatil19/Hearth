import { describe, expect, it } from "vitest";
import { filtersToParams, parseFilters, type FilterState } from "@/lib/filters";

function roundTrip(state: FilterState): FilterState {
  const params = filtersToParams(state);
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return parseFilters(obj);
}

describe("parseFilters / filtersToParams", () => {
  it("round-trips a fully populated filter state without loss", () => {
    const original: FilterState = {
      type: ["grant", "fund"],
      stage: ["seed", "series_a"],
      industry: ["tech", "climate"],
      geo: ["AU", "Global"],
      aussieOnly: true,
      equityFree: true,
      impactFocus: true,
      applicationCycle: ["rolling", "ongoing"],
    };

    expect(roundTrip(original)).toEqual(original);
  });

  it("round-trips an empty filter state", () => {
    const empty: FilterState = {
      type: [],
      stage: [],
      industry: [],
      geo: [],
      aussieOnly: false,
      equityFree: false,
      impactFocus: false,
      applicationCycle: [],
    };

    expect(roundTrip(empty)).toEqual(empty);
  });
});
