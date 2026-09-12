import { useEffect, useRef, useState } from "react";

import { trackEvent } from "../lib/analytics";
import { COPY } from "./copy";
import { classifyBackendError, createShare, type ResultShare, type ShareScope } from "./generationApi";
import type { ResultView } from "./resultParse";
import { shareAvailability } from "./shareAvailability";

export function ShareLinkDialog({ view, open, onClose }: { view: ResultView; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<ShareScope | null>(null);
  const [share, setShare] = useState<ResultShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const available = shareAvailability(view);

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

  async function onPick(scope: ShareScope) {
    setBusy(scope);
    setError(null);
    try {
      const created = await createShare(view.id, scope);
      setShare(created);
      trackEvent("share_created", { scope });
    } catch (e) {
      setError(classifyBackendError(e, COPY.share.failed).message);
    } finally {
      setBusy(null);
    }
  }

  async function onCopy() {
    if (!share) {
      return;
    }
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the URL is selectable in the input.
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="share-title">
      <div className="dialog-body">
        <h2 id="share-title" className="type-title">
          {COPY.share.title}
        </h2>
        <p className="text-secondary">{COPY.share.body}</p>
        {share ? (
          <div className="share-result">
            <span className="pill">{COPY.share.scopes[share.scope]}</span>
            <input className="input" readOnly value={share.url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <div className="row-actions">
              <button type="button" className="btn btn-primary btn-small" onClick={() => void onCopy()}>
                {copied ? COPY.share.copied : COPY.share.copy}
              </button>
              <button type="button" className="btn btn-small" onClick={() => setShare(null)}>
                Create another
              </button>
            </div>
          </div>
        ) : (
          <div className="share-options">
            {(Object.keys(COPY.share.scopes) as ShareScope[]).map((scope) => (
              <button key={scope} type="button" className="btn" disabled={!available[scope] || busy !== null} onClick={() => void onPick(scope)}>
                {busy === scope ? "Creating…" : COPY.share.scopes[scope]}
              </button>
            ))}
          </div>
        )}
        {error ? (
          <div className="notice notice-error" role="alert">
            <strong>{COPY.share.failedTitle}</strong> {error}
          </div>
        ) : null}
        <button type="button" className="btn btn-small dialog-close" onClick={onClose}>
          {COPY.share.cancel}
        </button>
      </div>
    </dialog>
  );
}
