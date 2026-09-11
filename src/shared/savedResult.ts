// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/features/library/api.ts (lines 64-110, 526-552)
// Keep in sync manually — no monorepo coupling. Changes vs source: excerpt of types + list constants; import path adjusted.

import type { MindMapPayload } from "./mindMapTypes";

export type ProfileRecord = Record<string, unknown> | null;

export type SavedResultRecord = {
  id: string;
  user_id: string;
  title: string;
  source_type: string;
  source_file_name: string | null;
  source_media_uri?: string | null;
  /** Duplicate or audio copy when primary is video (playback fallback). */
  source_audio_uri?: string | null;
  pdf_uri?: string | null;
  youtube_url?: string | null;
  duration_seconds: number;
  transcript_full_text: string | null;
  transcript_segments: unknown | null;
  word_timings?: unknown | null;
  summary_main_idea: string | null;
  summary_key_points: unknown | null;
  concepts: unknown | null;
  quiz: unknown | null;
  flashcards?: unknown | null;
  mind_map?: unknown | null;
  mindMap?: MindMapPayload | null;
  conversation_history?: unknown | null;
  created_at: string;
  deleted_at?: string | null;
  folder_id?: string | null;
};

export type FolderRecord = {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  created_at: string;
};

export type MonthlyUsage = {
  usedMinutes: number;
  limitMinutes: number;
  remainingMinutes: number;
  /** Legacy calendar month key; kept for backward compatibility. */
  monthKey: string;
  cycleEndAt: string | null;
  planType: string;
};

/**
 * Lean column set for list views. Drops the heavy JSONB fields
 * (`transcript_segments`, `word_timings`, `concepts`, `quiz`, `mind_map`,
 * `conversation_history`, `summary_key_points`) which can be MBs per row.
 * The full row is still available via `getSavedResultById()` when a user
 * opens a result. `transcript_full_text` + `summary_main_idea` + `quiz` are
 * retained because the library renderer reads them for HAS-* filter chips
 * and the export-selected-transcripts flow.
 *
 * Note: the audit's suggested fields `thumbnail_url`, `plan_tier`,
 * `has_transcript`, `status` are not columns on this table — the thumbnail
 * is derived in `LibraryItemThumbnail` from `source_media_uri` / `pdf_uri`
 * / `youtube_url`, and plan tier lives on the `profiles` row.
 */
/**
 * `source_audio_uri` is NOT in this list even though `SavedResultRecord` types
 * it: no migration adds the column to `saved_results`, so requesting it via
 * `.select(...)` 400s the entire query on any deployed Supabase project. The
 * field is treated elsewhere as optionally-present (see `saveProcessingResult`
 * which retries the insert without it on error) — including it here is the
 * direct cause of the "Library failed to load" regression in 5203812.
 */
export const PHONE_SAVED_RESULTS_LIST_COLUMNS =
  "id,user_id,title,source_type,source_file_name,source_media_uri,pdf_uri,youtube_url,duration_seconds,folder_id,created_at,deleted_at,transcript_full_text,summary_main_idea,quiz";

/** Default page size for the library list. */
export const SAVED_RESULTS_PAGE_SIZE = 50;
