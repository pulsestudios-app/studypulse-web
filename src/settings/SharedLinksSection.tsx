import { useState } from "react";

import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { trackEvent } from "../lib/analytics";
import { COPY } from "../results/copy";
import type { ResultShare } from "../results/generationApi";
import { isShareInactive, shareMeta, useRevokeShare, useShares } from "./sharesApi";

/** Phone app/shared-links.tsx: list, copy, revoke with confirmation; revoked rows stay, marked Inactive. */
export function SharedLinksSection() {
  const shares = useShares();
  const revoke = useRevokeShare();
  const [pending, setPending] = useState<ResultShare | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copy(share: ResultShare) {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopiedId(share.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard can be blocked; the URL stays visible in the row title tooltip.
    }
  }

  async function confirmRevoke() {
    if (!pending) {
      return;
    }
    setError(null);
    try {
      await revoke.mutateAsync(pending.id);
      trackEvent("share_revoked");
      setPending(null);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : COPY.shares.revokeFailed);
    }
  }

  return (
    <section className="card settings-section" aria-labelledby="settings-shares">
      <h2 id="settings-shares" className="settings-heading">
        {COPY.shares.title}
      </h2>
      <p className="type-caption text-secondary settings-hint">{COPY.shares.hint}</p>
      {shares.isPending ? (
        <p className="text-secondary">{COPY.shares.loading}</p>
      ) : shares.isError ? (
        <div className="notice notice-error inline-error" role="alert">
          <span>{COPY.shares.loadFailed}</span>
          <button type="button" className="btn btn-small" onClick={() => void shares.refetch()}>
            {COPY.shares.retry}
          </button>
        </div>
      ) : shares.data.length === 0 ? (
        <div className="settings-empty">
          <Icon name="link" size={28} />
          <strong>{COPY.shares.emptyTitle}</strong>
          <span className="text-secondary">{COPY.shares.emptyBody}</span>
        </div>
      ) : (
        <ul className="share-list">
          {shares.data.map((share) => {
            const inactive = isShareInactive(share);
            return (
              <li key={share.id} className={`share-row${inactive ? " is-inactive" : ""}`}>
                <div className="share-row-body">
                  <span className="share-row-title" title={share.url}>
                    {share.title}
                  </span>
                  <span className="type-caption text-secondary">{shareMeta(share)}</span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-small" disabled={inactive} onClick={() => void copy(share)}>
                    {copiedId === share.id ? COPY.shares.copied : COPY.shares.copy}
                  </button>
                  <button type="button" className="btn btn-small btn-danger" disabled={inactive} onClick={() => setPending(share)}>
                    {COPY.shares.revoke}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title={COPY.shares.revokeTitle}
        message={COPY.shares.revokeBody}
        confirmLabel={revoke.isPending ? COPY.shares.revoking : COPY.shares.revokeConfirm}
        cancelLabel={COPY.shares.cancel}
        destructive
        busy={revoke.isPending}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
