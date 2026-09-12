import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { useSession } from "../auth/AuthProvider";
import { Icon } from "../components/Icon";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { formatDate, formatDuration, sourceTypeLabel } from "../library/format";
import { useProfile } from "../profile/useProfile";
import { getEffectivePlan } from "../shared/profilePlan";
import { COPY } from "./copy";
import { MediaPlayer } from "./media/MediaPlayer";
import { IDLE_PLAYBACK, PlaybackContext, type PlaybackController } from "./media/playback";
import { resultDisplayTitle } from "./resultParse";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { ChatTab } from "./tabs/ChatTab";
import { FlashcardsTab } from "./tabs/FlashcardsTab";
import { MindMapTab } from "./tabs/MindMapTab";
import { QuizTab } from "./tabs/QuizTab";
import { SummaryTab } from "./tabs/SummaryTab";
import type { TabContext } from "./tabs/tabContext";
import { TranscriptPanel } from "./transcript/TranscriptPanel";
import { isResultId, usePersist, useResult, useResultPatch } from "./useResult";

const STUDY_TABS = [
  { id: "summary", label: "Summary" },
  { id: "flashcards", label: "Flashcards" },
  { id: "quiz", label: "Quiz" },
  { id: "chat", label: "Chat" },
  { id: "mindmap", label: "Mind map" },
] as const;
type StudyTab = (typeof STUDY_TABS)[number]["id"];
type AnyTab = StudyTab | "transcript";

function tabFromHash(hash: string): AnyTab {
  const id = hash.replace(/^#/, "");
  return id === "transcript" || STUDY_TABS.some((t) => t.id === id) ? (id as AnyTab) : "summary";
}

export function ResultPage() {
  const { id = "" } = useParams();
  const session = useSession();
  const userId = session.user.id;
  const query = useResult(userId, id);
  const patch = useResultPatch(userId, id);
  const persist = usePersist(userId, id);
  const { profile } = useProfile(userId);
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromHash(location.hash);
  const [playback, setPlayback] = useState<PlaybackController>(IDLE_PLAYBACK);
  const [shareOpen, setShareOpen] = useState(false);
  const onPlaybackState = useCallback((state: PlaybackController) => setPlayback(state), []);

  const view = query.data ?? null;
  useDocumentTitle(view ? "Result" : "Result");

  const planTier = useMemo(() => getEffectivePlan(profile ?? null), [profile]);
  const ctx: TabContext | null = view ? { view, userId, isFree: planTier === "free", planTier, patch, persist } : null;

  if (!isResultId(id) || (query.isSuccess && !view)) {
    return (
      <div className="result-placeholder card">
        <h1 className="type-title">Result not found</h1>
        <p className="text-secondary">This link doesn't point to a result in your library.</p>
        <Link to="/library" className="btn btn-small">
          Back to library
        </Link>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="result-placeholder card">
        <h1 className="type-title">{COPY.couldNotLoad}</h1>
        <button type="button" className="btn btn-small" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (!view || !ctx) {
    return <ResultSkeleton />;
  }

  const title = resultDisplayTitle(view);
  const isYoutube = Boolean(view.youtubeUrl);
  const setTab = (next: AnyTab) => navigate({ hash: next }, { replace: true });

  return (
    <PlaybackContext.Provider value={playback}>
      <div className="result">
        <header className="result-header">
          <Link to="/library" className="result-back" aria-label="Back to library">
            <Icon name="chevron-left" size={20} />
          </Link>
          <div className="result-heading">
            <h1 className="type-title result-title">{title}</h1>
            <div className="result-meta type-caption text-secondary">
              <span className="pill">{sourceTypeLabel(view.sourceType)}</span>
              <span>
                {formatDate(view.createdAt)} · {formatDuration(view.durationSeconds)}
              </span>
            </div>
          </div>
          <button type="button" className="btn btn-small" onClick={() => setShareOpen(true)} title={COPY.share.subtitle}>
            {COPY.share.button}
          </button>
        </header>
        {view.deletedAt ? (
          <div className="notice result-trashed" role="status">
            This result is in the trash. Restore it from the StudyPulse app to keep it.
          </div>
        ) : null}

        <div className="result-grid">
          <section className="result-left">
            <MediaPlayer sourceType={view.sourceType} sourceMediaUri={view.sourceMediaUri} youtubeUrl={view.youtubeUrl} onState={onPlaybackState} />
            <div className="result-transcript-card card">
              <h2 className="section-label">Transcript</h2>
              <TranscriptPanel segments={view.transcript.segments} wordTimings={view.wordTimings} isYoutube={isYoutube} />
            </div>
          </section>

          <section className="result-right">
            <nav className="tab-strip" role="tablist" aria-label="Study tools">
              <button
                type="button"
                role="tab"
                className={`tab-btn tab-btn-mobile${tab === "transcript" ? " is-active" : ""}`}
                aria-selected={tab === "transcript"}
                onClick={() => setTab("transcript")}
              >
                Transcript
              </button>
              {STUDY_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  className={`tab-btn${tab === t.id ? " is-active" : ""}`}
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="tab-panel card" role="tabpanel">
              {tab === "transcript" ? (
                <div className="tab-body tab-transcript-mobile">
                  <TranscriptPanel segments={view.transcript.segments} wordTimings={view.wordTimings} isYoutube={isYoutube} />
                </div>
              ) : tab === "summary" ? (
                <SummaryTab ctx={ctx} concepts={view.concepts} />
              ) : tab === "flashcards" ? (
                <FlashcardsTab ctx={ctx} />
              ) : tab === "quiz" ? (
                <QuizTab ctx={ctx} />
              ) : tab === "chat" ? (
                <ChatTab ctx={ctx} />
              ) : (
                <MindMapTab ctx={ctx} />
              )}
            </div>
          </section>
        </div>
        <ShareLinkDialog view={view} open={shareOpen} onClose={() => setShareOpen(false)} />
      </div>
    </PlaybackContext.Provider>
  );
}

function ResultSkeleton() {
  return (
    <div className="result" aria-busy="true">
      <div className="skeleton" style={{ height: 32, width: "40%", marginBottom: 16 }} />
      <div className="result-grid">
        <div className="skeleton" style={{ height: 420 }} />
        <div className="skeleton" style={{ height: 420 }} />
      </div>
      <span className="visually-hidden" role="status">
        Loading result
      </span>
    </div>
  );
}
