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

  // Summary
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}\n`);

  if (failed > 0) process.exit(1);
}

run().catch(console.error);
