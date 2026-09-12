import { describe, expect, it } from "vitest";

import type { QuizQuestion } from "../../shared/processingTypes";
import { initialQuizState, QUIZ_COUNT_OPTIONS, QUIZ_TYPE_OPTIONS, quizPercent, quizReducer } from "./quizState";

const questions: QuizQuestion[] = [
  { question: "1+1", options: ["1", "2"], correctIndex: 1 },
  { question: "2+2", options: ["4", "5"], correctIndex: 0 },
];

describe("quizReducer (phone handleSelectAnswer/handleNextQuestion/resetQuiz)", () => {
  it("scores correct picks once, ignores re-selection, and completes after the last question", () => {
    let s = initialQuizState(questions.length);
    s = quizReducer(s, { type: "next" }, questions); // nothing selected → no-op
    expect(s.index).toBe(0);
    s = quizReducer(s, { type: "select", option: 1 }, questions);
    expect(s.score).toBe(1);
    s = quizReducer(s, { type: "select", option: 0 }, questions); // locked
    expect(s.score).toBe(1);
    expect(s.selected).toBe(1);
    s = quizReducer(s, { type: "next" }, questions);
    expect(s).toMatchObject({ index: 1, selected: null, complete: false });
    s = quizReducer(s, { type: "select", option: 1 }, questions); // wrong
    expect(s.score).toBe(1);
    s = quizReducer(s, { type: "next" }, questions);
    expect(s.complete).toBe(true);
    expect(s.answers).toEqual([1, 1]);
    s = quizReducer(s, { type: "reset" }, questions);
    expect(s).toEqual(initialQuizState(2));
  });

  it("rejects out-of-range options", () => {
    const s = quizReducer(initialQuizState(2), { type: "select", option: 5 }, questions);
    expect(s.selected).toBeNull();
  });

  it("percent matches the phone's rounding", () => {
    expect(quizPercent(1, 3)).toBe(33);
    expect(quizPercent(2, 3)).toBe(67);
    expect(quizPercent(0, 0)).toBe(0);
  });

  it("offers the phone's generator options", () => {
    expect([...QUIZ_COUNT_OPTIONS]).toEqual([5, 7, 10, 15, 20]);
    expect(QUIZ_TYPE_OPTIONS.map((o) => o.label)).toEqual(["Multiple Choice", "True/False", "Mixed"]);
  });
});
