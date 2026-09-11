// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/sentryScrub.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: Sentry type import points at @sentry/react instead of @sentry/react-native.

import type { init } from "@sentry/react";
type BeforeSend = NonNullable<Parameters<typeof init>[0]["beforeSend"]>;
type Event = Parameters<BeforeSend>[0];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const FILE_PATH_RE =
  /(?:file:\/\/\/|content:\/\/|https?:\/\/)[^\s"'<>]+|(?:[A-Za-z]:\\|\/)[^\s"'<>]+\.(?:m4a|mp3|mp4|wav|pdf|pptx|docx|txt|mov)/gi;

const SENSITIVE_HEADER_KEYS = new Set(["authorization", "x-app-key", "cookie"]);

const REDACTED_VALUE_KEYS = new Set([
  "authorization",
  "x-app-key",
  "x-app-key",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "expo_push_token",
  "fcm_token",
  "push_token",
  "transcript",
  "transcript_full_text",
  "transcript_segments",
  "fulltext",
  "full_text",
  "file_path",
  "filepath",
  "filePath",
  "uri",
  "source_media_uri",
  "source_audio_uri",
]);

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (REDACTED_VALUE_KEYS.has(lower)) {
    return true;
  }
  return lower.includes("transcript") || lower.includes("password") || lower.includes("token");
}

export function scrubString(value: string): string {
  return value
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(UUID_RE, "[REDACTED_ID]")
    .replace(FILE_PATH_RE, "[REDACTED_PATH]");
}

function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 10) {
    return "[MAX_DEPTH]";
  }
  if (typeof value === "string") {
    return scrubString(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubValue(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = shouldRedactKey(key) ? "[REDACTED]" : scrubValue(entry, depth + 1);
    }
    return out;
  }
  return value;
}

export function scrubSentryEvent(event: Event): Event | null {
  if (typeof event.message === "string") {
    event.message = scrubString(event.message);
  }

  if (event.request?.headers) {
    const headers = { ...event.request.headers };
    for (const key of Object.keys(headers)) {
      if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
        headers[key] = "[REDACTED]";
      } else if (typeof headers[key] === "string") {
        headers[key] = scrubString(headers[key]);
      }
    }
    event.request.headers = headers;
  }

  if (event.extra) {
    event.extra = scrubValue(event.extra) as Event["extra"];
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as Event["contexts"];
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      message: typeof crumb.message === "string" ? scrubString(crumb.message) : crumb.message,
      data: crumb.data ? (scrubValue(crumb.data) as Record<string, unknown>) : crumb.data,
    }));
  }

  return event;
}
