// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/features/processing/jobsApi.ts (types only, lines 41-55; job type union from createJob at line 57)
// Keep in sync manually — no monorepo coupling. Changes vs source: excerpt; JobType is named here (inline union in the source).

export type AsyncJobStatus = "pending" | "processing" | "completed" | "failed";

export type JobPollResponse = {
  id: string;
  status: AsyncJobStatus;
  type: string;
  result: unknown;
  error: string | null;
  attempts?: number;
  createdAt?: string;
  updatedAt?: string;
  /** YouTube URL for `youtube` jobs (same as DB `input_url`). */
  inputUrl?: string | null;
  inputMeta?: Record<string, unknown> | null;
};

/** Inline union from `createJob` params in the source. */
export type JobType = "audio" | "recording" | "youtube" | "pdf" | "pptx" | "docx" | "txt";
