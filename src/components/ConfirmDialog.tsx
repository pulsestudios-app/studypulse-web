import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

/** Web stand-in for the phone's ThemedAlertModal (title, message, Cancel / destructive action). */
export function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel = "Cancel", busy, destructive, disabled, onConfirm, onCancel, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onClose={() => {
        if (!busy) {
          onCancel();
        }
      }}
      onCancel={(e) => {
        if (busy) {
          e.preventDefault();
        }
      }}
      aria-labelledby="confirm-title"
    >
      <div className="dialog-body">
        <h2 id="confirm-title" className="type-title">
          {title}
        </h2>
        {message ? <p className="text-secondary">{message}</p> : null}
        {children}
        <div className="row-actions dialog-actions">
          <button type="button" className="btn btn-small" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn btn-small${destructive ? " btn-destructive" : " btn-primary"}`} onClick={onConfirm} disabled={busy || disabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
