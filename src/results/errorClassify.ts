import { BackendError } from "../lib/backendErrors";
import { COPY } from "./copy";

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
