import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/utils";

// Mirror the implementation's formatter so assertions don't depend on exact
// ICU symbol output across Node versions.
const fmt = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

describe("formatCurrency", () => {
  it("formats a zero minimum as a real amount, not 'Varies'", () => {
    const result = formatCurrency(0, null);
    expect(result).not.toBe("Varies");
    expect(result).toBe(fmt(0));
  });

  it("formats a zero-to-N range correctly", () => {
    expect(formatCurrency(0, 50000)).toBe(`${fmt(0)} to ${fmt(50000)}`);
  });

  it("formats a min/max range joined with 'to'", () => {
    expect(formatCurrency(10000, 50000)).toBe(`${fmt(10000)} to ${fmt(50000)}`);
  });

  it("formats a single value when min equals max", () => {
    expect(formatCurrency(25000, 25000)).toBe(fmt(25000));
  });

  it("formats a max-only amount as 'Up to'", () => {
    expect(formatCurrency(null, 50000)).toBe(`Up to ${fmt(50000)}`);
  });

  it("treats a zero max as a real amount", () => {
    expect(formatCurrency(null, 0)).toBe(`Up to ${fmt(0)}`);
  });

  it("returns 'Varies' only when both bounds are null", () => {
    expect(formatCurrency(null, null)).toBe("Varies");
  });
});
