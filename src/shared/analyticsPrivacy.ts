// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/lib/analytics.ts (lines 30, 40-73, 80-110)
// Keep in sync manually — no monorepo coupling. Changes vs source: excerpt of the property denylist + sanitizers, exported for reuse.

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

/**
 * Property keys that are stripped from every analytics event. Defense-in-depth:
 * a future `trackEvent()` caller can't accidentally include user-content fields
 * (transcripts, chat messages, document titles, file names, uploaded URIs) or
 * direct identifiers (email, name, phone, user_id) in event properties.
 */
export const FORBIDDEN_PROPERTY_KEYS = new Set([
  // Direct PII / contact
  "email",
  "name",
  "full_name",
  "fullName",
  "phone",
  // Identifiers
  "user_id",
  "userId",
  // Auth material
  "access_token",
  "refresh_token",
  "token",
  "password",
  // User-generated content
  "transcript",
  "transcript_full_text",
  "content",
  "message",
  "title",
  "prompt",
  // File / resource references that can reveal user data paths
  "file_name",
  "fileName",
  "uri",
  "url",
]);

export function cleanString(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .slice(0, 180);
}

export function cleanProperties(properties?: AnalyticsProperties): Record<string, string | number | boolean | null> {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (FORBIDDEN_PROPERTY_KEYS.has(key)) {
      continue;
    }
    if (value == null) {
      clean[key] = null;
      continue;
    }
    if (typeof value === "string") {
      clean[key] = cleanString(value);
      continue;
    }
    if (typeof value === "number") {
      clean[key] = Number.isFinite(value) ? value : null;
      continue;
    }
    if (typeof value === "boolean") {
      clean[key] = value;
    }
  }
  return clean;
}
