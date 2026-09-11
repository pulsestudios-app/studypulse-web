/** Public build-time configuration. Every value is visible in the shipped bundle. */
function read(value: string | undefined): string {
  return (value ?? "").trim();
}

export const config = {
  supabaseUrl: read(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: read(import.meta.env.VITE_SUPABASE_ANON_KEY),
  backendUrl: read(import.meta.env.VITE_BACKEND_URL).replace(/\/+$/, ""),
  appKey: read(import.meta.env.VITE_APP_KEY),
  posthogKey: read(import.meta.env.VITE_POSTHOG_KEY),
  posthogHost: read(import.meta.env.VITE_POSTHOG_HOST) || "https://us.i.posthog.com",
  sentryDsn: read(import.meta.env.VITE_SENTRY_DSN),
  sentryEnvironment: read(import.meta.env.VITE_SENTRY_ENVIRONMENT) || "web",
  release: read(import.meta.env.VITE_RELEASE),
} as const;

export const missingConfig: string[] = [
  ["VITE_SUPABASE_URL", config.supabaseUrl],
  ["VITE_SUPABASE_ANON_KEY", config.supabaseAnonKey],
  ["VITE_BACKEND_URL", config.backendUrl],
  ["VITE_APP_KEY", config.appKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);
