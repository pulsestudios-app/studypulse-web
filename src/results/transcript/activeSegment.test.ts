import { describe, expect, it } from "vitest";

import type { TranscriptSegment, WordTiming } from "../../shared/processingTypes";
import { getSegmentEndSec, splitKaraokeText } from "../../shared/transcriptKaraoke";
import { bubbleSeekSec, findActiveSegmentIndex, formatClock, formatTranscriptTime, segmentHighlightEndMs, speakerColor } from "./activeSegment";

const segments: TranscriptSegment[] = [
  { speaker: "Speaker A", start: 0, end: 4, text: "Hello there everyone" },
  { speaker: "Speaker B", start: 5, end: 9, text: "Hi back" },
  { speaker: "Speaker A", start: 10, end: 14, text: "Bye" },
];

describe("formatting", () => {
  it("transcript time has unpadded minutes (phone formatTime)", () => {
    expect(formatTranscriptTime(0)).toBe("0:00");
    expect(formatTranscriptTime(65)).toBe("1:05");
    expect(formatTranscriptTime(3725.9)).toBe("62:05");
    expect(formatTranscriptTime(Number.NaN)).toBe("0:00");
  });

  it("player clock is mm:ss", () => {
    expect(formatClock(65)).toBe("01:05");
  });

  it("speaker colours follow the trailing letter", () => {
    expect(speakerColor("Speaker A")).toBe("#58CC02");
    expect(speakerColor("Speaker B")).toBe("#1CB0F6");
    expect(speakerColor("Speaker G")).toBe("#58CC02");
    expect(speakerColor("Alice")).toBe("#58CC02");
  });
});

describe("segmentHighlightEndMs / findActiveSegmentIndex", () => {
  it("uses the next segment start without word timings, media duration for the last", () => {
    expect(segmentHighlightEndMs(0, segments, [], 20000)).toBe(5000);
    expect(segmentHighlightEndMs(2, segments, [], 20000)).toBe(20000);
  });

  it("uses the last in-range word end when timings exist", () => {
    const timings: WordTiming[] = [
      { word: "Hello", start: 0.2, end: 1, speaker: "Speaker A" },
      { word: "everyone", start: 2, end: 3.4, speaker: "Speaker A" },
      { word: "Hi", start: 5.1, end: 5.6, speaker: "Speaker B" },
    ];
    expect(segmentHighlightEndMs(0, segments, timings, 20000)).toBe(3400);
    // Words that only bleed in before the start pad don't count.
    expect(segmentHighlightEndMs(1, segments, [{ word: "x", start: 4.9, end: 5.1, speaker: "" }], 20000)).toBe(10000);
  });

  it("finds start <= pos < end and -1 outside / before playback starts", () => {
    expect(findActiveSegmentIndex(segments, 0, [], 20000)).toBe(-1);
    expect(findActiveSegmentIndex(segments, 1000, [], 20000)).toBe(0);
    expect(findActiveSegmentIndex(segments, 5000, [], 20000)).toBe(1);
    expect(findActiveSegmentIndex(segments, 4999, [], 20000)).toBe(0);
    expect(findActiveSegmentIndex(segments, 25000, [], 20000)).toBe(-1);
    expect(findActiveSegmentIndex([], 1000, [], 20000)).toBe(-1);
  });
});

describe("bubbleSeekSec", () => {
  it("seeks to the first word at/after the segment start when karaoke is on", () => {
    const timings: WordTiming[] = [{ word: "a", start: 4.8, end: 5, speaker: "" }, { word: "b", start: 5.3, end: 5.9, speaker: "" }];
    expect(bubbleSeekSec(5, timings, true)).toBe(5.3);
    expect(bubbleSeekSec(5, timings, false)).toBe(5);
    expect(bubbleSeekSec(50, timings, true)).toBe(50);
  });
});

describe("karaoke split (phone buildKaraokeTextChildren)", () => {
  const timings: WordTiming[] = [
    { word: "Hello", start: 0.2, end: 0.8, speaker: "" },
    { word: "there", start: 1.0, end: 1.5, speaker: "" },
    { word: "everyone", start: 2.0, end: 2.9, speaker: "" },
  ];
  it("highlights the word at playback time", () => {
    const end = getSegmentEndSec(segments, 0, 20000, timings);
    expect(end).toBe(5);
    expect(splitKaraokeText("Hello there everyone", timings, 1.2, 0, end, 0)).toEqual({ before: "Hello ", active: "there", after: " everyone" });
    expect(splitKaraokeText("Hello there everyone", timings, 4.0, 0, end, 0)).toEqual({ before: "Hello there ", active: "everyone", after: "" });
  });
  it("returns null outside the window", () => {
    expect(splitKaraokeText("Hello there everyone", timings, 7, 0, 5, 0)).toBeNull();
    expect(splitKaraokeText("", timings, 1, 0, 5, 0)).toBeNull();
  });
});
