import { NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public share links — no auth required
  if (pathname.startsWith("/dashboard/share/")) {
    return NextResponse.next();
  }

  // Dashboard routes — require auth
  if (pathname.startsWith("/dashboard")) {
    const { supabase, response } = createMiddlewareClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // Cron routes — require CRON_SECRET
  if (pathname.startsWith("/api/cron/")) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/cron/:path*"],
};
