import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, authLimiter } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const { success } = await rateLimit(ip, authLimiter);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  let redirectTo = searchParams.get("redirect") || "/dashboard";
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    redirectTo = "/dashboard";
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Don't silently proceed to /dashboard with no session (the user would
      // hit a confusing redirect loop). Surface a generic failure. See #85.
      console.error("[auth/callback] exchangeCodeForSession failed:", error);
      return NextResponse.redirect(
        new URL("/auth/login?error=Sign-in link expired. Please try again.", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
