"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-result";
import { parseFormUUID } from "@/lib/form-data";

type MemberStatus = "pending" | "approved" | "rejected";

async function setMemberStatus(
  userId: string,
  status: MemberStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: "You must be signed in." };
  }

  const { data: me } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!me?.is_admin) {
    return { error: "Only admins can manage members." };
  }

  const update: Record<string, unknown> = { status };
  if (status === "approved") {
    update.approved_at = new Date().toISOString();
    update.approved_by = currentUser.id;
  }

  const { error } = await supabase
    .from("user_profiles")
    .update(update)
    .eq("user_id", userId);

  if (error) {
    return { error: `Failed to update member: ${error.message}` };
  }

  revalidatePath("/admin/members");
  return null;
}

export async function approveMember(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = parseFormUUID(formData, "user_id");
  if (!userId) return { error: "Missing or invalid user ID." };
  return setMemberStatus(userId, "approved");
}

export async function rejectMember(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = parseFormUUID(formData, "user_id");
  if (!userId) return { error: "Missing or invalid user ID." };
  return setMemberStatus(userId, "rejected");
}

export async function reinstateMember(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = parseFormUUID(formData, "user_id");
  if (!userId) return { error: "Missing or invalid user ID." };
  return setMemberStatus(userId, "pending");
}

export async function promoteMember(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const userId = parseFormUUID(formData, "user_id");
  if (!userId) return { error: "Missing or invalid user ID." };

  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: "You must be signed in." };
  }

  const { data: me } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!me?.is_admin) {
    return { error: "Only admins can promote members." };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ is_admin: true })
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) {
    return { error: `Failed to promote member: ${error.message}` };
  }

  revalidatePath("/admin/members");
  return null;
}
