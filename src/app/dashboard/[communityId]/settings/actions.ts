"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function toggleChannel(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const channelId = formData.get("channelId") as string;
  const optedIn = formData.get("optedIn") === "true";

  const supabase = await createClient();

  // RLS ensures only the owner can update
  await supabase
    .from("channels")
    .update({ opted_in: optedIn })
    .eq("id", channelId)
    .eq("community_id", communityId);

  revalidatePath(`/dashboard/${communityId}/settings`);
}

export async function regenerateShareToken(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const supabase = await createClient();

  // Generate new UUID share token
  await supabase
    .from("communities")
    .update({ share_token: crypto.randomUUID() })
    .eq("id", communityId);

  revalidatePath(`/dashboard/${communityId}/settings`);
}

export async function disableSharing(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const supabase = await createClient();

  await supabase
    .from("communities")
    .update({ share_token: null })
    .eq("id", communityId);

  revalidatePath(`/dashboard/${communityId}/settings`);
}

export async function revokeIntegration(formData: FormData) {
  const communityId = formData.get("communityId") as string;
  const admin = createAdminClient();

  // Cascade delete via RPC
  await admin.rpc("revoke_community", { p_community_id: communityId });

  redirect("/dashboard");
}
