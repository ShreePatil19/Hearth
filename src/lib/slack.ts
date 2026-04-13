import crypto from "crypto";

/**
 * HMAC-hash a Slack user ID with a per-community salt.
 * Cross-community correlation is impossible by design.
 */
export function hmacUserId(userId: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(userId).digest("hex");
}

/**
 * Convert Slack's "1234567890.123456" timestamp to a JS Date.
 */
export function slackTsToDate(ts: string): Date {
  const [seconds] = ts.split(".");
  return new Date(parseInt(seconds, 10) * 1000);
}

/**
 * Slack OAuth scopes required by Hearth.
 */
export const SLACK_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "users:read",
].join(",");
