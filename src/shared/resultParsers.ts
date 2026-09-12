// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/processing/api.ts (lines 128-141 parseWordTimingsList; 231-266 quiz/flashcard element parsing from normalizeProcessResult)
// Keep in sync manually — no monorepo coupling. Changes vs source: excerpt; the quiz/flashcard element parsers are lifted out of normalizeProcessResult into standalone functions with identical logic.

import type { Flashcard, QuizQuestion, WordTiming } from "./processingTypes";

export function parseWordTimingsList(raw: unknown): WordTiming[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((w): w is Record<string, unknown> => !!w && typeof w === "object")
    .map((w) => ({
      word: typeof w.word === "string" ? w.word : "",
      start: typeof w.start === "number" && Number.isFinite(w.start) ? w.start : 0,
      end: typeof w.end === "number" && Number.isFinite(w.end) ? w.end : 0,
      speaker: typeof w.speaker === "string" ? w.speaker : "Speaker A",
    }))
    .filter((w) => w.word.length > 0);
}

export function parseQuizList(quizRaw: unknown): QuizQuestion[] {
  return Array.isArray(quizRaw)
    ? quizRaw
        .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
        .map((q) => {
          const opts = Array.isArray(q.options) ? q.options.filter((x): x is string => typeof x === "string") : [];
          let correctIndex = 0;
          if (typeof q.correctIndex === "number" && Number.isFinite(q.correctIndex)) {
            const maxIndex = Math.max(0, opts.length - 1);
            correctIndex = Math.min(maxIndex, Math.max(0, Math.floor(q.correctIndex)));
          } else if (typeof q.correctIndex === "string") {
            const n = Number.parseInt(q.correctIndex, 10);
            if (Number.isFinite(n)) {
              const maxIndex = Math.max(0, opts.length - 1);
              correctIndex = Math.min(maxIndex, Math.max(0, n));
            }
          }
          return {
            question: typeof q.question === "string" ? q.question : "",
            options: opts.slice(0, 4),
            correctIndex,
          };
        })
    : [];
}

export function parseFlashcardList(flashcardsRaw: unknown): Flashcard[] {
  return Array.isArray(flashcardsRaw)
    ? flashcardsRaw
        .filter((card): card is Record<string, unknown> => !!card && typeof card === "object")
        .map((card) => ({
          front: typeof card.front === "string" ? card.front.trim() : "",
          back: typeof card.back === "string" ? card.back.trim() : "",
          type: typeof card.type === "string" ? card.type : "standard",
        }))
        .filter((card) => card.front.length > 0 && card.back.length > 0)
    : [];
}
