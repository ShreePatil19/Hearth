import { describe, expect, it } from "vitest";
import { slackTsToDate } from "@/lib/slack";

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
