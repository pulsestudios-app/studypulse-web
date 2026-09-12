import { BackendError, readBackendErrorBody } from "./backendErrors";
import { config } from "./config";
import { supabase } from "./supabase";

export { BackendError };

/** Authenticated call to the Railway API with the same headers the phone sends. */
export async function backendFetch<T>(path: string, init: { method: "GET" | "POST" | "DELETE"; body?: unknown }): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new BackendError("Please sign in again.", 401);
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    "x-app-key": config.appKey,
  };
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${config.backendUrl}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { message, code } = readBackendErrorBody(body, "Request failed. Please try again.");
    throw new BackendError(message, response.status, code);
  }
  return body as T;
}

/** Same call the phone makes when the rolling billing cycle has ended (`profileApi.ensureProfileBillingCycle`). */
export async function ensureProfileBillingCycle(): Promise<void> {
  await backendFetch<{ ok: boolean }>("/v1/profile/billing-cycle/ensure", { method: "POST", body: {} });
}
