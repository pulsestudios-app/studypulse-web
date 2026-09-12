// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/utils/sanitizeFilename.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

/** Safe basename for Supabase Storage keys (avoids 400s from quotes/apostrophes and special chars). */
export function sanitizeFilename(filename: string): string {
  const trimmed = (filename ?? "").trim();
  const base = trimmed.length > 0 ? trimmed : "upload.bin";
  const sanitized = base
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .toLowerCase();
  return sanitized.length > 0 ? sanitized : "upload.bin";
}
