/**
 * Notification utility for ingest failure alerts.
 *
 * Uses console.error for Vercel Runtime Logs (visible in dashboard).
 * When a webhook URL is configured, also sends to Slack/Discord.
 *
 * To enable Slack webhooks, add ALERT_WEBHOOK_URL to env vars.
 * Get a webhook URL from: https://api.slack.com/messaging/webhooks
 */

export async function sendFailureNotification(
  title: string,
  details: string
): Promise<void> {
  // Always log to Vercel Runtime Logs
  console.error(`[ALERT] ${title}: ${details}`);

  // If a webhook URL is configured, send there too
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

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
