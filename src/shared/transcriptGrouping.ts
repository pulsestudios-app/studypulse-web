// Copied from pulsestudios-app/StudyPulse@f8d780e (fix/transcript-speaker-groups): src/components/results/transcriptGrouping.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: import path only.

import type { TranscriptSegment } from "./processingTypes";

export const MIN_BUBBLE_WORDS = 20;

export function segmentWordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Same speaker, or a speaker isn't known (an unlabelled segment never splits a bubble). */
function sameSpeaker(a: string | undefined, b: string | undefined): boolean {
  return !a || !b || a === b;
}

/**
 * Group consecutive segment indices until each group reaches at least `minWords`
 * (a group may be shorter). A bubble shows its first segment's speaker, so a
 * group never spans a change of speaker: a short line from one speaker followed
 * by another speaker's line used to put that line under the wrong name.
 */
export function groupTranscriptSegmentIndices(segments: TranscriptSegment[], minWords: number): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  let wordSum = 0;

  for (let i = 0; i < segments.length; i++) {
    const n = segmentWordCount(segments[i].text);
    if (current.length === 0) {
      current.push(i);
      wordSum = n;
    } else if (wordSum < minWords && sameSpeaker(segments[current[0]].speaker, segments[i].speaker)) {
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
