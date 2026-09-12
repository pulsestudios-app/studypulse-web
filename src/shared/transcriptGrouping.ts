// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/transcriptGrouping.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: import path only.

import type { TranscriptSegment } from "./processingTypes";

export const MIN_BUBBLE_WORDS = 20;

export function segmentWordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Group consecutive segment indices until each group reaches at least `minWords` (last group may be shorter). */
export function groupTranscriptSegmentIndices(segments: TranscriptSegment[], minWords: number): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let wordSum = 0;

  for (let i = 0; i < segments.length; i++) {
    const n = segmentWordCount(segments[i].text);
    if (current.length === 0) {
      current.push(i);
      wordSum = n;
    } else if (wordSum < minWords) {
      current.push(i);
      wordSum += n;
    } else {
      groups.push(current);
      current = [i];
      wordSum = n;
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}
