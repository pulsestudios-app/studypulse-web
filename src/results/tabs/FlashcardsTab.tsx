import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { Flashcard } from "../../shared/processingTypes";
import { COPY } from "../copy";
import { classifyBackendError, generateFlashcards, persistFlashcards } from "../generationApi";
import { InlineError, UpgradeNotice } from "../UpgradeNotice";
import type { TabContext } from "./tabContext";

type Verdict = "knew" | "review" | "didnt";

const COUNT_OPTIONS = [5, 10, 15, 20] as const;

function pickKnewItMessage(): string {
  const list = COPY.flashcards.feedbackKnewIt;
  return list[Math.floor(Math.random() * list.length)];
}

export function FlashcardsTab({ ctx }: { ctx: TabContext }) {
  const { view, isFree, userId, patch, persist } = ctx;
  const cards = view.flashcards;
  const countOptions = isFree ? ([5] as const) : COUNT_OPTIONS;
  const [count, setCount] = useState<number>(isFree ? 5 : 10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const [showGenerator, setShowGenerator] = useState(cards.length === 0);

  // Session state (phone: deck queue with reviewed counts and a session-complete screen).
  const [queue, setQueue] = useState<Flashcard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<Verdict, number>>({ knew: 0, review: 0, didnt: 0 });
  const [hardCards, setHardCards] = useState<Flashcard[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const resetSession = (deck: Flashcard[]) => {
    setQueue(deck);
    setIndex(0);
    setFlipped(false);
    setVerdicts({ knew: 0, review: 0, didnt: 0 });
    setHardCards([]);
    setFeedback(null);
  };

  // A new deck (generated or loaded) restarts the session — state adjusted during render, per React docs.
  const [seenCards, setSeenCards] = useState(cards);
  if (cards !== seenCards) {
    setSeenCards(cards);
    resetSession(cards);
    setShowGenerator(cards.length === 0);
  }

  useEffect(() => {
    if (!feedback) {
      return;
    }
    const t = window.setTimeout(() => setFeedback(null), 1400);
    return () => window.clearTimeout(t);
  }, [feedback]);

  async function onGenerate() {
    if (!view.transcript.fullText.trim()) {
      setError({ kind: "other", message: COPY.quiz.noTranscript });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await generateFlashcards(view.transcript.fullText, count, cards);
      patch({ flashcards: next });
      persist.mutate(() => persistFlashcards(userId, view.id, next));
    } catch (e) {
      setError(classifyBackendError(e, "Flashcard generation failed."));
    } finally {
      setBusy(false);
    }
  }

  const answer = (verdict: Verdict) => {
    const card = queue[index];
    if (!card) {
      return;
    }
    setVerdicts((v) => ({ ...v, [verdict]: v[verdict] + 1 }));
    if (verdict === "knew") {
      setFeedback(pickKnewItMessage());
    } else {
      setFeedback(verdict === "review" ? COPY.flashcards.feedbackNeedReview : COPY.flashcards.feedbackDidntKnow);
      setHardCards((h) => [...h, card]);
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showGenerator || index >= queue.length || (e.target as HTMLElement)?.tagName === "INPUT") {
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && e.key === "1") {
        answer("knew");
      } else if (flipped && e.key === "2") {
        answer("review");
      } else if (flipped && e.key === "3") {
        answer("didnt");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGenerator, index, queue.length, flipped]);

  const generator = (
    <div className="tab-body">
      {isFree && cards.length > 0 ? (
        <UpgradeNotice message={COPY.flashcards.gate} button={COPY.flashcards.gateNewSet} feature={COPY.upgrade.flashcards} />
      ) : isFree ? (
        <UpgradeNotice message={COPY.flashcards.gate} button={COPY.flashcards.gateButton} feature={COPY.upgrade.flashcards} />
      ) : (
        <>
          <div className="chip-group">
            <span className="field-label">Cards</span>
            <div className="chips">
              {countOptions.map((n) => (
                <button key={n} type="button" className={`chip${count === n ? " chip-active" : ""}`} onClick={() => setCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {error ? <InlineError title={COPY.flashcards.failedTitle} message={error.message} /> : null}
          <button type="button" className="btn btn-primary" onClick={() => void onGenerate()} disabled={busy}>
            {busy ? COPY.flashcards.generating(count) : COPY.flashcards.generate}
          </button>
        </>
      )}
      {cards.length > 0 ? (
        <button type="button" className="btn btn-small" onClick={() => setShowGenerator(false)} disabled={busy}>
          Back to cards
        </button>
      ) : null}
    </div>
  );

  if (showGenerator) {
    return generator;
  }

  const total = queue.length;
  const reviewed = Math.min(index, total);
  const header = (
    <div className="flash-header">
      <div className="flash-progress">
        <div className="quiz-bar">
          <span style={{ width: `${Math.max((total > 0 ? reviewed / total : 0) * 100, 6)}%` }} />
        </div>
        <span className="type-caption text-secondary">{COPY.flashcards.progress(reviewed, total)}</span>
      </div>
      <Link to={`/review?savedResultId=${encodeURIComponent(view.id)}`} className="btn btn-small" aria-label={COPY.flashcards.reviewAria}>
        {COPY.flashcards.review}
      </Link>
    </div>
  );

  if (index >= total) {
    return (
      <div className="tab-body flash-complete">
        {header}
        <div className="card flash-complete-card">
          <span className="flash-complete-emoji" aria-hidden="true">
            🎉
          </span>
          <h3 className="type-title">{COPY.flashcards.sessionComplete}</h3>
          <dl className="flash-stats">
            <div>
              <dt>{COPY.flashcards.knewIt}</dt>
              <dd>{verdicts.knew}</dd>
            </div>
            <div>
              <dt>{COPY.flashcards.needReview}</dt>
              <dd>{verdicts.review}</dd>
            </div>
            <div>
              <dt>{COPY.flashcards.didntKnow}</dt>
              <dd>{verdicts.didnt}</dd>
            </div>
          </dl>
          <p className="type-caption text-secondary">{COPY.flashcards.reviewHint}</p>
          <div className="row-actions">
            {hardCards.length > 0 ? (
              <button type="button" className="btn btn-primary" onClick={() => resetSession(hardCards)}>
                {COPY.flashcards.reviewHard}
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => setShowGenerator(true)}>
              {isFree ? COPY.flashcards.gateNewSet : COPY.flashcards.newSet}
            </button>
            <button type="button" className="btn" onClick={() => resetSession(cards)}>
              {COPY.flashcards.reviewAll}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const card = queue[index];
  return (
    <div className="tab-body">
      {header}
      <button
        type="button"
        className={`flashcard${flipped ? " is-flipped" : ""}`}
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? COPY.flashcards.tapQuestion : COPY.flashcards.tapReveal}
      >
        <span className="flashcard-inner">
          <span className="flashcard-face flashcard-front">{card.front}</span>
          <span className="flashcard-face flashcard-back">{card.back}</span>
        </span>
      </button>
      <p className="type-caption text-secondary flash-hint" aria-live="polite">
        {feedback ?? (flipped ? COPY.flashcards.tapQuestion : COPY.flashcards.tapReveal)}
      </p>
      {flipped ? (
        <div className="row-actions flash-verdicts">
          <button type="button" className="btn btn-primary" onClick={() => answer("knew")}>
            {COPY.flashcards.knewIt}
          </button>
          <button type="button" className="btn" onClick={() => answer("review")}>
            {COPY.flashcards.needReview}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => answer("didnt")}>
            {COPY.flashcards.didntKnow}
          </button>
        </div>
      ) : null}
      <div className="row-actions flash-footer">
        <span className="type-caption text-secondary">
          {index + 1} / {total}
        </span>
        <button type="button" className="btn btn-small" onClick={() => setShowGenerator(true)}>
          {isFree ? COPY.flashcards.gateNewSet : COPY.flashcards.newSet}
        </button>
      </div>
    </div>
  );
}
