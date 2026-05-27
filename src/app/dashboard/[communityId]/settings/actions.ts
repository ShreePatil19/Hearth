"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/action-result";
import { parseFormBoolean, parseFormUUID } from "@/lib/form-data";

async function requireOwner(
  communityId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) return { error: "You must be signed in." };

  const { data: community } = await supabase
    .from("communities")
    .select("owner_user_id")
    .eq("id", communityId)
    .single();

  if (!community || community.owner_user_id !== user.id) {
    return { error: "Only the community owner can change settings." };
  }

  return null;
}

export async function toggleChannel(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const communityId = parseFormUUID(formData, "communityId");
  const channelId = parseFormUUID(formData, "channelId");
  if (!communityId || !channelId) {
    return { error: "Invalid request: community or channel ID missing." };
  }
  const optedIn = parseFormBoolean(formData, "optedIn");

  const authError = await requireOwner(communityId);
  if (authError) return authError;

  const supabase = await createClient();
  const { error } = await supabase
    .from("channels")
    .update({ opted_in: optedIn })
    .eq("id", channelId)
    .eq("community_id", communityId);

  if (error) return { error: `Failed to update channel: ${error.message}` };

  revalidatePath(`/dashboard/${communityId}/settings`);
  return null;
}

export async function regenerateShareToken(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const communityId = parseFormUUID(formData, "communityId");
  if (!communityId) return { error: "Invalid request: community ID missing." };

  const authError = await requireOwner(communityId);
  if (authError) return authError;

  const supabase = await createClient();
  const { error } = await supabase
    .from("communities")
    .update({ share_token: crypto.randomUUID() })
    .eq("id", communityId);

  if (error) return { error: `Failed to regenerate token: ${error.message}` };

  revalidatePath(`/dashboard/${communityId}/settings`);
  return null;
}

export async function disableSharing(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const communityId = parseFormUUID(formData, "communityId");
  if (!communityId) return { error: "Invalid request: community ID missing." };

  const authError = await requireOwner(communityId);
  if (authError) return authError;

  const supabase = await createClient();
  const { error } = await supabase
    .from("communities")
    .update({ share_token: null })
    .eq("id", communityId);

  if (error) return { error: `Failed to disable sharing: ${error.message}` };

  revalidatePath(`/dashboard/${communityId}/settings`);
  return null;
}

export async function revokeIntegration(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const communityId = parseFormUUID(formData, "communityId");
  if (!communityId) return { error: "Invalid request: community ID missing." };

  const authError = await requireOwner(communityId);
  if (authError) return authError;

  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_community", { p_community_id: communityId });

  if (error) return { error: `Failed to revoke integration: ${error.message}` };

  redirect("/dashboard");
}
