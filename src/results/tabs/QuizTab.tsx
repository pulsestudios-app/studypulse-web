import { useReducer, useState } from "react";

import { COPY } from "../copy";
import { classifyBackendError, generateQuiz, persistQuiz } from "../generationApi";
import {
  initialQuizState,
  QUIZ_COUNT_OPTIONS,
  QUIZ_DEFAULT_COUNT,
  QUIZ_TYPE_OPTIONS,
  quizPercent,
  quizReducer,
  type QuizCountOption,
  type QuizTypeOption,
} from "../quiz/quizState";
import { InlineError, UpgradeNotice } from "../UpgradeNotice";
import type { TabContext } from "./tabContext";

export function QuizTab({ ctx }: { ctx: TabContext }) {
  const { view, isFree, userId, patch, persist } = ctx;
  const questions = view.quiz;
  const [state, dispatch] = useReducer((s: ReturnType<typeof initialQuizState>, a: Parameters<typeof quizReducer>[1]) => quizReducer(s, a, questions), questions.length, initialQuizState);
  const [showGenerator, setShowGenerator] = useState(questions.length === 0);
  const [count, setCount] = useState<QuizCountOption>(QUIZ_DEFAULT_COUNT);
  const [type, setType] = useState<QuizTypeOption>("multiple_choice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);

  // A new quiz (generated or loaded) restarts the session — state adjusted during render, per React docs.
  const [seenQuestions, setSeenQuestions] = useState(questions);
  if (questions !== seenQuestions) {
    setSeenQuestions(questions);
    dispatch({ type: "reset" });
    setShowGenerator(questions.length === 0);
  }

  async function onGenerate() {
    if (!view.transcript.fullText.trim()) {
      setError({ kind: "other", message: COPY.quiz.noTranscript });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const quiz = await generateQuiz(view.transcript.fullText, count, type);
      patch({ quiz });
      persist.mutate(() => persistQuiz(userId, view.id, quiz));
    } catch (e) {
      setError(classifyBackendError(e, COPY.quiz.failed));
    } finally {
      setBusy(false);
    }
  }

  if (showGenerator) {
    if (isFree) {
      return (
        <div className="tab-body">
          <h3 className="type-title">{COPY.quiz.generateTitle}</h3>
          <UpgradeNotice message={COPY.quiz.gate} button={COPY.quiz.gateButton} feature={COPY.upgrade.quiz} />
          {questions.length > 0 ? (
            <button type="button" className="btn btn-small" onClick={() => setShowGenerator(false)}>
              Back to quiz
            </button>
          ) : null}
        </div>
      );
    }
    return (
      <div className="tab-body">
        <h3 className="type-title">{COPY.quiz.generateTitle}</h3>
        <div className="chip-group" role="group" aria-label={COPY.quiz.questionCount}>
          <span className="field-label">{COPY.quiz.questionCount}</span>
          <div className="chips">
            {QUIZ_COUNT_OPTIONS.map((n) => (
              <button key={n} type="button" className={`chip${count === n ? " chip-active" : ""}`} onClick={() => setCount(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="chip-group" role="group" aria-label={COPY.quiz.quizType}>
          <span className="field-label">{COPY.quiz.quizType}</span>
          <div className="chips">
            {QUIZ_TYPE_OPTIONS.map((t) => (
              <button key={t.id} type="button" className={`chip${type === t.id ? " chip-active" : ""}`} onClick={() => setType(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {error ? <InlineError title={COPY.quiz.failedTitle} message={error.message} /> : null}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => void onGenerate()} disabled={busy}>
            {busy ? COPY.quiz.generating : COPY.quiz.generate}
          </button>
          {questions.length > 0 ? (
            <button type="button" className="btn" onClick={() => setShowGenerator(false)} disabled={busy}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (state.complete) {
    const pct = quizPercent(state.score, questions.length);
    return (
      <div className="tab-body quiz-complete">
        <h3 className="type-title">{COPY.quiz.complete}</h3>
        <div className="card quiz-score">
          <span className="section-label">{COPY.quiz.yourScore}</span>
          <span className="quiz-score-big">
            {state.score} / {questions.length}
          </span>
          <span className="text-secondary">{COPY.quiz.percent(pct)}</span>
        </div>
        <ol className="quiz-review">
          {questions.map((q, i) => {
            const picked = state.answers[i];
            const correct = picked === q.correctIndex;
            return (
              <li key={i} className={`quiz-review-item${correct ? " is-correct" : " is-wrong"}`}>
                <span>{q.question}</span>
                <span className="type-caption text-secondary">
                  {correct ? "Correct" : `Correct answer: ${q.options[q.correctIndex] ?? "—"}`}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "reset" })}>
            {COPY.quiz.retry}
          </button>
          <button type="button" className="btn" onClick={() => setShowGenerator(true)}>
            {COPY.quiz.regenerate}
          </button>
        </div>
      </div>
    );
  }

  const question = questions[state.index];
  const revealed = state.selected !== null;
  return (
    <div className="tab-body">
      <div className="quiz-progress-row">
        <span className="type-caption text-secondary">{COPY.quiz.question(state.index, questions.length)}</span>
        <button type="button" className="btn btn-small" onClick={() => setShowGenerator(true)}>
          {COPY.quiz.regenerate}
        </button>
      </div>
      <div className="quiz-bar">
        <span style={{ width: `${((state.index + (revealed ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <h3 className="quiz-question">{question.question}</h3>
      <div className="quiz-options" role="group" aria-label="Answers">
        {question.options.map((option, i) => {
          let cls = "quiz-option";
          if (revealed) {
            if (i === question.correctIndex) {
              cls += " is-correct";
            } else if (i === state.selected) {
              cls += " is-wrong";
            }
          }
          return (
            <button key={i} type="button" className={cls} disabled={revealed} onClick={() => dispatch({ type: "select", option: i })}>
              <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {revealed ? (
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "next" })}>
          {state.index + 1 >= questions.length ? COPY.quiz.finish : COPY.quiz.next}
        </button>
      ) : null}
    </div>
  );
}
