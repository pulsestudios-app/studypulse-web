// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): app/results/[jobId].tsx (splitIntoSentences :366-381; hasRealTimestamps :969-978;
// displaySegments :984-998; segmentTimeMap :1018-1031; applyYoutubeSeekPositionMs/handleYouTubeTimeUpdate :1036-1063; isYoutubePlaying :1066-1070;
// transcriptHighlightIndex :3200-3205; youtubeTapSeekUnavailable :8383-8390) and railway/backend/src/services/youtube.ts (segmentsHaveRealTimestamps :68-74).
// Keep in sync manually — no monorepo coupling. Changes vs source: React state/refs replaced by pure functions with identical math;
// the "freeze" rule (position only advances when the mapped segment changes) is kept in updateYoutubeSync.

import type { TranscriptSegment } from "./processingTypes";

export function splitIntoSentences(text: string, totalDuration: number): TranscriptSegment[] {
  const duration = Math.max(0, totalDuration);
  const trimmed = text.trim();
  if (!trimmed) {
    return [{ speaker: "Speaker A", start: 0, end: duration, text: text || "" }];
  }
  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmed];
  const n = Math.max(1, sentences.length);
  const timePerSentence = duration > 0 ? duration / n : 0;
  return sentences.map((sentence, index) => ({
    speaker: "Speaker A",
    text: sentence.trim() || sentence,
    start: index * timePerSentence,
    end: (index + 1) * timePerSentence,
  }));
}

/** True when transcript segments have distinct start times (backend captions / Supadata chunks). */
export function hasRealTimestamps(segments: TranscriptSegment[]): boolean {
  if (segments.length <= 1) {
    return false;
  }
  const uniqueStarts = new Set(segments.map((s) => Math.floor(s.start)));
  return uniqueStarts.size > 1;
}

/**
 * Prefer stored segments when they already have real timestamps (Railway + Supadata chunks).
 * Otherwise fall back to sentence splitting for a single zero-timed blob.
 */
export function youtubeDisplaySegments(segs: TranscriptSegment[], mediaDurationMs: number): TranscriptSegment[] {
  if (!segs.length) {
    return [];
  }
  if (hasRealTimestamps(segs)) {
    return segs;
  }
  if (segs.length === 1 && segs[0].start === 0) {
    if (mediaDurationMs <= 0) {
      return segs;
    }
    return splitIntoSentences(segs[0].text, mediaDurationMs / 1000);
  }
  return segs;
}

/** Phone `hasSplitEstimatedTimestamps`: one zero-timed blob rendered as evenly spread sentences. */
export function hasSplitEstimatedTimestamps(storedSegments: TranscriptSegment[], displaySegments: TranscriptSegment[]): boolean {
  return displaySegments.length > 1 && storedSegments.length === 1 && Number(storedSegments[0].start) === 0;
}

/** Phone TranscriptTab `youtubeTapSeekUnavailable`: tap-to-seek is meaningless without real or estimated timestamps. */
export function youtubeTapSeekUnavailable(storedSegments: TranscriptSegment[], displaySegments: TranscriptSegment[]): boolean {
  return !hasRealTimestamps(storedSegments) && !hasSplitEstimatedTimestamps(storedSegments, displaySegments);
}

/** Integer second → display-segment index. Later segments overwrite shared boundary seconds. */
export function buildSegmentTimeMap(segs: TranscriptSegment[], mediaDurationMs: number): Map<number, number> {
  const map = new Map<number, number>();
  segs.forEach((seg, index) => {
    const startSec = Math.floor(seg.start);
    const endSec = Math.ceil(segs[index + 1]?.start ?? mediaDurationMs / 1000);
    const lo = Math.min(startSec, endSec);
    const hi = Math.max(startSec, endSec);
    for (let s = lo; s <= hi; s++) {
      map.set(s, index);
    }
  });
  return map;
}

export type YoutubeSyncState = { positionMs: number; activeSegIndex: number };

export const INITIAL_YOUTUBE_SYNC: YoutubeSyncState = { positionMs: 0, activeSegIndex: -1 };

/** Phone `applyYoutubeSeekPositionMs`: a seek always re-resolves the index and moves the position. */
export function applyYoutubeSeek(map: Map<number, number>, nextMillis: number): YoutubeSyncState {
  const ms = Math.max(0, nextMillis);
  if (map.size > 0) {
    const sec = Math.floor(ms / 1000);
    return { positionMs: ms, activeSegIndex: map.get(sec) ?? -1 };
  }
  return { positionMs: ms, activeSegIndex: -1 };
}

/**
 * Phone `handleYouTubeTimeUpdate`: with a map, the index (and the published position) only change
 * when the mapped segment changes; without a map only the position moves.
 */
export function updateYoutubeSync(map: Map<number, number>, state: YoutubeSyncState, seconds: number): YoutubeSyncState {
  const ms = Math.max(0, seconds * 1000);
  if (map.size > 0) {
    const sec = Math.floor(ms / 1000);
    const newSegIndex = map.get(sec) ?? -1;
    if (newSegIndex !== state.activeSegIndex) {
      return { positionMs: ms, activeSegIndex: newSegIndex };
    }
    return state;
  }
  return { ...state, positionMs: ms };
}

export type YoutubeStatus = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "video cued";

/** IFrame API numeric state → the string react-native-youtube-iframe reports to the phone. */
export function youtubeStatusFromState(state: number): YoutubeStatus {
  switch (state) {
    case 0:
      return "ended";
    case 1:
      return "playing";
    case 2:
      return "paused";
    case 3:
      return "buffering";
    case 5:
      return "video cued";
    default:
      return "unstarted";
  }
}

/** Phone `isYoutubePlaying` (YouTube branch): the highlight is shown while playing, paused or buffering. */
export function isYoutubePlaying(status: string): boolean {
  return status === "playing" || status === "paused" || status === "buffering";
}

/** Phone `transcriptHighlightIndex` for YouTube: the mapped index, hidden unless playing/paused/buffering. */
export function youtubeHighlightIndex(map: Map<number, number>, status: string, activeSegIndex: number): number {
  return map.size > 0 ? (isYoutubePlaying(status) ? activeSegIndex : -1) : -1;
}
