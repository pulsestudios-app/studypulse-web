import { resetAnalytics } from "./analytics";
import { queryClient } from "./queryClient";
import { clearSentryUser } from "./sentry";
import { clearAppStorage } from "./storage";
import { supabase } from "./supabase";

let clearing = false;

/**
 * Drops every piece of client state tied to the signed-in user: cached queries,
 * analytics identity, Sentry user, app-owned storage (except device preferences
 * such as the analytics opt-out) and sessionStorage — then hard-navigates so no
 * in-memory React state survives.
 */
export function clearAppStateAndLeave(destination = "/auth/sign-in"): void {
  if (clearing) {
    return;
  }
  clearing = true;
  queryClient.clear();
  resetAnalytics();
  clearSentryUser();
  try {
    clearAppStorage(window.localStorage, window.sessionStorage);
  } catch {
    // Storage may be unavailable; the hard navigation below still drops in-memory state.
  }
  window.location.replace(destination);
}

/**
 * Signs out this browser only (scope "local"): signing out on the web should not end
 * the user's phone session. The phone itself uses scope "global".
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Local sign-out clears storage even if the network call fails; continue regardless.
  }
  clearAppStateAndLeave();
}
