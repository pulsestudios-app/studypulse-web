import type { QuizQuestion } from "../../shared/processingTypes";

/** Phone results screen quiz state: one selection per question, score counts correct picks, then complete. */
export type QuizState = {
  index: number;
  selected: number | null;
  score: number;
  complete: boolean;
  /** Per-question picks, for the review list on the score screen (not on the phone). */
  answers: (number | null)[];
};

export function initialQuizState(questionCount: number): QuizState {
  return { index: 0, selected: null, score: 0, complete: false, answers: Array(questionCount).fill(null) };
}

export type QuizAction = { type: "select"; option: number } | { type: "next" } | { type: "reset" };

export function quizReducer(state: QuizState, action: QuizAction, questions: QuizQuestion[]): QuizState {
  switch (action.type) {
    case "select": {
      const question = questions[state.index];
      if (!question || state.selected !== null || state.complete) {
        return state;
      }
      if (action.option < 0 || action.option >= question.options.length) {
        return state;
      }
      const answers = state.answers.slice();
      answers[state.index] = action.option;
      const correct = action.option === question.correctIndex;
      return { ...state, selected: action.option, score: correct ? state.score + 1 : state.score, answers };
    }
    case "next": {
      if (state.selected === null || state.complete) {
        return state;
      }
      if (state.index + 1 >= questions.length) {
        return { ...state, complete: true };
      }
      return { ...state, index: state.index + 1, selected: null };
    }
    case "reset":
      return initialQuizState(questions.length);
    default:
      return state;
  }
}

/** Phone QuizTab: `${Math.round((score / total) * 100)}% correct answers`. */
export function quizPercent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export const QUIZ_COUNT_OPTIONS = [5, 7, 10, 15, 20] as const;
export type QuizCountOption = (typeof QUIZ_COUNT_OPTIONS)[number];
export const QUIZ_DEFAULT_COUNT: QuizCountOption = 7;

export const QUIZ_TYPE_OPTIONS = [
  { id: "multiple_choice", label: "Multiple Choice" },
  { id: "true_false", label: "True/False" },
  { id: "mixed", label: "Mixed" },
] as const;
export type QuizTypeOption = (typeof QUIZ_TYPE_OPTIONS)[number]["id"];
