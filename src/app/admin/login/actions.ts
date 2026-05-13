"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function adminLogin(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/admin/login?error=Email and password are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/admin/login?error=${encodeURIComponent(error.message)}`);
  }

  // Middleware will gate /admin and bounce non-admins to /dashboard — no need
  // to re-check here. Redirect always lands them on /admin, and the middleware
  // handles auth + status + is_admin checks.
  redirect("/admin");
}
