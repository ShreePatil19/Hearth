"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type MemberStatus = "pending" | "approved" | "rejected";

async function setMemberStatus(
  userId: string,
  status: MemberStatus,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    console.error("setMemberStatus: not signed in");
    return;
  }

  // Defensive admin check (middleware already gates /admin/* but belt-and-braces)
  const { data: me } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!me?.is_admin) {
    console.error("setMemberStatus: forbidden — not admin");
    return;
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
    console.error("setMemberStatus error:", error);
  }

  revalidatePath("/admin/members");
}

export async function approveMember(formData: FormData): Promise<void> {
  const userId = formData.get("user_id") as string;
  if (!userId) return;
  await setMemberStatus(userId, "approved");
}

export async function rejectMember(formData: FormData): Promise<void> {
  const userId = formData.get("user_id") as string;
  if (!userId) return;
  await setMemberStatus(userId, "rejected");
}

export async function reinstateMember(formData: FormData): Promise<void> {
  const userId = formData.get("user_id") as string;
  if (!userId) return;
  await setMemberStatus(userId, "pending");
}
