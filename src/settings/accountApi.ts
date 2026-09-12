import { backendFetch } from "../lib/backend";

export const DELETE_CONFIRM_TEXT = "DELETE";

/** Phone profile.tsx confirmDeleteAccount: DELETE /v1/account {confirmText} schedules deletion 24 h out. */
export async function scheduleAccountDeletion(confirmText: string): Promise<{ deletesAt: string | null }> {
  const payload = await backendFetch<{ success?: boolean; deletesAt?: string }>("/v1/account", {
    method: "DELETE",
    body: { confirmText },
  });
  return { deletesAt: typeof payload?.deletesAt === "string" ? payload.deletesAt : null };
}

/** Phone: the confirm button is enabled only when the typed text is exactly DELETE. */
export function canConfirmDeletion(typed: string): boolean {
  return typed === DELETE_CONFIRM_TEXT;
}
