import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hmacUserId, slackTsToDate } from "@/lib/slack";
import { sendFailureNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SlackMessage {
  user?: string;
  ts: string;
  text?: string;
  thread_ts?: string;
  reactions?: unknown[];
  subtype?: string;
}

export async function GET() {
  const admin = createAdminClient();
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY!;

  // Fetch all active communities
  const { data: communities, error: commErr } = await admin
    .from("communities")
    .select("id, salt, slack_team_id, status")
    .eq("status", "active");

  if (commErr || !communities) {
    return NextResponse.json({ error: "Failed to fetch communities", detail: commErr?.message }, { status: 500 });
  }

  const results: { community: string; status: string; messages: number; error?: string }[] = [];

  for (const community of communities) {
    // Create ingest log entry
    const { data: logEntry } = await admin
      .from("ingest_log")
      .insert({ community_id: community.id, status: "running" })
      .select("id")
      .single();

    try {
      // Get decrypted token
      const { data: tokenData } = await admin.rpc("get_decrypted_token", {
        p_community_id: community.id,
        p_encryption_key: encryptionKey,
      });

      if (!tokenData || tokenData.length === 0) {
        throw new Error("No token found");
      }

      const accessToken = tokenData[0].access_token;

      // Get opted-in channels
      const { data: channels } = await admin
        .from("channels")
        .select("id, platform_channel_id")
        .eq("community_id", community.id)
        .eq("opted_in", true);

      if (!channels || channels.length === 0) {
        // No channels opted in — skip but log success
        await admin
          .from("ingest_log")
          .update({ status: "success", finished_at: new Date().toISOString(), channels_processed: 0, messages_ingested: 0 })
          .eq("id", logEntry?.id);

        results.push({ community: community.id, status: "skipped", messages: 0 });
        continue;
      }

      let totalMessages = 0;
      const oldest = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000).toString();

      for (const channel of channels) {
        try {
          let cursor: string | undefined;
          let channelMessages = 0;

          do {
            // Fetch message history — metadata only
            const params = new URLSearchParams({
              channel: channel.platform_channel_id,
              oldest,
              limit: "200",
            });
            if (cursor) params.set("cursor", cursor);

            const resp = await fetch(`https://slack.com/api/conversations.history?${params}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await resp.json();

            if (!data.ok) {
              console.error(`Slack API error for channel ${channel.platform_channel_id}: ${data.error}`);
              break;
            }

            const messages: SlackMessage[] = data.messages || [];

            // Extract metadata only — NEVER store text
            const rows = messages
              .filter((msg) => msg.user && !msg.subtype) // Only real user messages
              .map((msg) => ({
                community_id: community.id,
                channel_id: channel.id,
                hashed_user_id: hmacUserId(msg.user!, community.salt),
                ts: slackTsToDate(msg.ts).toISOString(),
                msg_length: (msg.text || "").length,
                has_thread: !!msg.thread_ts,
                has_reaction: !!msg.reactions && msg.reactions.length > 0,
              }));

            if (rows.length > 0) {
              // Batch upsert with ON CONFLICT DO NOTHING (dedup index)
              await admin
                .from("message_events")
                .upsert(rows, { onConflict: "community_id,channel_id,hashed_user_id,ts", ignoreDuplicates: true });

              channelMessages += rows.length;
            }

            cursor = data.response_metadata?.next_cursor || undefined;
          } while (cursor);

          totalMessages += channelMessages;

          // Rate limit: 1.2s between channels
          await new Promise((resolve) => setTimeout(resolve, 1200));
        } catch (channelErr) {
          console.error(`Error ingesting channel ${channel.platform_channel_id}:`, channelErr);
        }
      }

      // Update ingest log
      await admin
        .from("ingest_log")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          channels_processed: channels.length,
          messages_ingested: totalMessages,
        })
        .eq("id", logEntry?.id);

      results.push({ community: community.id, status: "success", messages: totalMessages });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      await admin
        .from("ingest_log")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: errorMsg,
        })
        .eq("id", logEntry?.id);

      results.push({ community: community.id, status: "error", messages: 0, error: errorMsg });

      // Notify on failure
      await sendFailureNotification(
        `Slack ingest failed for community ${community.id}`,
        errorMsg
      ).catch(() => {}); // Don't let notification failure crash the cron
    }
  }

  const hasFailures = results.some((r) => r.status === "error");

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    communities_processed: communities.length,
    results,
    status: hasFailures ? "partial_failure" : "success",
  });
}
