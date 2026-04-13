import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate CSRF state
  const storedState = request.cookies.get("slack_oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/dashboard?error=Invalid OAuth state", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?error=No authorization code", request.url)
    );
  }

  // Get current user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Exchange code for token
  const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/slack/callback`,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.ok) {
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(tokenData.error || "Token exchange failed")}`, request.url)
    );
  }

  const accessToken = tokenData.access_token;
  const teamId = tokenData.team?.id;
  const teamName = tokenData.team?.name;
  const scopes = tokenData.scope?.split(",") || [];

  const admin = createAdminClient();

  // Create or update community
  const { data: existingCommunity } = await admin
    .from("communities")
    .select("id")
    .eq("slack_team_id", teamId)
    .single();

  let communityId: string;

  if (existingCommunity) {
    communityId = existingCommunity.id;
    await admin
      .from("communities")
      .update({ status: "active", name: teamName || "Slack Community" })
      .eq("id", communityId);
  } else {
    const { data: newCommunity, error: insertError } = await admin
      .from("communities")
      .insert({
        name: teamName || "Slack Community",
        platform: "slack",
        owner_user_id: user.id,
        slack_team_id: teamId,
      })
      .select("id")
      .single();

    if (insertError || !newCommunity) {
      return NextResponse.redirect(
        new URL(`/dashboard?error=Failed to create community`, request.url)
      );
    }
    communityId = newCommunity.id;
  }

  // Store encrypted token via RPC
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY!;
  await admin.rpc("store_integration", {
    p_community_id: communityId,
    p_platform: "slack",
    p_access_token: accessToken,
    p_scopes: scopes,
    p_slack_team_id: teamId,
    p_slack_team_name: teamName,
    p_installed_by: user.id,
    p_encryption_key: encryptionKey,
  });

  // Sync channels from Slack
  try {
    const channelsResponse = await fetch(
      "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const channelsData = await channelsResponse.json();

    if (channelsData.ok && channelsData.channels) {
      const channelRows = channelsData.channels.map((ch: { id: string; name: string; is_private: boolean; num_members?: number }) => ({
        community_id: communityId,
        platform_channel_id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
        opted_in: false, // Default OFF — privacy first
        member_count: ch.num_members || null,
        synced_at: new Date().toISOString(),
      }));

      await admin
        .from("channels")
        .upsert(channelRows, { onConflict: "community_id,platform_channel_id" });
    }
  } catch (e) {
    console.error("Failed to sync channels:", e);
  }

  // Clear state cookie and redirect to settings
  const response = NextResponse.redirect(
    new URL(`/dashboard/${communityId}/settings`, request.url)
  );
  response.cookies.delete("slack_oauth_state");

  return response;
}
