import { useState } from "react";

import { MAP_STYLE_OPTIONS, type MapLayoutStyle } from "../../shared/mindmap/resultsMapConstants";
import { MIND_MAP_BRANCH_COUNT_OPTIONS, MIND_MAP_DEFAULT_BRANCH_COUNT, type MindMapBranchCount } from "../../shared/mindMapTypes";
import { COPY } from "../copy";
import { classifyBackendError, generateMindMap, persistMindMap } from "../generationApi";
import { MindMapCanvas, type MindMapPopup } from "../mindmap/MindMapCanvas";
import { resultDisplayTitle } from "../resultParse";
import { InlineError, UpgradeNotice } from "../UpgradeNotice";
import type { TabContext } from "./tabContext";

export function MindMapTab({ ctx }: { ctx: TabContext }) {
  const { view, isFree, userId, patch, persist } = ctx;
  const [style, setStyle] = useState<MapLayoutStyle>("tree");
  const [expanded, setExpanded] = useState<number[]>([]);
  const [popup, setPopup] = useState<MindMapPopup | null>(null);
  const [branchCount, setBranchCount] = useState<MindMapBranchCount>(MIND_MAP_DEFAULT_BRANCH_COUNT);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  async function onGenerate() {
    if (!view.transcript.fullText.trim()) {
      setError({ kind: "other", message: COPY.quiz.noTranscript });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mindMap = await generateMindMap(view.transcript.fullText, branchCount, resultDisplayTitle(view));
      patch({ mindMap });
      setExpanded([]);
      setShowGenerator(false);
      setToast(COPY.mindMap.generated);
      window.setTimeout(() => setToast(null), 2000);
      persist.mutate(() => persistMindMap(userId, view.id, mindMap));
    } catch (e) {
      setError(classifyBackendError(e, COPY.mindMap.failed));
    } finally {
      setBusy(false);
    }
  }

  const toggleBranch = (index: number) => {
    setPopup(null);
    setExpanded((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)));
  };

  if (!view.mindMap || showGenerator) {
    return (
      <div className="tab-body mindmap-empty">
        <span className="mindmap-empty-emoji" aria-hidden="true">
          🗺️
        </span>
        <h3 className="type-title">{COPY.mindMap.emptyTitle}</h3>
        <p className="text-secondary">{COPY.mindMap.emptyBody}</p>
        {isFree ? (
          <UpgradeNotice message={COPY.upgrade.feature(COPY.upgrade.mindMap)} button={COPY.mindMap.generate} feature={COPY.upgrade.mindMap} />
        ) : (
          <>
            <div className="chip-group">
              <span className="field-label">{COPY.mindMap.branches}</span>
              <div className="chips">
                {MIND_MAP_BRANCH_COUNT_OPTIONS.map((n) => (
                  <button key={n} type="button" className={`chip${branchCount === n ? " chip-active" : ""}`} onClick={() => setBranchCount(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {error ? <InlineError title={COPY.mindMap.failedTitle} message={error.message} /> : null}
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => void onGenerate()} disabled={busy}>
                {busy ? "Generating…" : COPY.mindMap.generate}
              </button>
              {view.mindMap ? (
                <button type="button" className="btn" onClick={() => setShowGenerator(false)} disabled={busy}>
                  Cancel
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="tab-body mindmap-tab">
      <div className="mindmap-toolbar">
        <div className="chips" role="group" aria-label="Layout style">
          {MAP_STYLE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`chip${style === o.id ? " chip-active" : ""}`}
              onClick={() => {
                setStyle(o.id);
                setExpanded([]);
                setPopup(null);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-small" onClick={() => setShowGenerator(true)}>
          Regenerate
        </button>
      </div>
      <MindMapCanvas mindMap={view.mindMap} style={style} expanded={expanded} onToggleBranch={toggleBranch} onPopup={setPopup} />
      <p className="type-caption text-secondary">{style === "radial" ? COPY.mindMap.hintSunburst : COPY.mindMap.hint}</p>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      {popup ? (
        <div className="mindmap-popup card" style={{ borderColor: popup.color }} role="dialog" aria-label={popup.term}>
          <strong>{popup.term}</strong>
          <p>{popup.detail}</p>
          <button type="button" className="btn btn-small" onClick={() => setPopup(null)}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
