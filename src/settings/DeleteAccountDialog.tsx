import { useState } from "react";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { trackEvent } from "../lib/analytics";
import { clearAppStateAndLeave } from "../lib/appState";
import { supabase } from "../lib/supabase";
import { COPY } from "../results/copy";
import { canConfirmDeletion, scheduleAccountDeletion } from "./accountApi";

/** Phone profile.tsx delete modal: type DELETE, schedule deletion, sign out everywhere. */
export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!canConfirmDeletion(typed) || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await scheduleAccountDeletion(typed);
      trackEvent("account_deleted");
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {
        // The deletion is scheduled regardless; local state is cleared below.
      }
      clearAppStateAndLeave("/auth/sign-in");
    } catch {
      setError(COPY.account.deleteFailed);
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title={COPY.account.deleteAccount}
      message={COPY.account.deleteBody}
      confirmLabel={COPY.account.deleteConfirm}
      cancelLabel={COPY.account.cancel}
      destructive
      busy={busy}
      disabled={!canConfirmDeletion(typed)}
      onConfirm={() => void onConfirm()}
      onCancel={() => {
        setTyped("");
        setError(null);
        onClose();
      }}
    >
      <input
        className="input"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={COPY.account.typeDelete}
        autoComplete="off"
        autoCapitalize="characters"
        aria-label={COPY.account.typeDelete}
        style={{ borderColor: canConfirmDeletion(typed) ? "var(--color-lime)" : undefined }}
      />
      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
