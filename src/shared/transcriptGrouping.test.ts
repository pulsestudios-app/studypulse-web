import { describe, expect, it } from "vitest";

import fixture from "./fixtures/lecture-2026-10-21-segments.json";
import { groupTranscriptSegmentIndices, MIN_BUBBLE_WORDS } from "./transcriptGrouping";

// "Residential Lease Rights and Tenant Protections" (2026-10-21): AssemblyAI's 37 segments with
// their real timing, speakers and word counts; the words themselves are left out.
const segments = fixture.map((s) => ({ start: s.start, end: s.end, speaker: s.speaker, text: "w ".repeat(s.words).trim() }));
const groups = groupTranscriptSegmentIndices(segments, MIN_BUBBLE_WORDS);
const shownSpeaker = (sec: number) => {
  const i = segments.findIndex((s) => Math.abs(s.start - sec) < 0.2);
  const g = groups.find((x) => x.includes(i))!;
  return segments[g[0]].speaker;
};

describe("transcript bubbles", () => {
  it("never mix speakers", () => {
    for (const g of groups) expect(new Set(g.map((i) => segments[i].speaker)).size).toBe(1);
    expect(groups.flat()).toEqual(segments.map((_, i) => i));
  });

  it("show AssemblyAI's speaker for the reported lines", () => {
    expect(shownSpeaker(162.9)).toBe("Speaker B");
    expect(shownSpeaker(186.4)).toBe("Speaker A");
    for (const s of segments) expect(shownSpeaker(s.start)).toBe(s.speaker);
  });
});
