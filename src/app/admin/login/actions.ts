"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/schemas";
import { firstZodError, formDataToObject } from "@/lib/form-data";

export async function adminLogin(formData: FormData) {
  const parsed = loginSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    redirect(`/admin/login?error=${encodeURIComponent(firstZodError(parsed.error))}`);
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/admin/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin");
}
