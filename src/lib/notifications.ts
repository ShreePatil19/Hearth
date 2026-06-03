/**
 * Notification utility for ingest failure alerts.
 *
 * Uses console.error for Vercel Runtime Logs (visible in dashboard).
 * When a webhook URL is configured, also sends to Slack/Discord.
 *
 * To enable Slack webhooks, add ALERT_WEBHOOK_URL to env vars.
 * Get a webhook URL from: https://api.slack.com/messaging/webhooks
 */

// Outbound alert webhooks may only target these hosts, over https. This keeps
// a misconfigured or attacker-controlled ALERT_WEBHOOK_URL from being used to
// reach internal/metadata endpoints (SSRF). Add a host here if you adopt
// another webhook provider.
const ALLOWED_WEBHOOK_HOSTS = new Set([
  "hooks.slack.com",
  "discord.com",
  "discordapp.com",
]);

export async function sendFailureNotification(
  title: string,
  details: string
): Promise<void> {
  // Always log to Vercel Runtime Logs
  console.error(`[ALERT] ${title}: ${details}`);

  // If a webhook URL is configured, send there too
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  // SSRF guard: only POST to an https webhook on an allowlisted host.
  let webhook: URL;
  try {
    webhook = new URL(webhookUrl);
  } catch {
    console.error("[ALERT] ALERT_WEBHOOK_URL is not a valid URL; skipping webhook send");
    return;
  }
  if (webhook.protocol !== "https:" || !ALLOWED_WEBHOOK_HOSTS.has(webhook.hostname)) {
    console.error(
      `[ALERT] ALERT_WEBHOOK_URL host not allowed (${webhook.protocol}//${webhook.hostname}); skipping webhook send`
    );
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${title}*\n${details}\n_${new Date().toISOString()}_`,
      }),
    });
  } catch (err) {
    console.error("[ALERT] Failed to send webhook notification:", err);
  }
}
