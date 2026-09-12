// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/features/review/api.ts (lines 5-42: types + flashcardKey; line 44-50 validFlashcards)
// Keep in sync manually — no monorepo coupling. Changes vs source: excerpt (Supabase calls omitted); import path adjusted.

import type { Flashcard } from "./processingTypes";

export type ReviewRow = {
  id?: string;
  user_id: string;
  saved_result_id: string;
  card_key: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due_at: string;
  last_reviewed_at: string | null;
};

export type DueReviewCard = {
  savedResultId: string;
  resultTitle: string;
  cardKey: string;
  card: Flashcard;
  review: ReviewRow | null;
};

function normalizeCardPart(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Two seeded FNV-1a passes give a compact, deterministic 64-bit-style key without a native dependency. */
export function flashcardKey(card: Pick<Flashcard, "front" | "back">): string {
  const input = `${normalizeCardPart(card.front)}\u001f${normalizeCardPart(card.back)}`;
  const hash = (seed: number) => {
    let value = seed >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      value ^= input.charCodeAt(i);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, "0");
  };
  return `${hash(0x811c9dc5)}${hash(0x9e3779b9)}`;
}

export function validFlashcards(value: unknown): Flashcard[] {
  if (!Array.isArray(value)) return [];
  return value.filter((card): card is Flashcard =>
    !!card && typeof card === "object" && typeof card.front === "string" &&
    typeof card.back === "string" && typeof card.type === "string"
  );
}
