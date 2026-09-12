// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/review/api.ts (lines 52-126)
// Keep in sync manually — no monorepo coupling. Changes vs source: imports point at the web Supabase client and ./reviewKeys; the
// in-memory join and the due filter are split out as pure functions (joinReviewCards, filterDueCards) with identical logic.

import { supabase } from "../lib/supabase";
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

async function listReviewCards(userId: string, savedResultId?: string): Promise<DueReviewCard[]> {
  let resultsQuery = supabase
    .from("saved_results")
    .select("id,title,flashcards")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (savedResultId) resultsQuery = resultsQuery.eq("id", savedResultId);
  const [{ data: results, error: resultError }, { data: reviews, error: reviewError }] = await Promise.all([
    resultsQuery,
    supabase.from("card_reviews").select("*").eq("user_id", userId),
  ]);
  if (resultError) throw resultError;
  if (reviewError) throw reviewError;
  return joinReviewCards((results ?? []) as ReviewResultRow[], (reviews ?? []) as ReviewRow[]);
}

export async function listDueReviewCards(userId: string, savedResultId?: string): Promise<DueReviewCard[]> {
  return filterDueCards(await listReviewCards(userId, savedResultId));
}

export async function countDueReviewCards(userId: string): Promise<number> {
  return (await listDueReviewCards(userId)).length;
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

export async function saveReviewRating(userId: string, item: DueReviewCard, rating: ReviewRating): Promise<void> {
  const { error } = await supabase.from("card_reviews").upsert(nextReviewRow(userId, item, rating), { onConflict: "user_id,saved_result_id,card_key" });
  if (error) throw error;
}
