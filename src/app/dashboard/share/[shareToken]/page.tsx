import { notFound } from "next/navigation";
import { Flame } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { MetricCard } from "@/components/dashboard/metric-card";
import { MessageVolumeChart } from "@/components/dashboard/message-volume-chart";
import { ChannelBreakdownChart } from "@/components/dashboard/channel-breakdown-chart";
import { TopContributorsTable } from "@/components/dashboard/top-contributors-table";
import { NewVsReturningChart } from "@/components/dashboard/new-vs-returning-chart";
import {
  getDashboardMetrics,
  getMessageVolume,
  getChannelBreakdown,
  getTopContributors,
  getNewVsReturning,
} from "@/lib/dashboard-queries";

interface PageProps {
  params: Promise<{ shareToken: string }>;
}

export default async function SharedDashboardPage({ params }: PageProps) {
  const { shareToken } = await params;
  const admin = createAdminClient();

  // Resolve share token via SECURITY DEFINER RPC
  const { data: shared } = await admin.rpc("get_shared_dashboard", {
    p_share_token: shareToken,
  });

  if (!shared || shared.length === 0) notFound();

  const { community_id: communityId, community_name: communityName } = shared[0];
  const range = "30d" as const;

  // Fetch metrics using admin client (bypasses RLS)
  const [metrics, volume, channels, contributors, newVsReturning] = await Promise.all([
    getDashboardMetrics(admin, communityId, range),
    getMessageVolume(admin, communityId, range),
    getChannelBreakdown(admin, communityId, range),
    getTopContributors(admin, communityId, range),
    getNewVsReturning(admin, communityId, range),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white py-4">
        <div className="container flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold">Shared Dashboard</span>
              <span className="mx-2 text-muted-foreground">—</span>
              <span className="text-sm text-muted-foreground">{communityName}</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Powered by Hearth</span>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <MetricCard title="Total Messages" value={metrics.totalMessages.toLocaleString()} />
          <MetricCard title="Active Users" value={metrics.activeUsers} />
          <MetricCard title="Thread Usage" value={`${metrics.threadPercentage}%`} />
          <MetricCard
            title="New vs Returning"
            value={newVsReturning.new + newVsReturning.returning}
            subtitle={`${newVsReturning.new} new, ${newVsReturning.returning} returning`}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <MessageVolumeChart data={volume} />
          <ChannelBreakdownChart data={channels} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <TopContributorsTable data={contributors} />
          <NewVsReturningChart data={newVsReturning} />
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Read-only view &middot; Data refreshed daily &middot; No message content stored
      </footer>
    </div>
  );
}
