import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Shield, Link2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChannelToggles } from "./channel-toggles";
import { toggleChannel, regenerateShareToken, disableSharing, revokeIntegration } from "./actions";

interface PageProps {
  params: Promise<{ communityId: string }>;
}

export default async function SettingsPage({ params }: PageProps) {
  const { communityId } = await params;
  const supabase = await createClient();

  const { data: community } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (!community) notFound();

  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .eq("community_id", communityId)
    .order("name");

  const shareUrl = community.share_token
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/share/${community.share_token}`
    : null;

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <Link
        href={`/dashboard/${communityId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-600 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-1">{community.name}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Manage channels, sharing, and integration settings
      </p>

      {/* Channel Opt-in */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-orange-500" />
            Channel Monitoring
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose which channels to monitor. Only metadata is collected — never message content.
            Channels are OFF by default.
          </p>
        </CardHeader>
        <CardContent>
          <ChannelToggles
            channels={channels || []}
            communityId={communityId}
            toggleAction={toggleChannel}
          />
        </CardContent>
      </Card>

      {/* Shareable Link */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-orange-500" />
            Shareable Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Share a read-only view of your dashboard for board reports or team updates.
          </p>
        </CardHeader>
        <CardContent>
          {shareUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-md border px-3 py-2 text-sm bg-muted"
                />
              </div>
              <div className="flex gap-2">
                <form action={regenerateShareToken}>
                  <input type="hidden" name="communityId" value={communityId} />
                  <Button type="submit" variant="outline" size="sm">
                    Regenerate Link
                  </Button>
                </form>
                <form action={disableSharing}>
                  <input type="hidden" name="communityId" value={communityId} />
                  <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                    Disable Sharing
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <form action={regenerateShareToken}>
              <input type="hidden" name="communityId" value={communityId} />
              <Button type="submit" variant="outline" size="sm">
                Enable Shareable Link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-600">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Revoking will permanently delete all data for this community — channels, messages,
            analytics, and the integration. This cannot be undone.
          </p>
        </CardHeader>
        <CardContent>
          <form action={revokeIntegration}>
            <input type="hidden" name="communityId" value={communityId} />
            <Button type="submit" variant="destructive" size="sm">
              Revoke Integration & Delete All Data
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
