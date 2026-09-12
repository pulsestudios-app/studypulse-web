import type { TranscriptSegment, WordTiming } from "../../shared/processingTypes";

/** Phone TranscriptTab `formatTime`: minutes unpadded, `segment.start` is seconds. */
export function formatTranscriptTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Phone `formatPlaybackTime`: mm:ss for the player clock. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Phone TranscriptTab SPEAKER_COLORS / getSpeakerColor.
const SPEAKER_COLORS = ["#58CC02", "#1CB0F6", "#FF6B6B", "#FFD700", "#A855F7", "#FF8C00"];

export function speakerColor(speaker: string): string {
  const match = speaker.match(/([A-Z])$/);
  if (!match) {
    return SPEAKER_COLORS[0];
  }
  const index = match[1].charCodeAt(0) - 65;
  return SPEAKER_COLORS[((index % SPEAKER_COLORS.length) + SPEAKER_COLORS.length) % SPEAKER_COLORS.length];
}

const SEGMENT_HIGHLIGHT_START_PAD_SEC = 0.15;

/** Phone `segmentHighlightEndMs`: last in-range word end when timings exist, else next segment start. */
export function segmentHighlightEndMs(
  segmentIndex: number,
  segments: TranscriptSegment[],
  wordTimings: WordTiming[],
  mediaDurationMs: number,
): number {
  const seg = segments[segmentIndex];
  if (!seg) {
    return 0;
  }
  const next = segments[segmentIndex + 1];
  const startSec = seg.start;
  const boundaryEndSec = next ? next.start : mediaDurationMs / 1000;
  const fallbackEndMs = next ? next.start * 1000 : mediaDurationMs;

  if (wordTimings.length === 0) {
    return fallbackEndMs;
  }

  let lastWordEndSec = -1;
  for (const timing of wordTimings) {
    if (timing.end > startSec + SEGMENT_HIGHLIGHT_START_PAD_SEC && timing.start < boundaryEndSec) {
      lastWordEndSec = Math.max(lastWordEndSec, timing.end);
    }
  }
  if (lastWordEndSec < 0) {
    return fallbackEndMs;
  }
  return lastWordEndSec * 1000;
}

/** Phone `activeSegmentIndex`: the segment where `start <= pos < end`, or -1. */
export function findActiveSegmentIndex(
  segments: TranscriptSegment[],
  positionMs: number,
  wordTimings: WordTiming[],
  mediaDurationMs: number,
): number {
  if (segments.length === 0 || !positionMs || positionMs <= 0) {
    return -1;
  }
  return segments.findIndex((seg, i) => {
    const startMs = seg.start * 1000;
    const endMs = segmentHighlightEndMs(i, segments, wordTimings, mediaDurationMs);
    return positionMs >= startMs && positionMs < endMs;
  });
}

/** Phone `bubbleSeekSec`: first spoken word at or after the segment start. */
export function bubbleSeekSec(segmentStartSec: number, wordTimings: WordTiming[] | undefined, useWordTimings: boolean): number {
  if (!useWordTimings || !wordTimings?.length) {
    return segmentStartSec;
  }
  const first = wordTimings.find((w) => w.start >= segmentStartSec);
  return first !== undefined ? first.start : segmentStartSec;
}
