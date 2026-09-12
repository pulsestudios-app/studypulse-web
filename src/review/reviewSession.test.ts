import { describe, expect, it } from "vitest";

import type { DueReviewCard } from "../shared/reviewKeys";
import { filterDueCards, joinReviewCards, nextReviewRow } from "../shared/reviewQueue";
import { initialReviewSession, REVIEW_RATINGS, reviewKeyCommand, reviewReducer } from "./reviewSession";

const card = (id: string, front: string, review: DueReviewCard["review"] = null): DueReviewCard => ({
  savedResultId: id,
  resultTitle: "Deck",
  cardKey: `key-${front}`,
  card: { front, back: "b", type: "qa" },
  review,
});

describe("due queue (phone review/api.ts)", () => {
  const now = Date.parse("2026-09-12T12:00:00Z");
  const row = (saved: string, key: string, due: string) => ({
    user_id: "u",
    saved_result_id: saved,
    card_key: key,
    ease: 2.5,
    interval_days: 1,
    repetitions: 1,
    lapses: 0,
    due_at: due,
    last_reviewed_at: null,
  });

  it("joins cards to review rows by (saved_result_id, flashcardKey) and sorts by due_at", () => {
    const results = [
      { id: "r1", title: "One", flashcards: [{ front: "A", back: "a", type: "qa" }, { front: "B", back: "b", type: "qa" }, { front: "", back: "x" }] },
      { id: "r2", title: null, flashcards: null },
    ];
    const a = joinReviewCards(results, []);
    expect(a.map((c) => c.card.front)).toEqual(["A", "B"]);
    expect(a[0].review).toBeNull();
    expect(a[0].resultTitle).toBe("One");
    const keyA = a[0].cardKey;
    const keyB = a[1].cardKey;
    const joined = joinReviewCards(results, [row("r1", keyB, "2026-09-10T00:00:00Z"), row("r1", keyA, "2026-09-20T00:00:00Z"), row("other", keyA, "2020-01-01T00:00:00Z")]);
    expect(joined.map((c) => c.card.front)).toEqual(["B", "A"]);
    expect(joined[1].review?.due_at).toBe("2026-09-20T00:00:00Z");
  });

  it("a card with no row is due; past due_at is due; future is not", () => {
    const cards = [card("r", "none"), card("r", "past", row("r", "k", "2026-09-12T11:59:59Z")), card("r", "future", row("r", "k", "2026-09-12T12:00:01Z")), card("r", "exact", row("r", "k", "2026-09-12T12:00:00Z"))];
    expect(filterDueCards(cards, now).map((c) => c.card.front)).toEqual(["none", "past", "exact"]);
  });

  it("nextReviewRow applies SM-2 from the stored row and upserts the phone's column set", () => {
    const at = new Date("2026-09-12T12:00:00Z");
    const fresh = nextReviewRow("u", card("r", "x"), "good", at);
    expect(fresh).toMatchObject({ user_id: "u", saved_result_id: "r", card_key: "key-x", interval_days: 1, repetitions: 1, lapses: 0, due_at: "2026-09-13T12:00:00.000Z", last_reviewed_at: at.toISOString() });
    const again = nextReviewRow("u", card("r", "x", { ...row("r", "key-x", "2026-09-01T00:00:00Z"), repetitions: 3, interval_days: 6 }), "again", at);
    expect(again).toMatchObject({ repetitions: 0, lapses: 1, interval_days: 1 });
  });
});

describe("review session state machine (phone app/review.tsx)", () => {
  const queue = [card("r", "1"), card("r", "2")];
  it("reveal → rate pops the head, hides the answer, counts completed", () => {
    let s = initialReviewSession(queue);
    s = reviewReducer(s, { type: "saving" }); // ignored until revealed? phone allows rate only after reveal via UI; reducer just guards saving
    expect(s.saving).toBe(true);
    s = reviewReducer(s, { type: "save-failed" });
    expect(s.saving).toBe(false);
    s = reviewReducer(s, { type: "reveal" });
    expect(s.answerVisible).toBe(true);
    s = reviewReducer(s, { type: "rated" });
    expect(s).toEqual({ queue: [queue[1]], answerVisible: false, completed: 1, saving: false });
    s = reviewReducer(s, { type: "flip" });
    expect(s.answerVisible).toBe(true);
    s = reviewReducer(s, { type: "rated" });
    expect(s.queue).toEqual([]);
    expect(s.completed).toBe(2);
    expect(reviewReducer(s, { type: "flip" })).toBe(s); // nothing to flip
    expect(reviewReducer(s, { type: "reset", queue })).toEqual(initialReviewSession(queue));
  });

  it("keyboard: space/enter flips; 1-4 rate only after reveal", () => {
    expect(reviewKeyCommand(" ", false)).toEqual({ type: "flip" });
    expect(reviewKeyCommand("Enter", true)).toEqual({ type: "flip" });
    expect(reviewKeyCommand("1", false)).toBeNull();
    expect(reviewKeyCommand("1", true)).toEqual({ type: "rate", rating: "again" });
    expect(reviewKeyCommand("4", true)).toEqual({ type: "rate", rating: "easy" });
    expect(reviewKeyCommand("5", true)).toBeNull();
    expect(REVIEW_RATINGS.map((r) => [r.label, r.color])).toEqual([["Again", "#FF6B6B"], ["Hard", "#FFD93D"], ["Good", "#58CC02"], ["Easy", "#1CB0F6"]]);
  });
});
