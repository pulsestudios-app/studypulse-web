// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/review/api.ts (lines 52-126)
// Keep in sync manually — no monorepo coupling. Changes vs source: the pure parts (join, due filter, SM-2 row) live here without
// a Supabase import so tests run config-free; the queries are in ./reviewQueue.ts.

import type { Flashcard } from "./processingTypes";
import { flashcardKey, validFlashcards, type DueReviewCard, type ReviewRow } from "./reviewKeys";
import { INITIAL_REVIEW_STATE, scheduleReview, type ReviewRating, type ReviewState } from "./sm2";

export type ReviewResultRow = { id: string; title: string | null; flashcards: unknown };

/** Source lines 65-75: join every valid flashcard with its review row by (saved_result_id, flashcardKey). */
export function joinReviewCards(results: ReviewResultRow[], reviews: ReviewRow[]): DueReviewCard[] {
  const reviewByKey = new Map<string, ReviewRow>();
  for (const row of reviews) reviewByKey.set(`${row.saved_result_id}:${row.card_key}`, row);
  const cards: DueReviewCard[] = [];
  for (const result of results) {
    for (const card of validFlashcards(result.flashcards) as Flashcard[]) {
      const cardKey = flashcardKey(card);
      const review = reviewByKey.get(`${result.id}:${cardKey}`) ?? null;
      cards.push({ savedResultId: result.id, resultTitle: result.title ?? "", cardKey, card, review });
    }
  }
  return cards.sort((a, b) => (a.review?.due_at ?? "").localeCompare(b.review?.due_at ?? ""));
}

/** Source lines 78-83: a card with no review row is due immediately. */
export function filterDueCards(cards: DueReviewCard[], now = Date.now()): DueReviewCard[] {
  return cards.filter((item) => !item.review || new Date(item.review.due_at).getTime() <= now);
}

/** Source lines 104-126: SM-2 step + upsert on (user_id, saved_result_id, card_key). */
export function nextReviewRow(userId: string, item: DueReviewCard, rating: ReviewRating, reviewedAt = new Date()) {
  const state: ReviewState = item.review ? {
    ease: item.review.ease,
    intervalDays: item.review.interval_days,
    repetitions: item.review.repetitions,
    lapses: item.review.lapses,
  } : INITIAL_REVIEW_STATE;
  const next = scheduleReview(state, rating, reviewedAt);
  return {
    user_id: userId,
    saved_result_id: item.savedResultId,
    card_key: item.cardKey,
    ease: next.ease,
    interval_days: next.intervalDays,
    repetitions: next.repetitions,
    lapses: next.lapses,
    due_at: next.dueAt.toISOString(),
    last_reviewed_at: reviewedAt.toISOString(),
    updated_at: reviewedAt.toISOString(),
  };
}

