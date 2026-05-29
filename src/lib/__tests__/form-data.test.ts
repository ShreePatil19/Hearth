import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  firstZodError,
  formDataToObject,
  parseFormBoolean,
  parseFormString,
  parseFormUUID,
} from "@/lib/form-data";

const fd = (entries: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
};

describe("parseFormString", () => {
  it("returns the string value when present and non-empty", () => {
    expect(parseFormString(fd({ name: "Ada" }), "name")).toBe("Ada");
  });

  it("returns null when the key is missing", () => {
    expect(parseFormString(fd({}), "name")).toBeNull();
  });

  it("returns null when the value is an empty string", () => {
    expect(parseFormString(fd({ name: "" }), "name")).toBeNull();
  });
});

describe("parseFormUUID", () => {
  const uuid = "00000000-0000-4000-8000-000000000000";

  it("returns the value when it is a valid UUID", () => {
    expect(parseFormUUID(fd({ id: uuid }), "id")).toBe(uuid);
  });

  it("returns null when the value is not a UUID", () => {
    expect(parseFormUUID(fd({ id: "not-a-uuid" }), "id")).toBeNull();
  });

  it("returns null when the key is missing", () => {
    expect(parseFormUUID(fd({}), "id")).toBeNull();
  });
});

describe("parseFormBoolean", () => {
  it("returns true only for the literal string 'true'", () => {
    expect(parseFormBoolean(fd({ flag: "true" }), "flag")).toBe(true);
  });

  it("returns false for 'false'", () => {
    expect(parseFormBoolean(fd({ flag: "false" }), "flag")).toBe(false);
  });

  it("returns false for any other truthy-looking value", () => {
    expect(parseFormBoolean(fd({ flag: "1" }), "flag")).toBe(false);
  });

  it("returns false when the key is missing", () => {
    expect(parseFormBoolean(fd({}), "flag")).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("maps all string entries into a plain object", () => {
    expect(formDataToObject(fd({ a: "1", b: "2" }))).toEqual({ a: "1", b: "2" });
  });

  it("returns an empty object for empty form data", () => {
    expect(formDataToObject(fd({}))).toEqual({});
  });

  it("ignores non-string (file) entries", () => {
    const f = new FormData();
    f.append("name", "Ada");
    f.append("file", new Blob(["data"]), "f.txt");
    expect(formDataToObject(f)).toEqual({ name: "Ada" });
  });
});

describe("firstZodError", () => {
  it("returns the first issue message from a ZodError", () => {
    const result = z.string().email("Invalid email").safeParse("nope");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(firstZodError(result.error)).toBe("Invalid email");
    }
  });

  it("falls back to the default message when there are no issues", () => {
    expect(firstZodError(new z.ZodError([]))).toBe("Invalid input");
  });

  it("uses a custom fallback when provided", () => {
    expect(firstZodError(new z.ZodError([]), "Bad input")).toBe("Bad input");
  });
});
