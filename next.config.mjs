import { withSentryConfig } from "@sentry/nextjs";

// Baseline security headers applied to every response. A nonce-based
// Content-Security-Policy is intentionally deferred to a follow-up (it needs
// per-request nonce wiring for the inline Next.js / Sentry / analytics scripts).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry org/project are set via env vars at build time
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI
  silent: !process.env.CI,

  // Don't widen the source maps upload scope
  widenClientFileUpload: false,

  // Disable Sentry's automatic instrumentation if no DSN
  disableLogger: true,

  // Auto-instrument server components
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
});
