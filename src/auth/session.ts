import type { Session } from "@supabase/supabase-js";

import type { WebSignInMethod } from "../lib/analytics";
import { readStorage, removeStorage, STORAGE_PREFIX, writeStorage } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { sanitizeNextPath } from "./callback";

const NEXT_PATH_KEY = `${STORAGE_PREFIX}auth.next`;
const PENDING_METHOD_KEY = `${STORAGE_PREFIX}auth.pendingMethod`;
const RECOVERY_KEY = `${STORAGE_PREFIX}auth.recovery`;

function tabStore(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

export function authRedirectUrl(path: "/auth/callback" | "/auth/reset"): string {
  return `${window.location.origin}${path}`;
}

/** Destination to resume after sign-in; sessionStorage so it survives the OAuth round-trip in this tab. */
export function rememberNextPath(path: string): void {
  writeStorage(tabStore(), NEXT_PATH_KEY, sanitizeNextPath(path));
}

export function peekNextPath(): string {
  return sanitizeNextPath(readStorage(tabStore(), NEXT_PATH_KEY));
}

export function clearNextPath(): void {
  removeStorage(tabStore(), NEXT_PATH_KEY);
}

export function setPendingSignInMethod(method: WebSignInMethod): void {
  writeStorage(tabStore(), PENDING_METHOD_KEY, method);
}

export function takePendingSignInMethod(): WebSignInMethod | null {
  const value = readStorage(tabStore(), PENDING_METHOD_KEY);
  removeStorage(tabStore(), PENDING_METHOD_KEY);
  return value === "google" || value === "password" || value === "email_link" ? value : null;
}

export function markRecoverySession(active: boolean): void {
  if (active) {
    writeStorage(tabStore(), RECOVERY_KEY, "true");
  } else {
    removeStorage(tabStore(), RECOVERY_KEY);
  }
}

export function isRecoverySession(): boolean {
  return readStorage(tabStore(), RECOVERY_KEY) === "true";
}

const inflightExchanges = new Map<string, Promise<Session>>();

/**
 * PKCE codes are single-use; React StrictMode runs effects twice in dev, so the
 * exchange is memoized per code to avoid a spurious "invalid code" on the second run.
 */
export function exchangeCodeOnce(code: string): Promise<Session> {
  let pending = inflightExchanges.get(code);
  if (!pending) {
    pending = supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
      if (error) {
        throw error;
      }
      if (!data.session) {
        throw new Error("No session returned");
      }
      return data.session;
    });
    inflightExchanges.set(code, pending);
  }
  return pending;
}
