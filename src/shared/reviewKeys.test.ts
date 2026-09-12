import { describe, expect, it } from "vitest";

import { flashcardKey, validFlashcards } from "./reviewKeys";
import { INITIAL_REVIEW_STATE, scheduleReview } from "./sm2";

describe("flashcardKey parity with the phone (vectors computed from launch-ota src/features/review/api.ts)", () => {
  it("normalizes whitespace and case, producing 16 hex chars", () => {
    expect(flashcardKey({ front: "  What is   Mitosis?", back: "Cell Division " })).toBe("be541eae9af36862");
    expect(flashcardKey({ front: "what is mitosis?", back: "cell division" })).toBe("be541eae9af36862");
    expect(flashcardKey({ front: "Front", back: "Back" })).toBe("64b5c622898d994e");
    expect(flashcardKey({ front: "Front", back: "Back" })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("validFlashcards", () => {
  it("requires string front/back/type", () => {
    expect(validFlashcards([{ front: "a", back: "b", type: "qa" }, { front: "a", back: "b" }, null])).toEqual([{ front: "a", back: "b", type: "qa" }]);
  });
});

describe("scheduleReview (SM-2 variant)", () => {
  it("again resets repetitions and counts a lapse; good grows the interval", () => {
    const at = new Date("2026-09-12T00:00:00Z");
    const again = scheduleReview(INITIAL_REVIEW_STATE, "again", at);
    expect(again).toMatchObject({ intervalDays: 1, repetitions: 0, lapses: 1 });
    const first = scheduleReview(INITIAL_REVIEW_STATE, "good", at);
    expect(first).toMatchObject({ intervalDays: 1, repetitions: 1 });
    const second = scheduleReview(first, "good", at);
    expect(second.intervalDays).toBe(6);
    expect(second.dueAt.toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });
});
