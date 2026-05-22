/**
 * Multi-tenant RLS test — verifies that User A cannot see User B's data.
 * Run: npx tsx scripts/test-rls.ts
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log("\n🔒 Running Multi-Tenant RLS Tests\n");

  // 1. Anon user should NOT see communities
  console.log("Test 1: Anonymous user cannot see communities");
  const { data: anonComms } = await anon.from("communities").select("*");
  assert(
    !anonComms || anonComms.length === 0,
    "Anonymous user sees 0 communities"
  );

  // 2. Anon user should NOT see message_events
  console.log("\nTest 2: Anonymous user cannot see message events");
  const { data: anonEvents } = await anon.from("message_events").select("*").limit(1);
  assert(
    !anonEvents || anonEvents.length === 0,
    "Anonymous user sees 0 message events"
  );

  // 3. Anon user should NOT see integrations
  console.log("\nTest 3: Anonymous user cannot see integrations");
  const { data: anonInt } = await anon.from("integrations").select("*");
  assert(
    !anonInt || anonInt.length === 0,
    "Anonymous user sees 0 integrations"
  );

  // 4. Anon user should NOT see channels
  console.log("\nTest 4: Anonymous user cannot see channels");
  const { data: anonCh } = await anon.from("channels").select("*").limit(1);
  assert(
    !anonCh || anonCh.length === 0,
    "Anonymous user sees 0 channels"
  );

  // 5. Anon user should NOT see ingest_log
  console.log("\nTest 5: Anonymous user cannot see ingest logs");
  const { data: anonLog } = await anon.from("ingest_log").select("*");
  assert(
    !anonLog || anonLog.length === 0,
    "Anonymous user sees 0 ingest logs"
  );

  // 6. Anon user CAN still see opportunities (Phase 1 public data)
  console.log("\nTest 6: Anonymous user CAN see funding opportunities");
  const { data: anonOpps } = await anon.from("opportunities").select("*").limit(1);
  assert(
    anonOpps !== null && anonOpps.length > 0,
    "Anonymous user can read public opportunities"
  );

  // 7. Admin (service_role) CAN see everything
  console.log("\nTest 7: Service role can see all data");
  const { data: adminComms } = await admin.from("communities").select("*");
  assert(
    adminComms !== null && adminComms.length > 0,
    `Service role sees ${adminComms?.length || 0} communities`
  );

  const { data: adminEvents } = await admin.from("message_events").select("*").limit(1);
  assert(
    adminEvents !== null && adminEvents.length > 0,
    "Service role can read message events"
  );

  // ============================================================
  // 8. user_profiles UPDATE policy hardening (migration 005, issue #17)
  // Creates two ephemeral auth users, exercises the policies +
  // immutability trigger, cleans up at the end.
  // ============================================================
  console.log("\nTest 8: user_profiles RLS hardening (migration 005)");

  const ts = Date.now();
  const userAEmail = `rls-test-${ts}-a@hearth.test`;
  const userBEmail = `rls-test-${ts}-b@hearth.test`;
  const password = `Test-${ts}-rls-Pw!9`;

  const { data: createA, error: createAErr } = await admin.auth.admin.createUser({
    email: userAEmail,
    password,
    email_confirm: true,
  });
  const { data: createB, error: createBErr } = await admin.auth.admin.createUser({
    email: userBEmail,
    password,
    email_confirm: true,
  });

  if (createAErr || createBErr || !createA.user || !createB.user) {
    console.error(`  ❌ FAIL: could not create test users — ${createAErr?.message ?? createBErr?.message ?? "unknown"}`);
    failed++;
  } else {
    const userAId = createA.user.id;
    const userBId = createB.user.id;

    try {
      // Bring userA out of pending so admin operations are realistic
      await admin.from("user_profiles").update({ status: "approved" }).eq("user_id", userAId);

      // Sign in as userA → user-scoped client respects RLS + triggers
      const userAClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { error: signInErr } = await userAClient.auth.signInWithPassword({
        email: userAEmail,
        password,
      });
      assert(signInErr === null, "User A can sign in");

      // Non-admin self-promote attempt → trigger raises
      const { error: promoteErr } = await userAClient
        .from("user_profiles")
        .update({ is_admin: true })
        .eq("user_id", userAId);
      assert(
        promoteErr !== null,
        "Non-admin cannot self-promote to is_admin (trigger blocks)",
      );

      // Non-admin self-status-change → trigger raises
      const { error: statusErr } = await userAClient
        .from("user_profiles")
        .update({ status: "approved" })
        .eq("user_id", userAId);
      assert(
        statusErr !== null,
        "Non-admin cannot change own status (trigger blocks)",
      );

      // Non-admin can update own display_name (self_update RLS + trigger allows)
      const { error: nameErr } = await userAClient
        .from("user_profiles")
        .update({ display_name: "User A renamed" })
        .eq("user_id", userAId);
      assert(nameErr === null, "Non-admin can change own display_name");

      // Non-admin updating another user's row → RLS denies, 0 rows touched
      const { data: hackRows } = await userAClient
        .from("user_profiles")
        .update({ display_name: "hacked" })
        .eq("user_id", userBId)
        .select();
      assert(
        !hackRows || hackRows.length === 0,
        "Non-admin cannot update another user's profile (RLS blocks)",
      );

      // Service role can flip is_admin on user B (admin path still works)
      const { error: adminFlipErr } = await admin
        .from("user_profiles")
        .update({ is_admin: true })
        .eq("user_id", userBId);
      assert(adminFlipErr === null, "service_role can flip is_admin on another user");

      await userAClient.auth.signOut();
    } finally {
      // Cleanup — best-effort; auth.users CASCADE removes the profile row.
      await admin.auth.admin.deleteUser(userAId).catch(() => {});
      await admin.auth.admin.deleteUser(userBId).catch(() => {});
    }
  }

  // Summary
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}\n`);

  if (failed > 0) process.exit(1);
}

run().catch(console.error);
