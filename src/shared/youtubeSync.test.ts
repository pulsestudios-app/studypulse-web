import { describe, expect, it } from "vitest";

import type { TranscriptSegment } from "./processingTypes";
import {
  applyYoutubeSeek,
  buildSegmentTimeMap,
  hasRealTimestamps,
  INITIAL_YOUTUBE_SYNC,
  isYoutubePlaying,
  splitIntoSentences,
  updateYoutubeSync,
  youtubeDisplaySegments,
  youtubeHighlightIndex,
  youtubeStatusFromState,
  youtubeTapSeekUnavailable,
} from "./youtubeSync";
import { YOUTUBE_INITIAL_OFFSET_SEC, YoutubeTimePredictor } from "./youtubeTimePredictor";

/**
 * Parity vectors: produced by running the PHONE's own code — verbatim excerpts of
 * app/results/[jobId].tsx (segmentTimeMap :1018-1031, handleYouTubeTimeUpdate :1050-1063,
 * splitIntoSentences :366-381) on launch-ota@e06fff9 — against these Supadata-style segments
 * (seconds, fractional starts, overlapping ends, the shape of a real auto-caption track).
 */
const segs: TranscriptSegment[] = [
  { speaker: "Speaker A", start: 0.16, end: 3.28, text: "in this video we're going to look at" },
  { speaker: "Speaker A", start: 1.92, end: 5.44, text: "cellular respiration and the three" },
  { speaker: "Speaker A", start: 3.28, end: 7.6, text: "stages that make it up glycolysis" },
  { speaker: "Speaker A", start: 5.44, end: 9.84, text: "happens in the cytoplasm and produces" },
  { speaker: "Speaker A", start: 7.6, end: 12.0, text: "two pyruvate molecules the krebs cycle" },
  { speaker: "Speaker A", start: 9.84, end: 14.72, text: "then runs in the mitochondrial matrix" },
  { speaker: "Speaker A", start: 12.0, end: 17.04, text: "and finally the electron transport chain" },
  { speaker: "Speaker A", start: 14.72, end: 19.2, text: "produces most of the ATP" },
];
const mediaDurationMs = 21_500;

const PHONE_MAP: [number, number][] = [
  [0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [7, 4], [8, 4], [9, 5], [10, 5], [11, 5], [12, 6], [13, 6],
  [14, 7], [15, 7], [16, 7], [17, 7], [18, 7], [19, 7], [20, 7], [21, 7], [22, 7],
];

/** [player seconds, phone activeSegIndex after the update, phone positionMs after the update] */
const PHONE_TRACE: [number, number, number][] = [
  [0, 0, 0], [0.4, 0, 0], [0.99, 0, 0], [1, 1, 1000], [1.5, 1, 1000], [1.92, 1, 1000], [2, 1, 1000], [2.99, 1, 1000],
  [3, 2, 3000], [3.5, 2, 3000], [4, 2, 3000], [5, 3, 5000], [5.44, 3, 5000], [6, 3, 5000], [7, 4, 7000], [7.99, 4, 7000],
  [8, 4, 7000], [9, 5, 9000], [10, 5, 9000], [11.5, 5, 9000], [12, 6, 12000], [13, 6, 12000], [14, 7, 14000],
  [14.72, 7, 14000], [15, 7, 14000], [17, 7, 14000], [19, 7, 14000], [19.2, 7, 14000], [20, 7, 14000], [21, 7, 14000],
  [22, 7, 14000], [30, -1, 30000], [3, 2, 3000], [0.5, 0, 500],
];

describe("segmentTimeMap parity", () => {
  it("maps every integer second to the same segment index as the phone (boundary seconds go to the later segment)", () => {
    expect([...buildSegmentTimeMap(segs, mediaDurationMs).entries()]).toEqual(PHONE_MAP);
  });
});

describe("handleYouTubeTimeUpdate parity (freeze rule)", () => {
  it("reproduces the phone's index and position for a real player-time sequence", () => {
    const map = buildSegmentTimeMap(segs, mediaDurationMs);
    let state = INITIAL_YOUTUBE_SYNC;
    const trace = PHONE_TRACE.map(([seconds]) => {
      state = updateYoutubeSync(map, state, seconds);
      return [seconds, state.activeSegIndex, state.positionMs];
    });
    expect(trace).toEqual(PHONE_TRACE);
  });

  it("returns the same state object while the segment is unchanged (no re-render)", () => {
    const map = buildSegmentTimeMap(segs, mediaDurationMs);
    const a = updateYoutubeSync(map, INITIAL_YOUTUBE_SYNC, 3.1);
    expect(updateYoutubeSync(map, a, 3.9)).toBe(a);
  });

  it("without a map only the position moves", () => {
    expect(updateYoutubeSync(new Map(), INITIAL_YOUTUBE_SYNC, 4.2)).toEqual({ positionMs: 4200, activeSegIndex: -1 });
  });

  it("a seek always re-resolves (phone applyYoutubeSeekPositionMs)", () => {
    const map = buildSegmentTimeMap(segs, mediaDurationMs);
    expect(applyYoutubeSeek(map, 9840)).toEqual({ positionMs: 9840, activeSegIndex: 5 });
    expect(applyYoutubeSeek(map, -5)).toEqual({ positionMs: 0, activeSegIndex: 0 });
    expect(applyYoutubeSeek(new Map(), 500)).toEqual({ positionMs: 500, activeSegIndex: -1 });
  });
});

describe("status gating (phone isYoutubePlaying / transcriptHighlightIndex)", () => {
  it("shows the highlight while playing, paused or buffering; hides it when unstarted, ended or cued", () => {
    const map = buildSegmentTimeMap(segs, mediaDurationMs);
    for (const status of ["playing", "paused", "buffering"]) {
      expect(isYoutubePlaying(status)).toBe(true);
      expect(youtubeHighlightIndex(map, status, 4)).toBe(4);
    }
    for (const status of ["unstarted", "ended", "video cued"]) {
      expect(isYoutubePlaying(status)).toBe(false);
      expect(youtubeHighlightIndex(map, status, 4)).toBe(-1);
    }
    expect(youtubeHighlightIndex(new Map(), "playing", 4)).toBe(-1);
  });

  it("maps IFrame API states to the phone's status strings", () => {
    expect([-1, 0, 1, 2, 3, 5, 9].map(youtubeStatusFromState)).toEqual(["unstarted", "ended", "playing", "paused", "buffering", "video cued", "unstarted"]);
  });
});

describe("estimated timestamps (phone splitIntoSentences / displaySegments)", () => {
  const blob: TranscriptSegment[] = [{ speaker: "Speaker A", start: 0, end: 0, text: "First sentence here. Second one follows! Third asks a question? Trailing words" }];

  it("spreads sentences evenly across the duration exactly like the phone", () => {
    expect(splitIntoSentences(blob[0].text, 40)).toEqual([
      { speaker: "Speaker A", text: "First sentence here.", start: 0, end: 10 },
      { speaker: "Speaker A", text: "Second one follows!", start: 10, end: 20 },
      { speaker: "Speaker A", text: "Third asks a question?", start: 20, end: 30 },
      { speaker: "Speaker A", text: "Trailing words", start: 30, end: 40 },
    ]);
  });

  it("uses stored segments when they have real timestamps, splits a zero-timed blob once the duration is known", () => {
    expect(hasRealTimestamps(segs)).toBe(true);
    expect(hasRealTimestamps(blob)).toBe(false);
    expect(youtubeDisplaySegments(segs, mediaDurationMs)).toBe(segs);
    expect(youtubeDisplaySegments(blob, 0)).toBe(blob);
    expect(youtubeDisplaySegments(blob, 40_000)).toHaveLength(4);
    expect(youtubeDisplaySegments([], 40_000)).toEqual([]);
  });

  it("tap-to-seek is unavailable only when there are neither real nor estimated timestamps", () => {
    expect(youtubeTapSeekUnavailable(segs, segs)).toBe(false);
    expect(youtubeTapSeekUnavailable(blob, youtubeDisplaySegments(blob, 40_000))).toBe(false);
    expect(youtubeTapSeekUnavailable(blob, blob)).toBe(true);
  });
});

describe("YoutubeTimePredictor (phone YouTubePlayer polling + RAF prediction)", () => {
  it("predicts nothing until playing with a sample, then extrapolates with offset and velocity", () => {
    const p = new YoutubeTimePredictor();
    expect(p.predict(1000)).toBeNull();
    p.playerState = 1;
    expect(p.predict(1000)).toBeNull();
    expect(p.poll(10, 0.05, 1000)).toBe(10);
    // First sample: offset is the single delay sample, velocity stays 1.0.
    expect(p.predict(1100)).toBeCloseTo(10 + 0.1 * 1.0 + 0.05, 6);
    // Second sample 80 ms later with 0.16 s of media progress → velocity 2 (clamped max).
    p.poll(10.16, 0.03, 1080);
    expect(p.currentVelocity).toBe(2);
    expect(p.offset).toBeCloseTo(0.04, 6);
    expect(p.predict(1180)).toBeCloseTo(10.16 + 0.1 * 2 + 0.04, 6);
  });

  it("keeps the phone's velocity clamp, 5-sample offset window, and reset defaults", () => {
    const p = new YoutubeTimePredictor();
    p.playerState = 1;
    // Phone guard: velocity is only derived once a previous poll exists (prevPoll > 0), never from wall clock 0.
    p.poll(5, 0.2, 0);
    p.poll(5.5, 0.2, 500);
    expect(p.currentVelocity).toBe(1);
    p.poll(5.51, 0.2, 1500); // 0.01 s per 1 s → clamped to 0.5
    expect(p.currentVelocity).toBe(0.5);
    p.poll(5.5, 0.2, 2500); // no progress → velocity unchanged
    expect(p.currentVelocity).toBe(0.5);
    for (const d of [0.1, 0.1, 0.1, 0.1, 0.1, 0.1]) {
      p.poll(6, d, 3500);
    }
    expect(p.offset).toBeCloseTo(0.1, 6);
    p.reset();
    expect(p.offset).toBe(YOUTUBE_INITIAL_OFFSET_SEC);
    expect(p.currentVelocity).toBe(1);
    expect(p.playerState).toBe(-1);
    expect(p.predict(9999)).toBeNull();
  });
});
