import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useSession } from "../auth/AuthProvider";
import { FullScreenSpinner } from "../components/FullScreenSpinner";
import { Icon } from "../components/Icon";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { trackEvent } from "../lib/analytics";
import { COPY } from "../results/copy";
import { InlineError } from "../results/UpgradeNotice";
import type { DueReviewCard } from "../shared/reviewKeys";
import { listDueReviewCards, saveReviewRating } from "../shared/reviewQueue";
import type { ReviewRating } from "../shared/sm2";
import { initialReviewSession, REVIEW_RATINGS, reviewKeyCommand, reviewReducer } from "./reviewSession";
import { useInvalidateDueCount } from "./useDueCount";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ReviewPage() {
  useDocumentTitle("Review");
  const session = useSession();
  const userId = session.user.id;
  const [params] = useSearchParams();
  const scopeParam = params.get("savedResultId");
  const savedResultId = scopeParam && UUID_RE.test(scopeParam) ? scopeParam : undefined;
  const invalidateDueCount = useInvalidateDueCount(userId);

  const [loaded, setLoaded] = useState<DueReviewCard[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reviewReducer, [], initialReviewSession);
  const [seededFrom, setSeededFrom] = useState<DueReviewCard[] | null>(null);
  const startedAt = useRef(0);
  const trackedStart = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    let active = true;
    listDueReviewCards(userId, savedResultId)
      .then((items) => {
        if (active) {
          setLoaded(items);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(COPY.review.loadFailed);
        }
      });
    return () => {
      active = false;
    };
  }, [userId, savedResultId]);

  // Seed the session once per load (state adjusted during render, per React docs).
  if (loaded && loaded !== seededFrom) {
    setSeededFrom(loaded);
    dispatch({ type: "reset", queue: loaded });
  }
  useEffect(() => {
    if (!loaded) {
      return;
    }
    if (loaded.length > 0 && !trackedStart.current) {
      trackedStart.current = true;
      startedAt.current = Date.now();
      trackEvent("review_session_started");
    }
  }, [loaded]);

  const finish = useCallback(
    (cards: number) => {
      if (finished.current) {
        return;
      }
      finished.current = true;
      trackEvent("review_session_completed", { cards, duration: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)) });
      invalidateDueCount();
    },
    [invalidateDueCount],
  );

  const rate = useCallback(
    async (rating: ReviewRating) => {
      const current = state.queue[0];
      if (!current || state.saving) {
        return;
      }
      dispatch({ type: "saving" });
      setSaveError(null);
      try {
        await saveReviewRating(userId, current, rating);
        dispatch({ type: "rated" });
        if (state.queue.length - 1 === 0) {
          finish(state.completed + 1);
        }
      } catch {
        dispatch({ type: "save-failed" });
        setSaveError(COPY.review.saveFailed);
      }
    },
    [state, userId, finish],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const command = reviewKeyCommand(event.key, state.answerVisible);
      if (!command) {
        return;
      }
      event.preventDefault();
      if (command.type === "flip") {
        dispatch({ type: "flip" });
      } else {
        void rate(command.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.answerVisible, rate]);

  if (loadError) {
    return (
      <div className="review">
        <ReviewHeader completed={0} remaining={0} />
        <InlineError title={COPY.review.unavailableTitle} message={loadError} onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (!loaded) {
    return <FullScreenSpinner label="Loading your review cards" />;
  }

  const current = state.queue[0];
  return (
    <div className="review">
      <ReviewHeader completed={state.completed} remaining={state.queue.length} scoped={Boolean(savedResultId)} />
      {current ? (
        <>
          <button type="button" className="review-card card" onClick={() => dispatch({ type: "reveal" })} aria-live="polite">
            <span className="review-deck">{current.resultTitle}</span>
            <span className="review-prompt">{current.card.front}</span>
            {state.answerVisible ? (
              <span className="review-answer">{current.card.back}</span>
            ) : (
              <span className="review-reveal">{COPY.review.showAnswer}</span>
            )}
          </button>
          {state.answerVisible ? (
            <div className="review-ratings" role="group" aria-label="Rate this card">
              {REVIEW_RATINGS.map((item) => (
                <button
                  key={item.rating}
                  type="button"
                  className="review-rating"
                  disabled={state.saving}
                  style={{ borderColor: item.color, background: `${item.color}18`, color: item.color }}
                  onClick={() => void rate(item.rating)}
                >
                  {item.label}
                  <kbd>{item.key}</kbd>
                </button>
              ))}
            </div>
          ) : null}
          {saveError ? <InlineError title={COPY.review.unavailableTitle} message={saveError} /> : null}
          <p className="type-caption text-secondary review-hint">{COPY.review.keyboardHint}</p>
        </>
      ) : (
        <div className="review-empty card">
          <span className="review-check" aria-hidden="true">
            <Icon name="check" size={58} />
          </span>
          <h2 className="type-title">{state.completed > 0 ? COPY.review.sessionDone(state.completed) : COPY.review.emptyTitle}</h2>
          <p className="text-secondary">{COPY.review.emptyBody}</p>
          <div className="row-actions">
            <Link to="/library" className="btn btn-primary btn-small">
              Back to library
            </Link>
            {savedResultId ? (
              <Link to={`/results/${savedResultId}#flashcards`} className="btn btn-small">
                Back to flashcards
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewHeader({ completed, remaining, scoped }: { completed: number; remaining: number; scoped?: boolean }) {
  return (
    <header className="review-header">
      <Link to="/library" className="result-back" aria-label="Back to library">
        <Icon name="chevron-left" size={20} />
      </Link>
      <h1 className="type-title review-title">
        {COPY.review.title}
        {scoped ? <span className="pill">This deck</span> : null}
      </h1>
      <span className="type-caption text-secondary">
        {COPY.review.done(completed)}
        {remaining > 0 ? ` · ${remaining} left` : ""}
      </span>
    </header>
  );
}
