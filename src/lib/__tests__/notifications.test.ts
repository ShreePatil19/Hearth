import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendFailureNotification } from "@/lib/notifications";

describe("sendFailureNotification", () => {
  const originalWebhook = process.env.ALERT_WEBHOOK_URL;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalWebhook === undefined) {
      delete process.env.ALERT_WEBHOOK_URL;
    } else {
      process.env.ALERT_WEBHOOK_URL = originalWebhook;
    }
  });

  it("always logs the alert to console.error", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    await sendFailureNotification("Ingest failed", "boom");
    expect(console.error).toHaveBeenCalledWith("[ALERT] Ingest failed: boom");
  });

  it("does not call fetch when no webhook URL is configured", async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    await sendFailureNotification("t", "d");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a formatted payload to the webhook URL when configured", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/abc";
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);

    await sendFailureNotification("Title", "Details");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/abc");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body.text).toContain("*Title*");
    expect(body.text).toContain("Details");
  });

  it("swallows webhook errors and logs them instead of throwing", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://hooks.example.com/abc";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(sendFailureNotification("t", "d")).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "[ALERT] Failed to send webhook notification:",
      expect.any(Error),
    );
  });
});
