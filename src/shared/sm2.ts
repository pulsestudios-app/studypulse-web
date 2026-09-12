// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/review/sm2.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type ReviewState = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
};

export const INITIAL_REVIEW_STATE: ReviewState = {
  ease: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
};

const QUALITY: Record<ReviewRating, number> = { again: 0, hard: 3, good: 4, easy: 5 };

export function scheduleReview(
  state: ReviewState,
  rating: ReviewRating,
  reviewedAt = new Date()
): ReviewState & { dueAt: Date } {
  const quality = QUALITY[rating];
  const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const ease = Math.max(1.3, Math.min(5, state.ease + easeDelta));

  if (rating === "again") {
    const intervalDays = 1;
    return {
      ease,
      intervalDays,
      repetitions: 0,
      lapses: state.lapses + 1,
      dueAt: addDays(reviewedAt, intervalDays),
    };
  }

  const repetitions = state.repetitions + 1;
  let intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(state.intervalDays * ease));
  if (rating === "hard" && repetitions > 1) intervalDays = Math.max(2, Math.round(intervalDays * 0.8));
  if (rating === "easy") intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * 1.3));
  return { ease, intervalDays, repetitions, lapses: state.lapses, dueAt: addDays(reviewedAt, intervalDays) };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
