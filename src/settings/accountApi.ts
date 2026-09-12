import { backendFetch } from "../lib/backend";

export { canConfirmDeletion, DELETE_CONFIRM_TEXT } from "./accountLogic";
/** Phone profile.tsx confirmDeleteAccount: DELETE /v1/account {confirmText} schedules deletion 24 h out. */
export async function scheduleAccountDeletion(confirmText: string): Promise<{ deletesAt: string | null }> {
  const payload = await backendFetch<{ success?: boolean; deletesAt?: string }>("/v1/account", {
    method: "DELETE",
    body: { confirmText },
  });
  return { deletesAt: typeof payload?.deletesAt === "string" ? payload.deletesAt : null };
}

