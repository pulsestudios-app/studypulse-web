// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/features/processing/types.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

export type UploadSourceType = "file" | "youtube" | "pdf" | "pptx" | "docx" | "txt";
export type QuizType = "multiple_choice" | "true_false" | "fill_blank" | "mixed";

export type UploadFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
};

export type QuizSettings = {
  quizCount: 1 | 5 | 7 | 10 | 15 | 20;
  quizType: QuizType;
};

export type UploadRequest = {
  sourceType: UploadSourceType;
  file?: UploadFile;
  youtubeUrl?: string;
  /** Marks file upload as PDF processing path. */
  isPdf?: boolean;
  isPptx?: boolean;
  isDocx?: boolean;
  isTxt?: boolean;
  /** In-app microphone recording; file should live under documentDirectory/recordings/. */
  isRecording?: boolean;
  /** Supabase public URL for the uploaded recording (used when saving `source_media_uri` after transcription). */
  sourceMediaUri?: string;
  /** When set, completed processing updates this `saved_results` row instead of inserting. */
  savedResultId?: string;
};

export type TranscriptSegment = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

/** Word-level timing from AssemblyAI (start/end in seconds). */
export type WordTiming = {
  word: string;
  start: number;
  end: number;
  speaker: string;
};

/** AI-generated chapter for transcript navigation. */
export type TranscriptChapter = {
  title: string;
  /** Start time in seconds (aligns with segment timestamps). */
  startTime: number;
  summary: string;
};

export type TranscriptPayload = {
  fullText: string;
  segments: TranscriptSegment[];
};

export type SummaryPayload = {
  mainIdea: string;
  keyPoints: string[];
};

import type { MindMapPayload } from "./mindMapTypes";

export type ConceptPayload = {
  term: string;
  definition: string;
};

export type {
  MindMapBranch,
  MindMapBranchCount,
  MindMapPayload,
  MindMapSubBranch,
} from "./mindMapTypes";

export type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type Flashcard = {
  front: string;
  back: string;
  type: string;
};

export type ProcessResult = {
  /** Short display title from backend (e.g. Claude-generated). */
  title?: string;
  /** Original YouTube URL when source is YouTube (persisted with library saves). */
  youtubeUrl?: string;
  /** Backend source type hint. */
  sourceType?: "pdf" | "pptx" | "docx" | "txt" | "file" | "youtube" | "recording" | "audio" | "video";
  /** Public media URL (e.g. Supabase storage) from `saved_results.source_media_uri`. */
  sourceMediaUri?: string | null;
  /** Local PDF URI when the source file is a PDF. */
  pdfUri?: string;
  pptxSlides?: Array<{ slideNumber: number; title: string; content: string }>;
  docxContent?: string;
  txtContent?: string;
  transcript: TranscriptPayload;
  summary: SummaryPayload;
  concepts: ConceptPayload[];
  quiz: QuizQuestion[];
  flashcards?: Flashcard[];
  /** Set only after user generates via `/v1/mindmap/generate` (not created during processing). */
  mindMap?: MindMapPayload;
  wordTimings?: WordTiming[];
};

export type ProcessingStep = "extracting" | "transcribing" | "summarizing" | "quiz";
