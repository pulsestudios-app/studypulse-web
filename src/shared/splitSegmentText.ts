// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/resultsZoomHelpers.ts (lines 93-112)
// Keep in sync manually — no monorepo coupling. Changes vs source: excerpt (splitSegmentText only).

export function splitSegmentText(text: string, maxChars = 150): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(" ", maxChars);
    if (splitAt === -1) {
      splitAt = maxChars;
    }
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  const filtered = chunks.filter((c) => c.length > 0);
  return filtered.length > 0 ? filtered : [text];
}
