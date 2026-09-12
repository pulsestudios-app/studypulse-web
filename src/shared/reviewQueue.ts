// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/review/api.ts (lines 52-126)
// Keep in sync manually — no monorepo coupling. Changes vs source: imports point at the web Supabase client and ./reviewKeys; the
// in-memory join and the due filter are split out as pure functions (joinReviewCards, filterDueCards) with identical logic.

import { supabase } from "../lib/supabase";
import type { DueReviewCard, ReviewRow } from "./reviewKeys";
import type { ReviewRating } from "./sm2";
import { filterDueCards, joinReviewCards, nextReviewRow, type ReviewResultRow } from "./reviewQueueLogic";

export { filterDueCards, joinReviewCards, nextReviewRow, type ReviewResultRow } from "./reviewQueueLogic";

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

export async function saveReviewRating(userId: string, item: DueReviewCard, rating: ReviewRating): Promise<void> {
  const { error } = await supabase.from("card_reviews").upsert(nextReviewRow(userId, item, rating), { onConflict: "user_id,saved_result_id,card_key" });
  if (error) throw error;
}
