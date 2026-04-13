"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !password) {
    redirect("/auth/signup?error=Email and password are required");
  }

  if (password !== confirmPassword) {
    redirect("/auth/signup?error=Passwords do not match");
  }

  if (password.length < 6) {
    redirect("/auth/signup?error=Password must be at least 6 characters");
  }

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
