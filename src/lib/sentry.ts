import * as Sentry from "@sentry/react";

import { config } from "./config";
import { scrubWebBreadcrumb, scrubWebSentryEvent, scrubWebSentryTransaction } from "./privacy";

/**
 * Same options as the phone (sendDefaultPii off, 20% traces, shared scrubber), reusing the
 * phone's Sentry project with environment "web". `tracePropagationTargets: []` keeps
 * sentry-trace/baggage headers off Supabase and Railway requests — the backend's CORS
 * allow-list does not include them and preflights would fail.
 */
export function initSentry(): void {
  if (!config.sentryDsn) {
    return;
  }
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    release: config.release || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [],
    beforeBreadcrumb: scrubWebBreadcrumb,
    beforeSend: scrubWebSentryEvent,
    beforeSendTransaction: scrubWebSentryTransaction,
  });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}
