import { hasMindMapContent, normalizeMindMapPayload, type MindMapPayload } from "../shared/mindMapTypes";
import type { ConceptPayload, Flashcard, QuizQuestion, TranscriptSegment, WordTiming } from "../shared/processingTypes";
import { parseFlashcardList, parseQuizList, parseWordTimingsList } from "../shared/resultParsers";

/**
 * Columns the viewer reads. Explicit (not `*`) so a column that doesn't exist in the deployed
 * schema (`source_audio_uri`) can never 400 the query.
 */
export const RESULT_COLUMNS = [
  "id",
  "user_id",
  "title",
  "source_type",
  "source_file_name",
  "source_media_uri",
  "pdf_uri",
  "youtube_url",
  "duration_seconds",
  "transcript_full_text",
  "transcript_segments",
  "word_timings",
  "summary_main_idea",
  "summary_key_points",
  "concepts",
  "quiz",
  "flashcards",
  "mind_map",
  "conversation_history",
  "created_at",
  "deleted_at",
].join(",");

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ResultView = {
  id: string;
  title: string | null;
  sourceType: string;
  sourceFileName: string | null;
  sourceMediaUri: string | null;
  pdfUri: string | null;
  youtubeUrl: string | null;
  durationSeconds: number;
  createdAt: string;
  deletedAt: string | null;
  transcript: { fullText: string; segments: TranscriptSegment[] };
  wordTimings: WordTiming[];
  summary: { mainIdea: string; keyPoints: string[] };
  concepts: ConceptPayload[];
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
  mindMap: MindMapPayload | null;
  conversation: ChatTurn[];
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Phone normalizeProcessResult segment parsing: coerce non-finite times to 0, default speaker. */
export function parseSegments(raw: unknown): TranscriptSegment[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((s) => {
    const seg = s && typeof s === "object" ? (s as Record<string, unknown>) : {};
    return {
      speaker: typeof seg.speaker === "string" ? seg.speaker : "Speaker A",
      start: typeof seg.start === "number" && Number.isFinite(seg.start) ? seg.start : 0,
      end: typeof seg.end === "number" && Number.isFinite(seg.end) ? seg.end : 0,
      text: typeof seg.text === "string" ? seg.text : "",
    };
  });
}

export function parseConcepts(raw: unknown): ConceptPayload[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({
      term: typeof c.term === "string" ? c.term : "",
      definition: typeof c.definition === "string" ? c.definition : "",
    }))
    .filter((c) => c.term.trim() || c.definition.trim());
}

/** Stored by the server as `{role, content}` pairs; tolerate the documented-but-unused `ts`. */
export function parseConversation(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role as ChatTurn["role"], content: m.content as string }));
}

/** Mirrors the phone's ingestSavedRow, with per-element validation on every JSON column. */
export function parseResultRow(row: Record<string, unknown>): ResultView {
  const title = str(row.title);
  const fullText = typeof row.transcript_full_text === "string" ? row.transcript_full_text : "";
  const segments = parseSegments(row.transcript_segments);
  const mindMap = normalizeMindMapPayload(row.mind_map, title ?? "Mind Map");
  const duration = typeof row.duration_seconds === "number" && Number.isFinite(row.duration_seconds) ? row.duration_seconds : 0;
  return {
    id: String(row.id),
    title,
    sourceType: str(row.source_type)?.toLowerCase() ?? "file",
    sourceFileName: str(row.source_file_name),
    sourceMediaUri: str(row.source_media_uri),
    pdfUri: str(row.pdf_uri),
    youtubeUrl: str(row.youtube_url),
    durationSeconds: Math.max(0, duration),
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    deletedAt: str(row.deleted_at),
    transcript: {
      fullText,
      // Phone: an empty segment list becomes one segment holding the full text.
      segments: segments.length > 0 ? segments : fullText ? [{ speaker: "Speaker A", start: 0, end: 0, text: fullText }] : [],
    },
    wordTimings: parseWordTimingsList(row.word_timings),
    summary: {
      mainIdea: typeof row.summary_main_idea === "string" ? row.summary_main_idea : "",
      keyPoints: Array.isArray(row.summary_key_points)
        ? row.summary_key_points.filter((p): p is string => typeof p === "string")
        : [],
    },
    concepts: parseConcepts(row.concepts),
    quiz: parseQuizList(row.quiz),
    flashcards: parseFlashcardList(row.flashcards),
    mindMap: hasMindMapContent(mindMap) ? mindMap : null,
    conversation: parseConversation(row.conversation_history),
  };
}

/** Phone shareTitle chain: title → file name (extension stripped) → YouTube URL (≤48 chars) → "StudyPulse". */
export function resultDisplayTitle(view: Pick<ResultView, "title" | "sourceFileName" | "youtubeUrl">): string {
  if (view.title) {
    return view.title;
  }
  if (view.sourceFileName) {
    return view.sourceFileName.replace(/\.[^/.]+$/, "").trim() || view.sourceFileName;
  }
  if (view.youtubeUrl) {
    return view.youtubeUrl.length > 48 ? `${view.youtubeUrl.slice(0, 48)}…` : view.youtubeUrl;
  }
  return "StudyPulse";
}

/** Segments carry real timing when any of them starts after zero (phone `hasRealTimestamps`). */
export function hasRealTimestamps(segments: TranscriptSegment[]): boolean {
  return segments.some((s) => s.start > 0 || s.end > 0);
}
