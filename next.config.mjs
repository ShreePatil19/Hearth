import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {};

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
