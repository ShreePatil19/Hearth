import { describe, expect, it } from "vitest";
import { SLACK_SCOPES, hmacUserId, slackTsToDate } from "@/lib/slack";

describe("slackTsToDate", () => {
  it("parses a standard Slack ts (seconds.fraction) to the correct epoch", () => {
    expect(slackTsToDate("1234567890.123456").getTime()).toBe(1234567890 * 1000);
  });

  it("parses an integer-only ts", () => {
    expect(slackTsToDate("1700000000").getTime()).toBe(1700000000 * 1000);
  });

  it("throws on a non-numeric ts instead of returning an Invalid Date", () => {
    expect(() => slackTsToDate("not-a-timestamp")).toThrow(/Invalid Slack ts/);
  });

  it("throws on an empty ts", () => {
    expect(() => slackTsToDate("")).toThrow(/Invalid Slack ts/);
  });
});

describe("hmacUserId", () => {
  it("produces a 64-character hex SHA-256 digest", () => {
    const hash = hmacUserId("U123", "salt-a");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same user and salt", () => {
    expect(hmacUserId("U123", "salt-a")).toBe(hmacUserId("U123", "salt-a"));
  });

  it("produces different digests across salts (cross-community isolation)", () => {
    expect(hmacUserId("U123", "salt-a")).not.toBe(hmacUserId("U123", "salt-b"));
  });
});

describe("SLACK_SCOPES", () => {
  it("requests the read/history scopes Hearth needs", () => {
    const scopes = SLACK_SCOPES.split(",");
    expect(scopes).toEqual(
      expect.arrayContaining(["channels:read", "channels:history", "users:read"]),
    );
  });
});
