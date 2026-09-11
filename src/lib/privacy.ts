/**
 * Web-specific privacy layer on top of the phone's shared denylist + Sentry scrubber.
 *
 * The browser adds a leak surface the phone doesn't have: URLs. `/auth/callback?code=…`,
 * `/library?q=<search terms>` and `/results/<uuid>` would otherwise reach PostHog
 * ($current_url, $referrer, …) and Sentry (request.url, navigation/fetch breadcrumbs,
 * transaction names, span descriptions). Everything here strips query strings and
 * fragments and replaces UUIDs in paths with `:id`.
 */
import type { Breadcrumb, ErrorEvent, init } from "@sentry/react";
import type { CaptureResult, Properties } from "posthog-js";

import { cleanString, FORBIDDEN_PROPERTY_KEYS } from "../shared/analyticsPrivacy";
import { scrubSentryEvent, scrubString } from "../shared/sentryScrub";

type SentryOptions = NonNullable<Parameters<typeof init>[0]>;
type TransactionEvent = Parameters<NonNullable<SentryOptions["beforeSendTransaction"]>>[0];
type TransactionSpan = NonNullable<TransactionEvent["spans"]>[number];

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function redactPathIds(path: string): string {
  return path.replace(UUID_RE, ":id");
}

/** Keeps origin + path (ids redacted); drops userinfo, query string and fragment. */
export function sanitizeUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return redactPathIds(trimmed.split(/[?#]/, 1)[0]);
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${redactPathIds(url.pathname)}`;
    }
    return `${url.protocol}[redacted]`;
  } catch {
    return value;
  }
}

/** Strips `?…` / `#…` from any relative path embedded in free text. */
function stripPathQueries(text: string): string {
  return text.replace(/(^|[\s"'(])(\/[^\s?#"')]*)[?#][^\s"')]*/g, "$1$2");
}

// ---------------------------------------------------------------- PostHog

/** PostHog needs these on every event; they are not user data. */
const POSTHOG_INTERNAL_KEYS = new Set(["token", "distinct_id"]);

function isUrlProperty(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.startsWith("$") &&
    (k.includes("url") || k.includes("pathname") || (k.includes("referrer") && !k.includes("domain")))
  );
}

export function sanitizePostHogProperties(properties: Properties | undefined): Properties {
  const clean: Properties = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (FORBIDDEN_PROPERTY_KEYS.has(key) && !POSTHOG_INTERNAL_KEYS.has(key)) {
      continue;
    }
    if (typeof value === "string") {
      if (isUrlProperty(key)) {
        clean[key] = sanitizeUrl(value);
      } else if (key.startsWith("$") || POSTHOG_INTERNAL_KEYS.has(key)) {
        clean[key] = value;
      } else {
        clean[key] = cleanString(value);
      }
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/** posthog-js `before_send`: same denylist as the phone, plus URL sanitizing for browser-only properties. */
export function sanitizePostHogEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) {
    return event;
  }
  event.properties = sanitizePostHogProperties(event.properties);
  if (event.$set) {
    event.$set = sanitizePostHogProperties(event.$set);
  }
  if (event.$set_once) {
    event.$set_once = sanitizePostHogProperties(event.$set_once);
  }
  return event;
}

// ---------------------------------------------------------------- Sentry

const URL_DATA_KEYS = new Set(["url", "from", "to", "http.url", "url.full"]);
const QUERY_DATA_KEY_RE = /query|fragment|search/i;

function sanitizeDeep(value: unknown, depth = 0): unknown {
  if (depth > 10) {
    return "[MAX_DEPTH]";
  }
  if (typeof value === "string") {
    return scrubString(stripPathQueries(value));
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDeep(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (QUERY_DATA_KEY_RE.test(key)) {
        out[key] = "[REDACTED]";
      } else if (URL_DATA_KEYS.has(key) && typeof entry === "string") {
        out[key] = scrubString(sanitizeUrl(entry));
      } else {
        out[key] = sanitizeDeep(entry, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export function scrubWebBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  return {
    ...crumb,
    message: typeof crumb.message === "string" ? scrubString(stripPathQueries(crumb.message)) : crumb.message,
    data: crumb.data ? (sanitizeDeep(crumb.data) as Breadcrumb["data"]) : crumb.data,
  };
}

function sanitizeTransactionName(name: string): string {
  return name.startsWith("/") || /^https?:\/\//.test(name) ? sanitizeUrl(name) : redactPathIds(name);
}

function scrubRequest(request: ErrorEvent["request"]): ErrorEvent["request"] {
  if (!request) {
    return request;
  }
  const next = { ...request };
  if (typeof next.url === "string") {
    next.url = sanitizeUrl(next.url);
  }
  delete next.query_string;
  delete next.cookies;
  delete next.data;
  return next;
}

/** Sentry `beforeSend`: the phone's scrubber first (parity), then browser-specific redaction. */
export function scrubWebSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubWebBreadcrumb);
  }
  const scrubbed = scrubSentryEvent(event);
  if (!scrubbed) {
    return null;
  }
  scrubbed.request = scrubRequest(scrubbed.request);
  if (typeof scrubbed.transaction === "string") {
    scrubbed.transaction = sanitizeTransactionName(scrubbed.transaction);
  }
  // The phone's scrubber leaves exception messages untouched; on web they can embed URLs.
  for (const exception of scrubbed.exception?.values ?? []) {
    if (typeof exception.value === "string") {
      exception.value = scrubString(stripPathQueries(exception.value));
    }
  }
  return scrubbed;
}

/** Sentry `beforeSendTransaction`: transaction names, span descriptions and span data carry URLs. */
export function scrubWebSentryTransaction(event: TransactionEvent): TransactionEvent | null {
  if (typeof event.transaction === "string") {
    event.transaction = sanitizeTransactionName(event.transaction);
  }
  event.request = scrubRequest(event.request);
  if (event.spans) {
    event.spans = event.spans.map((span: TransactionSpan) => ({
      ...span,
      description: typeof span.description === "string" ? scrubString(stripPathQueries(span.description)) : span.description,
      data: span.data ? (sanitizeDeep(span.data) as typeof span.data) : span.data,
    }));
  }
  if (event.contexts) {
    event.contexts = sanitizeDeep(event.contexts) as TransactionEvent["contexts"];
  }
  if (event.extra) {
    event.extra = sanitizeDeep(event.extra) as TransactionEvent["extra"];
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubWebBreadcrumb);
  }
  return event;
}
