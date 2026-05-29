/**
 * Start-of-week (Sunday) for a date, computed in UTC and returned as a
 * YYYY-MM-DD string. UTC keeps the boundary aligned with the UTC timestamps
 * stored in message_events, regardless of the server's local timezone. See #79.
 */
export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}
