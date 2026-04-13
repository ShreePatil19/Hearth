import { notFound } from "next/navigation";
import Link from "next/link";
import { Settings, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PageProps {
  params: Promise<{ communityId: string }>;
}

export default async function CommunityDashboardPage({ params }: PageProps) {
  const { communityId } = await params;
  const supabase = await createClient();

  // Fetch community (RLS enforces ownership)
  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (!community) notFound();

  // Fetch basic stats
  const { count: channelCount } = await supabase
    .from("channels")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId);

  const { count: optedInCount } = await supabase
    .from("channels")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId)
    .eq("opted_in", true);

  const { count: messageCount } = await supabase
    .from("message_events")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId);

  // Get latest ingest
  const { data: lastIngest } = await supabase
    .from("ingest_log")
    .select("*")
    .eq("community_id", communityId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{community.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {community.platform} &middot; {community.status}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/${communityId}/settings`}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{channelCount || 0}</p>
            <p className="text-xs text-muted-foreground">{optedInCount || 0} opted in</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Messages Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{messageCount || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastIngest ? (
              <>
                <p className="text-sm font-medium">
                  {new Date(lastIngest.finished_at || lastIngest.started_at).toLocaleDateString("en-AU")}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{lastIngest.status}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                First sync at 2am UTC
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold capitalize">{community.status}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts placeholder */}
      {messageCount && messageCount > 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">Dashboard charts coming in Day 4</p>
          <p className="text-sm mt-1">DAU/WAU/MAU, channel volume, top contributors, cohort retention</p>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 mb-4">
            <Clock className="h-6 w-6 text-orange-500" />
          </div>
          <h3 className="font-semibold mb-1">Waiting for first data sync</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Make sure you&apos;ve opted in at least one channel in{" "}
            <Link href={`/dashboard/${communityId}/settings`} className="text-orange-600 hover:underline">
              Settings
            </Link>
            . Data syncs daily at 2am UTC.
          </p>
        </Card>
      )}
    </div>
  );
}
