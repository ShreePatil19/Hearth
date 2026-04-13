import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/dashboard/metric-card";
import { MessageVolumeChart } from "@/components/dashboard/message-volume-chart";
import { ChannelBreakdownChart } from "@/components/dashboard/channel-breakdown-chart";
import { TopContributorsTable } from "@/components/dashboard/top-contributors-table";
import { NewVsReturningChart } from "@/components/dashboard/new-vs-returning-chart";
import { CohortRetentionTable } from "@/components/dashboard/cohort-retention-table";
import { LurkerRatioCard } from "@/components/dashboard/lurker-ratio-card";
import { TimeRangeSelector } from "@/components/dashboard/time-range-selector";
import {
  getDashboardMetrics,
  getMessageVolume,
  getChannelBreakdown,
  getTopContributors,
  getNewVsReturning,
  getCohortRetention,
  getLurkerRatio,
} from "@/lib/dashboard-queries";

interface PageProps {
  params: Promise<{ communityId: string }>;
  searchParams: Promise<{ range?: string }>;
}

export default async function CommunityDashboardPage({ params, searchParams }: PageProps) {
  const { communityId } = await params;
  const { range: rangeParam } = await searchParams;
  const range = (rangeParam === "7d" || rangeParam === "90d") ? rangeParam : "30d";

  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (!community) notFound();

  // Fetch all metrics in parallel
  const [metrics, volume, channels, contributors, newVsReturning, cohortData, lurkerData] = await Promise.all([
    getDashboardMetrics(supabase, communityId, range),
    getMessageVolume(supabase, communityId, range),
    getChannelBreakdown(supabase, communityId, range),
    getTopContributors(supabase, communityId, range),
    getNewVsReturning(supabase, communityId, range),
    getCohortRetention(supabase, communityId),
    getLurkerRatio(supabase, communityId, range),
  ]);

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{community.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {community.platform} community dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <TimeRangeSelector />
          </Suspense>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/${communityId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <MetricCard title="Total Messages" value={metrics.totalMessages.toLocaleString()} />
        <MetricCard title="Active Users" value={metrics.activeUsers} subtitle={`${metrics.dau} today (DAU)`} />
        <MetricCard title="Thread Usage" value={`${metrics.threadPercentage}%`} subtitle="of messages are threads" />
        <MetricCard
          title="New vs Returning"
          value={newVsReturning.new + newVsReturning.returning}
          subtitle={`${newVsReturning.new} new, ${newVsReturning.returning} returning`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <MessageVolumeChart data={volume} />
        <ChannelBreakdownChart data={channels} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <TopContributorsTable data={contributors} />
        <div className="space-y-6">
          <NewVsReturningChart data={newVsReturning} />
          <LurkerRatioCard totalMembers={lurkerData.totalMembers} activePosters={lurkerData.activePosters} />
        </div>
      </div>

      {/* Cohort Retention */}
      <CohortRetentionTable data={cohortData} />
    </div>
  );
}
