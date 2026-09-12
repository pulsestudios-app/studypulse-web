import type { DueReviewCard } from "../shared/reviewKeys";
import type { ReviewRating } from "../shared/sm2";

/** Phone app/review.tsx: the queue pops its head after each rating; the answer hides again. */
export type ReviewSession = {
  queue: DueReviewCard[];
  answerVisible: boolean;
  completed: number;
  saving: boolean;
};

export function initialReviewSession(queue: DueReviewCard[]): ReviewSession {
  return { queue, answerVisible: false, completed: 0, saving: false };
}

export type ReviewAction =
  | { type: "reset"; queue: DueReviewCard[] }
  | { type: "reveal" }
  | { type: "flip" }
  | { type: "saving" }
  | { type: "rated" }
  | { type: "save-failed" };

export function reviewReducer(state: ReviewSession, action: ReviewAction): ReviewSession {
  switch (action.type) {
    case "reset":
      return initialReviewSession(action.queue);
    case "reveal":
      return state.answerVisible || !state.queue.length ? state : { ...state, answerVisible: true };
    case "flip":
      return state.queue.length ? { ...state, answerVisible: !state.answerVisible } : state;
    case "saving":
      return state.saving || !state.queue.length ? state : { ...state, saving: true };
    case "rated":
      return { queue: state.queue.slice(1), answerVisible: false, completed: state.completed + 1, saving: false };
    case "save-failed":
      return { ...state, saving: false };
    default:
      return state;
  }
}

/** Phone RATINGS order and colours (app/review.tsx:15-20). */
export const REVIEW_RATINGS: { rating: ReviewRating; label: string; color: string; key: string }[] = [
  { rating: "again", label: "Again", color: "#FF6B6B", key: "1" },
  { rating: "hard", label: "Hard", color: "#FFD93D", key: "2" },
  { rating: "good", label: "Good", color: "#58CC02", key: "3" },
  { rating: "easy", label: "Easy", color: "#1CB0F6", key: "4" },
];

export type ReviewKeyCommand = { type: "flip" } | { type: "rate"; rating: ReviewRating } | null;

/** Space/Enter flip; 1-4 rate, but only once the answer is showing (web addition; the phone has no keyboard). */
export function reviewKeyCommand(key: string, answerVisible: boolean): ReviewKeyCommand {
  if (key === " " || key === "Enter") {
    return { type: "flip" };
  }
  if (!answerVisible) {
    return null;
  }
  const match = REVIEW_RATINGS.find((r) => r.key === key);
  return match ? { type: "rate", rating: match.rating } : null;
}
