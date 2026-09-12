import { backendFetch, BackendError } from "../lib/backend";
import { supabase } from "../lib/supabase";
import { hasMindMapContent, normalizeMindMapPayload, type MindMapBranchCount, type MindMapPayload } from "../shared/mindMapTypes";
import type { Flashcard, QuizQuestion } from "../shared/processingTypes";
import { parseFlashcardList, parseQuizList } from "../shared/resultParsers";
import { COPY } from "./copy";
import type { ChatTurn } from "./resultParse";

/**
 * Same endpoints/bodies as the phone (src/features/processing/api.ts). `planTier`/`userId` are
 * ignored server-side (it reads `profiles`), so they are not sent. Plan gates are 403s.
 */

export type GenerationErrorKind = "gated" | "limit" | "email" | "busy" | "other";

/** Phone `throwFromBackendError` + `friendlyAiErrorMessage`, collapsed into one classification. */
export function classifyBackendError(error: unknown, fallback: string): { kind: GenerationErrorKind; message: string } {
  if (error instanceof BackendError) {
    const code = error.code ?? "";
    if (code === "EMAIL_NOT_VERIFIED") {
      return { kind: "email", message: COPY.emailNotVerified };
    }
    if (code === "CHAT_LIMIT_REACHED" || code === "FEATURE_LIMIT_REACHED") {
      return { kind: "limit", message: error.message };
    }
    if (code === "QUIZ_FORBIDDEN" || code === "MINDMAP_FORBIDDEN" || code === "SUMMARY_FORBIDDEN" || code === "QUOTA_EXCEEDED") {
      return { kind: "gated", message: error.message };
    }
    if (code === "CLAUDE_OVERLOADED" || error.status === 503 || error.status === 529) {
      return { kind: "busy", message: COPY.aiBusy };
    }
    if (code.endsWith("_RATE_LIMITED") || error.status === 429) {
      return { kind: "limit", message: error.message || "Too many requests. Please try again in a few minutes." };
    }
    return { kind: "other", message: error.message || fallback };
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("verify your email")) {
    return { kind: "email", message: COPY.emailNotVerified };
  }
  return { kind: "other", message: message || fallback };
}

export async function generateQuiz(transcript: string, quizCount: number, quizType: string): Promise<QuizQuestion[]> {
  const body = await backendFetch<{ quiz?: unknown }>("/v1/quiz/generate", {
    method: "POST",
    body: { transcript, quizCount, quizType },
  });
  const quiz = parseQuizList(body?.quiz);
  if (quiz.length === 0) {
    throw new Error(COPY.quiz.failed);
  }
  return quiz;
}

export async function generateFlashcards(transcript: string, count: number, previousCards: Flashcard[]): Promise<Flashcard[]> {
  const body = await backendFetch<{ flashcards?: unknown }>("/v1/flashcards/generate", {
    method: "POST",
    body: { transcript, count, ...(previousCards.length > 0 ? { previousCards } : {}) },
  });
  // Phone: blanks filtered, missing type → "qa".
  const cards = parseFlashcardList(body?.flashcards).map((c) => ({ ...c, type: c.type === "standard" ? "qa" : c.type }));
  if (cards.length === 0) {
    throw new Error("Flashcard generation failed.");
  }
  return cards;
}

export async function generateMindMap(transcript: string, branchCount: MindMapBranchCount, fallbackRoot: string): Promise<MindMapPayload> {
  const body = await backendFetch<{ mindMap?: unknown; root?: unknown }>("/v1/mindmap/generate", {
    method: "POST",
    body: { transcript, branchCount, fallbackRoot },
  });
  // Phone tolerates a bare payload as well as `{ mindMap }`.
  const payload = normalizeMindMapPayload(body?.mindMap ?? body, fallbackRoot);
  if (!hasMindMapContent(payload)) {
    throw new Error(COPY.mindMap.failed);
  }
  return payload;
}

export type SummaryRegenerateOption = "shorter" | "detailed" | "beginner" | "key_points" | "formal" | "casual";
export const SUMMARY_REGENERATE_OPTIONS: { id: SummaryRegenerateOption; label: string }[] = [
  { id: "shorter", label: "Shorter" },
  { id: "detailed", label: "More detailed" },
  { id: "beginner", label: "Beginner friendly" },
  { id: "key_points", label: "Key points" },
  { id: "formal", label: "Formal" },
  { id: "casual", label: "Casual" },
];

export async function regenerateSummary(
  transcript: string,
  option: SummaryRegenerateOption,
): Promise<{ mainIdea: string; keyPoints: string[] }> {
  // Response is root-level `{ mainIdea, keyPoints }` (not wrapped).
  const body = await backendFetch<{ mainIdea?: unknown; keyPoints?: unknown }>("/v1/summary/regenerate", {
    method: "POST",
    body: { transcript, option },
  });
  const mainIdea = typeof body?.mainIdea === "string" ? body.mainIdea : "";
  const keyPoints = Array.isArray(body?.keyPoints) ? body.keyPoints.filter((p): p is string => typeof p === "string") : [];
  if (!mainIdea && keyPoints.length === 0) {
    throw new Error(COPY.summary.regenerateFailed);
  }
  return { mainIdea, keyPoints };
}

export async function sendChat(transcript: string, messages: ChatTurn[], savedResultId: string): Promise<string> {
  const body = await backendFetch<{ response?: unknown }>("/v1/chat", {
    method: "POST",
    body: { transcript, messages, savedResultId },
  });
  return typeof body?.response === "string" ? body.response : "";
}

export type ShareScope = "summary" | "flashcards" | "quiz";
export type ResultShare = {
  id: string;
  savedResultId: string;
  scope: ShareScope;
  title: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  url: string;
};

export async function createShare(savedResultId: string, scope: ShareScope): Promise<ResultShare> {
  const body = await backendFetch<{ share?: ResultShare }>("/v1/shares", { method: "POST", body: { savedResultId, scope } });
  if (!body?.share?.url) {
    throw new Error(COPY.share.failed);
  }
  return body.share;
}

// ---- Persistence (client writes, same columns the phone writes; conversation_history is server-only)

async function updateResultColumns(userId: string, resultId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from("saved_results").update(patch).eq("id", resultId).eq("user_id", userId);
  if (error) {
    throw error;
  }
}

export const persistQuiz = (userId: string, resultId: string, quiz: QuizQuestion[]) =>
  updateResultColumns(userId, resultId, { quiz });
export const persistFlashcards = (userId: string, resultId: string, flashcards: Flashcard[]) =>
  updateResultColumns(userId, resultId, { flashcards });
export const persistMindMap = (userId: string, resultId: string, mindMap: MindMapPayload) =>
  updateResultColumns(userId, resultId, { mind_map: mindMap });
export const persistSummary = (userId: string, resultId: string, summary: { mainIdea: string; keyPoints: string[] }) =>
  updateResultColumns(userId, resultId, { summary_main_idea: summary.mainIdea, summary_key_points: summary.keyPoints });
