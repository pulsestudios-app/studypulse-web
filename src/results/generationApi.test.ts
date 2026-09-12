import { describe, expect, it } from "vitest";

import { BackendError } from "../lib/backendErrors";
import { COPY } from "./copy";
import { classifyBackendError } from "./errorClassify";
import { shareAvailability } from "./shareAvailability";

describe("classifyBackendError (phone throwFromBackendError + friendlyAiErrorMessage)", () => {
  it("maps the server's gate and limit codes", () => {
    expect(classifyBackendError(new BackendError("Quiz generation is not available on the free plan.", 403, "QUIZ_FORBIDDEN"), "x")).toEqual({
      kind: "gated",
      message: "Quiz generation is not available on the free plan.",
    });
    expect(classifyBackendError(new BackendError(COPY.chat.limitReached, 403, "CHAT_LIMIT_REACHED"), "x")).toEqual({
      kind: "limit",
      message: COPY.chat.limitReached,
    });
    expect(classifyBackendError(new BackendError("ignored", 403, "EMAIL_NOT_VERIFIED"), "x").message).toBe(COPY.emailNotVerified);
    expect(classifyBackendError(new BackendError("x", 503, "CLAUDE_OVERLOADED"), "x")).toEqual({ kind: "busy", message: COPY.aiBusy });
    expect(classifyBackendError(new BackendError("slow down", 429, "CHAT_RATE_LIMITED"), "x")).toEqual({ kind: "limit", message: "slow down" });
  });

  it("falls back to the caller's message for unknown errors", () => {
    expect(classifyBackendError(new Error(""), "Fallback")).toEqual({ kind: "other", message: "Fallback" });
    expect(classifyBackendError("boom", "Fallback")).toEqual({ kind: "other", message: "Fallback" });
  });
});

describe("shareAvailability (phone ShareLinkModal)", () => {
  it("enables only sections with content", () => {
    expect(shareAvailability({ summary: { mainIdea: "", keyPoints: [] }, flashcards: [], quiz: [] })).toEqual({
      summary: false,
      flashcards: false,
      quiz: false,
    });
    expect(
      shareAvailability({
        summary: { mainIdea: "", keyPoints: ["k"] },
        flashcards: [{ front: "a", back: "b", type: "qa" }],
        quiz: [{ question: "q", options: ["a"], correctIndex: 0 }],
      }),
    ).toEqual({ summary: true, flashcards: true, quiz: true });
  });
});
