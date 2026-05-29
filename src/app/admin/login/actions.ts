"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, authLimiter } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/schemas";
import { firstZodError, formDataToObject } from "@/lib/form-data";

export async function adminLogin(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { success } = await rateLimit(ip, authLimiter);
  if (!success) {
    redirect("/admin/login?error=Too many login attempts. Please wait a minute.");
  }

  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    redirect(`/admin/login?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Generic message: do not leak account existence or confirmation state
    // (user enumeration). See issue #68.
    redirect("/admin/login?error=Invalid email or password");
  }

  redirect("/admin");
}
