import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public share links for community dashboards — no auth required
  if (pathname.startsWith("/dashboard/share/")) {
    return NextResponse.next();
  }

  // Cron routes — require CRON_SECRET (Bearer header)
  if (pathname.startsWith("/api/cron/")) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  // Gated routes — require auth AND approved profile
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    const { supabase, response } = createMiddlewareClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Check approval status + admin flag from user_profiles
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("status, is_admin")
      .eq("user_id", user.id)
      .maybeSingle();

    // No profile or not yet approved → pending review page
    if (!profile || profile.status !== "approved") {
      return NextResponse.redirect(new URL("/auth/pending", request.url));
    }

    // Admin-only routes require is_admin=true; non-admins go back to dashboard
    if (pathname.startsWith("/admin") && !profile.is_admin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/cron/:path*"],
};
