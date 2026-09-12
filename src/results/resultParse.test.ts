import { describe, expect, it } from "vitest";

import { hasRealTimestamps, parseConversation, parseResultRow, RESULT_COLUMNS, resultDisplayTitle } from "./resultParse";

const base = {
  id: "3f7a8f2e-5b1c-4d7e-9a3b-2c1d0e9f8a7b",
  user_id: "u",
  title: "Lecture 7",
  source_type: "youtube",
  source_file_name: null,
  source_media_uri: null,
  pdf_uri: null,
  youtube_url: "https://youtu.be/dQw4w9WgXcQ",
  duration_seconds: 3125,
  created_at: "2026-09-01T00:00:00Z",
  deleted_at: null,
};

describe("RESULT_COLUMNS", () => {
  it("never selects the non-existent source_audio_uri column", () => {
    expect(RESULT_COLUMNS.split(",")).not.toContain("source_audio_uri");
    expect(RESULT_COLUMNS.split(",")).toContain("conversation_history");
  });
});

describe("parseResultRow", () => {
  it("tolerates all-null JSON columns (recording placeholders)", () => {
    const v = parseResultRow({
      ...base,
      transcript_full_text: null,
      transcript_segments: null,
      word_timings: null,
      summary_main_idea: null,
      summary_key_points: null,
      concepts: null,
      quiz: null,
      flashcards: null,
      mind_map: null,
      conversation_history: null,
    });
    expect(v.transcript).toEqual({ fullText: "", segments: [] });
    expect(v.summary).toEqual({ mainIdea: "", keyPoints: [] });
    expect(v.quiz).toEqual([]);
    expect(v.flashcards).toEqual([]);
    expect(v.mindMap).toBeNull();
    expect(v.conversation).toEqual([]);
  });

  it("synthesizes one segment from full text when segments are empty (phone behaviour)", () => {
    const v = parseResultRow({ ...base, transcript_full_text: "hello world", transcript_segments: [] });
    expect(v.transcript.segments).toEqual([{ speaker: "Speaker A", start: 0, end: 0, text: "hello world" }]);
    expect(hasRealTimestamps(v.transcript.segments)).toBe(false);
  });

  it("parses legacy quiz rows (string correctIndex, >4 options, junk entries)", () => {
    const v = parseResultRow({
      ...base,
      quiz: [
        { question: "Q1", options: ["a", "b", "c", "d", "e"], correctIndex: "3" },
        { question: "Q2", options: ["t", "f"], correctIndex: 7 },
        null,
        "junk",
        { question: "Q3", options: ["x", 4, "y"], correctIndex: -1 },
      ],
    });
    expect(v.quiz).toEqual([
      { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 3 },
      { question: "Q2", options: ["t", "f"], correctIndex: 1 },
      { question: "Q3", options: ["x", "y"], correctIndex: 0 },
    ]);
  });

  it("parses flashcards, dropping blanks and defaulting type", () => {
    const v = parseResultRow({
      ...base,
      flashcards: [{ front: " F ", back: "B" }, { front: "", back: "B" }, { front: "X", back: "Y", type: "term_definition" }],
    });
    expect(v.flashcards).toEqual([
      { front: "F", back: "B", type: "standard" },
      { front: "X", back: "Y", type: "term_definition" },
    ]);
  });

  it("normalizes mind maps including the sub_branches alias and caps", () => {
    const v = parseResultRow({
      ...base,
      mind_map: {
        root: "Root",
        branches: [{ term: "A", sub_branches: [{ term: "a1" }, { term: "a2" }, { term: "a3" }, { term: "a4" }, { term: "a5" }] }],
      },
    });
    expect(v.mindMap?.branches[0].subBranches).toHaveLength(4);
    expect(v.mindMap?.branches[0].subBranches[0]).toEqual({ term: "a1", detail: "See transcript for more context." });
    expect(v.mindMap?.branches[0].color).toBe("#1CB0F6");
  });

  it("coerces non-finite segment times and keeps word timings", () => {
    const v = parseResultRow({
      ...base,
      transcript_segments: [{ speaker: "Speaker B", start: "x", end: 4.5, text: "hi" }],
      word_timings: [{ word: "hi", start: 1, end: 2 }, { word: "", start: 2, end: 3 }],
    });
    expect(v.transcript.segments).toEqual([{ speaker: "Speaker B", start: 0, end: 4.5, text: "hi" }]);
    expect(v.wordTimings).toEqual([{ word: "hi", start: 1, end: 2, speaker: "Speaker A" }]);
  });
});

describe("parseConversation", () => {
  it("keeps only well-formed role/content turns", () => {
    expect(
      parseConversation([
        { role: "user", content: "hi", ts: 1 },
        { role: "assistant", content: "hello" },
        { role: "system", content: "x" },
        { role: "user" },
        5,
      ]),
    ).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });
});

describe("resultDisplayTitle (phone shareTitle chain)", () => {
  it("prefers title, then file name without extension, then a trimmed YouTube URL", () => {
    expect(resultDisplayTitle({ title: "T", sourceFileName: "f.mp3", youtubeUrl: null })).toBe("T");
    expect(resultDisplayTitle({ title: null, sourceFileName: "lecture.final.mp3", youtubeUrl: null })).toBe("lecture.final");
    const long = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abcdef";
    expect(resultDisplayTitle({ title: null, sourceFileName: null, youtubeUrl: long })).toBe(`${long.slice(0, 48)}…`);
    expect(resultDisplayTitle({ title: null, sourceFileName: null, youtubeUrl: null })).toBe("StudyPulse");
  });
});
