import { describe, expect, it } from "vitest";
import { cn, formatCurrency, generateSlug } from "@/lib/utils";

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

  it("honours a non-default currency code", () => {
    const usd = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(1000);
    expect(formatCurrency(1000, null, "USD")).toBe(usd);
  });
});

describe("cn", () => {
  it("joins multiple class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("merges conflicting tailwind classes, keeping the last", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("resolves conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});

describe("generateSlug", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("appends the organisation when provided", () => {
    expect(generateSlug("Seed Fund", "Acme")).toBe("seed-fund-acme");
  });

  it("ignores a null organisation", () => {
    expect(generateSlug("Seed Fund", null)).toBe("seed-fund");
  });

  it("strips diacritics", () => {
    expect(generateSlug("Café Münch")).toBe("cafe-munch");
  });

  it("collapses runs of non-alphanumerics and trims edge hyphens", () => {
    expect(generateSlug("  a@@@b!  ")).toBe("a-b");
  });

  it("truncates to 120 characters", () => {
    expect(generateSlug("x".repeat(200)).length).toBe(120);
  });
});
