export const DELETE_CONFIRM_TEXT = "DELETE";

/** Phone: the confirm button is enabled only when the typed text is exactly DELETE. */
export function canConfirmDeletion(typed: string): boolean {
  return typed === DELETE_CONFIRM_TEXT;
}
