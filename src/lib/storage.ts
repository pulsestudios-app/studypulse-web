/** Every browser-storage key this app owns starts with this prefix. */
export const STORAGE_PREFIX = "studypulse.web.";

/** Supabase session storage key (it also writes `${key}-code-verifier` during PKCE flows). */
export const AUTH_STORAGE_KEY = `${STORAGE_PREFIX}auth`;

export const ANALYTICS_OPT_OUT_KEY = `${STORAGE_PREFIX}prefs.analyticsOptOut`;

/**
 * Device preferences that survive sign-out. The analytics opt-out must persist,
 * otherwise signing out would silently re-enable tracking on this browser.
 */
const PRESERVED_KEYS = new Set([ANALYTICS_OPT_OUT_KEY]);

type KeyValueStorage = Pick<Storage, "length" | "key" | "removeItem" | "clear">;

/** Removes all app-owned keys (except preserved preferences) and clears sessionStorage. */
export function clearAppStorage(local: KeyValueStorage, session: KeyValueStorage): string[] {
  const doomed: string[] = [];
  for (let i = 0; i < local.length; i += 1) {
    const key = local.key(i);
    if (key && key.startsWith(STORAGE_PREFIX) && !PRESERVED_KEYS.has(key)) {
      doomed.push(key);
    }
  }
  for (const key of doomed) {
    local.removeItem(key);
  }
  session.clear();
  return doomed;
}

export function readStorage(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); state just won't persist.
  }
}

export function removeStorage(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // ignore
  }
}
