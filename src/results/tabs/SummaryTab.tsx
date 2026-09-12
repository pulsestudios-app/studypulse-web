import { useState } from "react";

import type { ConceptPayload } from "../../shared/processingTypes";
import { COPY } from "../copy";
import { classifyBackendError, persistSummary, regenerateSummary, SUMMARY_REGENERATE_OPTIONS, type SummaryRegenerateOption } from "../generationApi";
import { InlineError, UpgradeNotice } from "../UpgradeNotice";
import type { TabContext } from "./tabContext";

export function SummaryTab({ ctx, concepts }: { ctx: TabContext; concepts: ConceptPayload[] }) {
  const { view, isFree, userId, patch, persist } = ctx;
  const [busy, setBusy] = useState(false);
  const [option, setOption] = useState<SummaryRegenerateOption>("shorter");
  const [regenerated, setRegenerated] = useState(false);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const hasSummary = Boolean(view.summary.mainIdea.trim() || view.summary.keyPoints.length);

  async function onRegenerate() {
    if (!view.transcript.fullText.trim()) {
      setError({ kind: "other", message: COPY.quiz.noTranscript });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const summary = await regenerateSummary(view.transcript.fullText, option);
      patch({ summary });
      setRegenerated(true);
      persist.mutate(() => persistSummary(userId, view.id, summary));
    } catch (e) {
      setError(classifyBackendError(e, COPY.summary.regenerateFailed));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tab-body">
      {hasSummary ? (
        <>
          <section className="summary-main card">
            <h3 className="section-label">
              {COPY.summary.mainIdea}
              {regenerated ? <span className="pill summary-regenerated">{COPY.summary.regenerated}</span> : null}
            </h3>
            <p className="summary-main-text">{view.summary.mainIdea || "—"}</p>
          </section>
          <section>
            <h3 className="section-label">{COPY.summary.keyPoints}</h3>
            {busy ? (
              <p className="text-secondary">{COPY.summary.regenerating}</p>
            ) : view.summary.keyPoints.length > 0 ? (
              <ul className="key-points">
                {view.summary.keyPoints.map((point, i) => (
                  <li key={i} className="key-point card">
                    {point}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-secondary">{COPY.summary.noKeyPoints}</p>
            )}
          </section>
        </>
      ) : (
        <p className="text-secondary">{COPY.summary.noKeyPoints}</p>
      )}

      {error?.kind === "gated" || (isFree && !error) ? (
        isFree ? (
          <UpgradeNotice message={COPY.summary.upgradeToRegenerate} button={COPY.summary.regenerate} feature="Summary Regeneration" />
        ) : null
      ) : null}
      {!isFree ? (
        <div className="regen-row">
          <label className="field">
            <span className="field-label">Style</span>
            <select className="input select" value={option} onChange={(e) => setOption(e.target.value as SummaryRegenerateOption)}>
              {SUMMARY_REGENERATE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-small" onClick={() => void onRegenerate()} disabled={busy}>
            {busy ? COPY.summary.regenerating : COPY.summary.regenerate}
          </button>
        </div>
      ) : null}
      {error && error.kind !== "gated" ? <InlineError title="Regenerate failed" message={error.message} /> : null}
      {error?.kind === "gated" && !isFree ? <InlineError title="Regenerate failed" message={error.message} /> : null}

      <section>
        <h3 className="section-label">{COPY.summary.concepts}</h3>
        {concepts.length > 0 ? (
          <div className="concept-grid">
            {concepts.map((c, i) => (
              <div key={i} className="concept-card">
                <strong>{c.term}</strong>
                <span className="text-secondary">{c.definition}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-secondary">{COPY.summary.noConcepts}</p>
        )}
      </section>
    </div>
  );
}
