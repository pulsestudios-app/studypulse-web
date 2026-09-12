import type { ShareScope } from "./generationApi";
import type { ResultView } from "./resultParse";

/** Phone ShareLinkModal `available`: an option is enabled only when that section has content. */
export function shareAvailability(view: Pick<ResultView, "summary" | "flashcards" | "quiz">): Record<ShareScope, boolean> {
  return {
    summary: Boolean(view.summary.mainIdea.trim() || view.summary.keyPoints.length),
    flashcards: view.flashcards.length > 0,
    quiz: view.quiz.length > 0,
  };
}
