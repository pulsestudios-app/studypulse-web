import { useState } from "react";
import { Link } from "react-router";

import { useSession } from "../auth/AuthProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { displayTitle } from "../library/format";
import { COPY } from "../results/copy";
import { daysUntilPurge, useTrash, useTrashActions, type TrashRow } from "./trashApi";

/** Phone app/trash.tsx (transcriptions only; recordings live on the phone). Delete Forever gets a confirmation on web. */
export function TrashSection() {
  const session = useSession();
  const userId = session.user.id;
  const trash = useTrash(userId);
  const { restore, destroy, empty } = useTrashActions(userId);
  const [pendingDelete, setPendingDelete] = useState<TrashRow | null>(null);
  const [pendingEmpty, setPendingEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyId = restore.isPending ? restore.variables : destroy.isPending ? destroy.variables : null;

  async function onRestore(row: TrashRow) {
    setError(null);
    try {
      await restore.mutateAsync(row.id);
    } catch {
      setError(COPY.trash.restoreFailed);
    }
  }

  async function onDeleteForever() {
    if (!pendingDelete) {
      return;
    }
    setError(null);
    try {
      await destroy.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      setError(COPY.trash.deleteFailed);
    }
  }

  async function onEmptyTrash() {
    setError(null);
    try {
      await empty.mutateAsync((trash.data ?? []).map((row) => row.id));
      setPendingEmpty(false);
    } catch {
      setError(COPY.trash.emptyFailed);
    }
  }

  const rows = trash.data ?? [];
  return (
    <section id="trash" className="card settings-section" aria-labelledby="settings-trash">
      <div className="settings-row">
        <h2 id="settings-trash" className="settings-heading">
          {COPY.trash.title}
        </h2>
        {rows.length > 0 ? (
          <button type="button" className="btn btn-small btn-destructive" onClick={() => setPendingEmpty(true)}>
            {COPY.trash.emptyTrash}
          </button>
        ) : null}
      </div>
      <p className="notice trash-banner">{COPY.trash.banner}</p>
      {trash.isPending ? (
        <div className="skeleton skeleton-line" aria-hidden="true" />
      ) : trash.isError ? (
        <div className="notice notice-error inline-error" role="alert">
          <span>Could not load the trash.</span>
          <button type="button" className="btn btn-small" onClick={() => void trash.refetch()}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="settings-empty">
          <span className="trash-empty-emoji" aria-hidden="true">
            🗑️
          </span>
          <strong>{COPY.trash.emptyTitle}</strong>
          <span className="text-secondary">{COPY.trash.emptyBody}</span>
        </div>
      ) : (
        <>
          <span className="section-label">{COPY.trash.section}</span>
          <ul className="trash-list">
            {rows.map((row) => (
              <li key={row.id} className="trash-row">
                <span className="trash-icon" aria-hidden="true">
                  <Icon name={row.source_type === "youtube" ? "youtube" : "document"} size={20} />
                </span>
                <div className="trash-row-body">
                  <Link to={`/results/${row.id}`} className="trash-row-title">
                    {displayTitle(row)}
                  </Link>
                  <span className="type-caption text-secondary">{COPY.trash.daysLeft(daysUntilPurge(row.deleted_at))}</span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-small btn-primary" disabled={busyId === row.id} onClick={() => void onRestore(row)}>
                    {COPY.trash.restore}
                  </button>
                  <button type="button" className="btn btn-small btn-destructive" disabled={busyId === row.id} onClick={() => setPendingDelete(row)}>
                    {COPY.trash.deleteForever}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="type-caption text-secondary">{COPY.trash.recordingsNote}</p>
      {error ? (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={COPY.trash.deleteForeverTitle}
        message={COPY.trash.deleteForeverBody}
        confirmLabel={COPY.trash.deleteForever}
        destructive
        busy={destroy.isPending}
        onConfirm={() => void onDeleteForever()}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDialog
        open={pendingEmpty}
        title={COPY.trash.emptyTrash}
        message={COPY.trash.emptyTrashBody}
        confirmLabel={COPY.trash.emptyTrash}
        destructive
        busy={empty.isPending}
        onConfirm={() => void onEmptyTrash()}
        onCancel={() => setPendingEmpty(false)}
      />
    </section>
  );
}
