/**
 * Pure helpers for the Supabase PKCE browser redirects (/auth/callback and /auth/reset).
 * Kept free of React/Supabase imports so they are unit-testable.
 */

export type AuthCallbackResult =
  | { kind: "code"; code: string }
  | { kind: "error"; code: string }
  | { kind: "none" };

/** Supabase PKCE auth codes are UUIDs today; accept any reasonable opaque token. */
const AUTH_CODE_RE = /^[A-Za-z0-9._~-]{8,512}$/;

/**
 * Reads `?code=` (success) or `error` / `error_code` from the query string or the
 * fragment (Supabase puts some errors, e.g. otp_expired, in the hash).
 * `error_description` is deliberately ignored: it is attacker-controllable text.
 */
export function parseAuthCallback(href: string): AuthCallbackResult {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "none" };
  }
  const query = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const errorCode = query.get("error_code") || hash.get("error_code") || query.get("error") || hash.get("error");
  if (errorCode) {
    return { kind: "error", code: errorCode.trim().toLowerCase().slice(0, 64) };
  }
  const code = query.get("code");
  if (code && AUTH_CODE_RE.test(code)) {
    return { kind: "code", code };
  }
  return { kind: "none" };
}

/** Maps known Supabase/GoTrue error codes to fixed copy; unknown codes get a generic message. */
export function authCallbackErrorMessage(code: string): string {
  switch (code) {
    case "otp_expired":
      return "This link has expired or was already used. Please request a new one.";
    case "access_denied":
      return "Sign-in was cancelled or the link is no longer valid.";
    case "flow_state_not_found":
    case "flow_state_expired":
    case "bad_code_verifier":
    case "pkce_code_verifier_not_found":
      return "This link must be opened in the same browser where you started. Please try again from this browser.";
    default:
      return "We couldn't complete sign-in. Please try again.";
  }
}

/** Code exchange failures: the usual cause is opening the link in a different browser (missing PKCE verifier). */
export function exchangeErrorMessage(error: unknown): string {
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (code) {
    return authCallbackErrorMessage(code);
  }
  if (message.includes("code verifier") || message.includes("code_verifier") || message.includes("flow state")) {
    return authCallbackErrorMessage("bad_code_verifier");
  }
  return authCallbackErrorMessage("unknown");
}

export const DEFAULT_AFTER_AUTH_PATH = "/library";
const PLACEHOLDER_ORIGIN = "https://app.invalid";

/**
 * Only same-origin, non-/auth paths may be used as a post-sign-in destination.
 * Rejects absolute URLs, protocol-relative (`//evil`) and backslash tricks.
 */
export function sanitizeNextPath(raw: string | null | undefined): string {
  if (!raw) {
    return DEFAULT_AFTER_AUTH_PATH;
  }
  const value = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\x00-\x1f\x7f]/.test(value)) {
    return DEFAULT_AFTER_AUTH_PATH;
  }
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) {
      return DEFAULT_AFTER_AUTH_PATH;
    }
    if (url.pathname === "/" || url.pathname === "/auth" || url.pathname.startsWith("/auth/")) {
      return DEFAULT_AFTER_AUTH_PATH;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AFTER_AUTH_PATH;
  }
}
