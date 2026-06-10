import { SupabaseClient } from "@supabase/supabase-js";
import {
  getDashboardMetrics,
  getMessageVolume,
  getChannelBreakdown,
  getTopContributors,
  getNewVsReturning,
} from "@/lib/dashboard-queries";

/**
 * Read-only data accessor for the public, unauthenticated shared-dashboard
 * route. It takes only the already-resolved communityId and pins the time
 * window to "30d" internally, so the general dashboard query functions — which
 * accept an arbitrary Range and run against the RLS-bypassing service-role
 * client — are never reachable with caller-controlled arguments from a public
 * surface. The share page calls this and nothing else. See #107.
 */
export async function getSharedDashboardData(
  adminClient: SupabaseClient,
  communityId: string,
) {
  const range = "30d" as const;

  const [metrics, volume, channels, contributors, newVsReturning] = await Promise.all([
    getDashboardMetrics(adminClient, communityId, range),
    getMessageVolume(adminClient, communityId, range),
    getChannelBreakdown(adminClient, communityId, range),
    getTopContributors(adminClient, communityId, range),
    getNewVsReturning(adminClient, communityId, range),
  ]);

  return { metrics, volume, channels, contributors, newVsReturning };
}
