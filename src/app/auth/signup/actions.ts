"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, authLimiter } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/schemas";
import { firstZodError, formDataToObject } from "@/lib/form-data";

export async function signup(formData: FormData) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { success } = await rateLimit(ip, authLimiter);
  if (!success) {
    redirect("/auth/signup?error=Too many signup attempts. Please wait a minute.");
  }

  const parsed = signupSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    redirect(`/auth/signup?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/auth/login?message=Check your email to confirm your account");
}
