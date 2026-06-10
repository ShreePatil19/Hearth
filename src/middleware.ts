import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

/**
 * Constant-time comparison for the cron bearer token. Both inputs are hashed to
 * a fixed-length digest first, so the compare loop never reveals how much of
 * CRON_SECRET matched (no early-exit timing side channel). Uses Web Crypto so it
 * runs on both the Edge and Node runtimes. See #71.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) {
    diff |= va[i] ^ vb[i];
  }
  return diff === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public share links for community dashboards — no auth required
  if (pathname.startsWith("/dashboard/share/")) {
    return NextResponse.next();
  }

  // Admin sign-in page is public (the only un-gated path under /admin)
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Cron routes — require CRON_SECRET (Bearer header)
  if (pathname.startsWith("/api/cron/")) {
    const cronSecret = process.env.CRON_SECRET;

    // A missing secret means the deployment is misconfigured. Fail closed, but
    // make it loud (console.error reaches Sentry) so a forgotten env var is
    // noticed rather than silently 401-ing every scheduled run. See #71.
    if (!cronSecret) {
      console.error("[middleware] CRON_SECRET is not set; rejecting cron request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || !(await timingSafeEqual(authHeader, `Bearer ${cronSecret}`))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  // Gated routes — require auth AND approved profile
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/opportunities") ||
    pathname.startsWith("/opp/")
  ) {
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
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/opportunities/:path*",
    "/opp/:path*",
    "/api/cron/:path*",
  ],
};
