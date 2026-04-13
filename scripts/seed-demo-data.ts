/**
 * Demo data seed script — generates 90 days of realistic Slack community data.
 * Run: npx tsx src/lib/seed-demo-data.ts
 *
 * Creates a demo community with channels and message events.
 * No real Slack connection needed.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_CHANNELS = [
  { name: "general", members: 245, private: false },
  { name: "introductions", members: 180, private: false },
  { name: "funding-opportunities", members: 156, private: false },
  { name: "pitch-practice", members: 89, private: false },
  { name: "mentorship", members: 67, private: true },
];

const DEMO_USERS = 120; // Total unique users
const DAYS = 90;
const SALT = crypto.randomBytes(32).toString("hex");

function hashUser(userId: string): string {
  return crypto.createHmac("sha256", SALT).update(userId).digest("hex");
}

function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

async function seed() {
  console.log("Seeding demo data...\n");

  // Get or create a demo user in auth
  const demoEmail = "demo@hearth.community";
  let userId: string;

  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === demoEmail);

  if (existing) {
    userId = existing.id;
    console.log(`Using existing demo user: ${userId}`);
  } else {
    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: "demo-hearth-2026",
      email_confirm: true,
    });
    if (error || !newUser.user) {
      console.error("Failed to create demo user:", error);
      process.exit(1);
    }
    userId = newUser.user.id;
    console.log(`Created demo user: ${userId}`);
  }

  // Create demo community
  const { data: community, error: commErr } = await supabase
    .from("communities")
    .upsert(
      {
        name: "Women Founders AU",
        platform: "slack",
        owner_user_id: userId,
        slack_team_id: "DEMO_TEAM_001",
        salt: SALT,
        status: "active",
      },
      { onConflict: "slack_team_id" }
    )
    .select("id")
    .single();

  if (commErr || !community) {
    console.error("Failed to create community:", commErr);
    process.exit(1);
  }
  console.log(`Community: ${community.id}`);

  // Create channels
  const channelIds: Record<string, string> = {};
  for (const ch of DEMO_CHANNELS) {
    const { data, error } = await supabase
      .from("channels")
      .upsert(
        {
          community_id: community.id,
          platform_channel_id: `DEMO_${ch.name.toUpperCase()}`,
          name: ch.name,
          is_private: ch.private,
          opted_in: true,
          member_count: ch.members,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "community_id,platform_channel_id" }
      )
      .select("id")
      .single();

    if (data) channelIds[ch.name] = data.id;
    if (error) console.error(`Channel ${ch.name} error:`, error);
  }
  console.log(`Created ${Object.keys(channelIds).length} channels`);

  // Generate hashed user IDs
  const userHashes = Array.from({ length: DEMO_USERS }, (_, i) =>
    hashUser(`USER_${i.toString().padStart(3, "0")}`)
  );

  // Power users (top 10%) post way more
  const powerUsers = userHashes.slice(0, Math.floor(DEMO_USERS * 0.1));
  const regularUsers = userHashes.slice(Math.floor(DEMO_USERS * 0.1), Math.floor(DEMO_USERS * 0.4));
  const lurkers = userHashes.slice(Math.floor(DEMO_USERS * 0.4));

  // Generate 90 days of messages
  const now = new Date();
  const allMessages: {
    community_id: string;
    channel_id: string;
    hashed_user_id: string;
    ts: string;
    msg_length: number;
    has_thread: boolean;
    has_reaction: boolean;
  }[] = [];

  for (let day = DAYS; day >= 0; day--) {
    const date = new Date(now);
    date.setDate(date.getDate() - day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Simulate growth: more messages as community grows
    const growthFactor = 1 + (DAYS - day) / DAYS * 0.5;
    const baseMessages = isWeekend ? 15 : 45;
    const dayMessages = Math.floor(baseMessages * growthFactor * (0.7 + Math.random() * 0.6));

    for (let m = 0; m < dayMessages; m++) {
      // Pick user type with weights: power 40%, regular 40%, lurker 20%
      const userType = weightedRandom([40, 40, 20]);
      const userPool = userType === 0 ? powerUsers : userType === 1 ? regularUsers : lurkers;
      const user = userPool[Math.floor(Math.random() * userPool.length)];

      // Pick channel with weights: general most active
      const channelWeights = [35, 20, 25, 12, 8];
      const channelIdx = weightedRandom(channelWeights);
      const channelName = DEMO_CHANNELS[channelIdx].name;
      const channelId = channelIds[channelName];

      if (!channelId) continue;

      // Random time during the day (bias toward business hours)
      const hour = Math.floor(Math.random() * 14) + 7; // 7am - 9pm
      const minute = Math.floor(Math.random() * 60);
      const ts = new Date(date);
      ts.setHours(hour, minute, Math.floor(Math.random() * 60));

      allMessages.push({
        community_id: community.id,
        channel_id: channelId,
        hashed_user_id: user,
        ts: ts.toISOString(),
        msg_length: Math.floor(Math.random() * 300) + 10,
        has_thread: Math.random() < 0.25, // 25% are threads
        has_reaction: Math.random() < 0.3, // 30% have reactions
      });
    }
  }

  console.log(`Generated ${allMessages.length} messages over ${DAYS} days`);

  // Batch insert (500 at a time)
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < allMessages.length; i += BATCH) {
    const batch = allMessages.slice(i, i + BATCH);
    const { error } = await supabase.from("message_events").upsert(batch, {
      onConflict: "community_id,channel_id,hashed_user_id,ts",
      ignoreDuplicates: true,
    });
    if (error) {
      console.error(`Batch insert error at ${i}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Inserted ${inserted} messages`);

  // Create ingest log entry
  await supabase.from("ingest_log").insert({
    community_id: community.id,
    status: "success",
    finished_at: new Date().toISOString(),
    channels_processed: DEMO_CHANNELS.length,
    messages_ingested: inserted,
  });

  console.log("\n✅ Demo data seeded successfully!");
  console.log(`\nLogin credentials:`);
  console.log(`  Email: ${demoEmail}`);
  console.log(`  Password: demo-hearth-2026`);
  console.log(`\nCommunity: Women Founders AU`);
  console.log(`Messages: ${inserted} over ${DAYS} days`);
}

seed().catch(console.error);
