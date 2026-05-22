"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, authLimiter } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { success } = await rateLimit(ip, authLimiter);
  if (!success) {
    redirect("/auth/login?error=Too many login attempts. Please wait a minute.");
  }

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const raw = (formData.get("redirect") as string) || "/dashboard";
  const redirectTo =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  if (!email || !password) {
    redirect("/auth/login?error=Email and password are required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(redirectTo);
}
