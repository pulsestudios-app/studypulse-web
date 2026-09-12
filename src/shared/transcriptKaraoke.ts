// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/transcriptKaraoke.tsx (lines 5-118, 135-213)
// Keep in sync manually — no monorepo coupling. Changes vs source: React Native <Text> rendering removed; buildKaraokeTextChildren is lifted to
// splitKaraokeText() returning { before, active, after } strings with identical token math. Import path adjusted.

import type { TranscriptSegment, WordTiming } from "./processingTypes";

export const KARAOKE_LIME = "#58CC02";

const RANGE_WIDEN_SEC = 2;

function tokenizeTranscriptText(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? (text ? [text] : []);
}

function countSpokenTokens(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

/** End time (seconds) for a segment; boundary is the next segment's start. */
export function getSegmentEndSec(
  segments: TranscriptSegment[],
  segIndex: number,
  durationMs: number,
  wordTimings?: WordTiming[]
): number {
  const seg = segments[segIndex];
  if (!seg) {
    return 0;
  }
  const next = segments[segIndex + 1];
  if (next) {
    // Hard cap at next.start so adjacent bubbles never share an active karaoke window.
    // (A 1.5s word-timing extension past this boundary caused dual highlights.)
    return next.start;
  }

  const candidates: number[] = [seg.end > seg.start ? seg.end : 0];
  if (durationMs > 0) {
    candidates.push(durationMs / 1000);
  }
  if (wordTimings?.length) {
    const lastWord = wordTimings[wordTimings.length - 1]!;
    if (lastWord.end > seg.start) {
      candidates.push(lastWord.end);
    }
    for (const w of wordTimings) {
      if (w.start >= seg.start - 0.05 && w.end > seg.start) {
        candidates.push(w.end);
      }
    }
  }
  return Math.max(...candidates) || seg.start + 3600;
}

/** Segment start padding — words must end after this to belong to the bubble. */
const SEGMENT_START_PAD_SEC = 0.15;

/**
 * Words that belong to a bubble: start in [startSec, endSec), even if timing.end exceeds endSec.
 * Membership uses start time only on the end boundary so trailing words are not dropped.
 */
function wordTimingsInRange(
  wordTimings: WordTiming[],
  startSec: number,
  endSec: number
): Array<{ timing: WordTiming; globalIndex: number }> {
  const wordsInRange = wordTimings
    .map((timing, globalIndex) => ({ timing, globalIndex }))
    .filter(
      ({ timing }) =>
        timing.end > startSec + SEGMENT_START_PAD_SEC && timing.start < endSec
    );
  wordsInRange.sort((a, b) => a.timing.start - b.timing.start);
  return wordsInRange;
}

function resolveSegEntries(
  wordTimings: WordTiming[],
  startSec: number,
  endSec: number,
  positionSec: number
): Array<{ timing: WordTiming; globalIndex: number }> {
  let entries = wordTimingsInRange(wordTimings, startSec, endSec);
  if (
    entries.length === 0 &&
    Number.isFinite(positionSec) &&
    positionSec >= startSec &&
    positionSec < endSec
  ) {
    entries = wordTimingsInRange(wordTimings, startSec - RANGE_WIDEN_SEC, endSec);
  }
  return entries;
}

function findActiveLocalIndex(
  segEntries: Array<{ timing: WordTiming; globalIndex: number }>,
  positionSec: number,
  endSec: number
): number {
  if (!segEntries.length || !Number.isFinite(positionSec) || positionSec >= endSec) {
    return -1;
  }
  const exact = segEntries.findIndex(
    ({ timing }) => positionSec >= timing.start && positionSec <= timing.end
  );
  if (exact >= 0) {
    return exact;
  }
  // Still inside the bubble window: highlight the latest word that started before endSec,
  // even when playback time is past timing.end (word audio can extend past next.start).
  let best = -1;
  for (let i = 0; i < segEntries.length; i++) {
    const { timing } = segEntries[i]!;
    if (timing.start > positionSec) {
      break;
    }
    best = i;
  }
  return best;
}

export type KaraokeSplit = { before: string; active: string; after: string };

/**
 * Source: buildKaraokeTextChildren. Splits `text` around the word closest to playback time.
 * Best-effort: highlights the word closest to playback time without strict token alignment.
 */
export function splitKaraokeText(
  text: string,
  wordTimings: WordTiming[],
  positionSec: number,
  startSec: number,
  endSec: number,
  timingOffset: number
): KaraokeSplit | null {
  if (!text || !wordTimings.length || !Number.isFinite(positionSec)) {
    return null;
  }

  if (positionSec < startSec || positionSec >= endSec) {
    return null;
  }

  for (const timing of wordTimings) {
    if (timing.start < startSec && timing.end > startSec && positionSec < timing.end) {
      return null;
    }
  }

  try {
    const segEntries = resolveSegEntries(wordTimings, startSec, endSec, positionSec);
    const tokens = tokenizeTranscriptText(text);
    const spokenTokenCount = countSpokenTokens(text);
    if (tokens.length === 0 || spokenTokenCount === 0 || !segEntries.length) {
      return null;
    }

    const activeLocal = findActiveLocalIndex(segEntries, positionSec, endSec);
    if (activeLocal < 0) {
      return null;
    }

    const chunkTimingCount = Math.max(0, segEntries.length - timingOffset);
    const pairableCount = Math.min(spokenTokenCount, chunkTimingCount);

    if (pairableCount === 0) {
      return null;
    }

    let activeSpokenIdx = activeLocal - timingOffset;
    if (activeSpokenIdx < 0) {
      activeSpokenIdx = 0;
    } else if (activeSpokenIdx >= pairableCount) {
      activeSpokenIdx = pairableCount - 1;
    }

    let before = "";
    let activePart = "";
    let after = "";
    let spokenIdx = 0;
    let pastActive = false;

    for (const token of tokens) {
      if (/^\s+$/.test(token)) {
        if (pastActive) {
          after += token;
        } else {
          before += token;
        }
        continue;
      }
      if (spokenIdx < activeSpokenIdx) {
        before += token;
      } else if (spokenIdx === activeSpokenIdx) {
        activePart = token;
        pastActive = true;
      } else {
        after += token;
      }
      spokenIdx += 1;
    }

    if (!activePart) {
      return null;
    }
    return { before, active: activePart, after };
  } catch {
    return null;
  }
}
