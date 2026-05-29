"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, authLimiter } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { firstZodError, formDataToObject, parseFormString } from "@/lib/form-data";

export async function login(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { success } = await rateLimit(ip, authLimiter);
  if (!success) {
    redirect("/auth/login?error=Too many login attempts. Please wait a minute.");
  }

  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    redirect(`/auth/login?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }
  const { email, password } = parsed.data;

  const raw = parseFormString(formData, "redirect") ?? "/dashboard";
  const redirectTo =
    raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message: do not leak whether the account exists or its
    // confirmation state (user enumeration). See issue #68.
    redirect("/auth/login?error=Invalid email or password");
  }

  redirect(redirectTo);
}
