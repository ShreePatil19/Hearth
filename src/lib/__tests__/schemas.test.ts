import { describe, expect, it } from "vitest";
import {
  geoEnum,
  loginSchema,
  opportunityTypeEnum,
  signupSchema,
  taggedFieldsSchema,
} from "@/lib/schemas";

describe("loginSchema", () => {
  it("accepts a valid email and a 6+ character password", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email with a clear message", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid email address");
    }
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "12345" });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts matching passwords of 8+ characters", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      password: "password1",
      confirmPassword: "password1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords on the confirmPassword path", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      password: "password1",
      confirmPassword: "password2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("confirmPassword"));
      expect(issue?.message).toBe("Passwords do not match");
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});

describe("taggedFieldsSchema", () => {
  const minimal = {
    type: "grant",
    description: "A small grant for founders",
    eligibility_summary: null,
    stage: ["seed"],
    industry: ["tech"],
    geo: ["AU"],
    amount_min: null,
    amount_max: null,
    deadline: null,
  };

  it("applies defaults for optional fields", () => {
    const parsed = taggedFieldsSchema.parse(minimal);
    expect(parsed.currency).toBe("AUD");
    expect(parsed.women_focused).toBe(true);
    expect(parsed.equity_free).toBe(true);
    expect(parsed.support_types).toEqual(["funding"]);
    expect(parsed.application_cycle).toBe("ongoing");
    expect(parsed.impact_focus).toBe(false);
    expect(parsed.revenue_required).toBeNull();
  });

  it("rejects an empty stage array", () => {
    expect(taggedFieldsSchema.safeParse({ ...minimal, stage: [] }).success).toBe(false);
  });

  it("rejects a description longer than 500 characters", () => {
    expect(
      taggedFieldsSchema.safeParse({ ...minimal, description: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("rejects a negative amount_min", () => {
    expect(taggedFieldsSchema.safeParse({ ...minimal, amount_min: -1 }).success).toBe(false);
  });
});

describe("enums", () => {
  it("opportunityTypeEnum accepts a known value", () => {
    expect(opportunityTypeEnum.parse("accelerator")).toBe("accelerator");
  });

  it("opportunityTypeEnum rejects an unknown value", () => {
    expect(opportunityTypeEnum.safeParse("unknown").success).toBe(false);
  });

  it("geoEnum accepts AU and rejects an unknown region", () => {
    expect(geoEnum.parse("AU")).toBe("AU");
    expect(geoEnum.safeParse("ZZ").success).toBe(false);
  });
});
