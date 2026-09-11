import { describe, expect, it } from "vitest";

import { displayTitle, formatDate, formatDuration, sourceTypeLabel, thumbnailFor } from "./format";

describe("formatDuration (phone MM:SS, no hours)", () => {
  it.each([
    [0, "00:00"],
    [5, "00:05"],
    [65, "01:05"],
    [5400, "90:00"],
    [59.9, "00:59"],
    [-3, "00:00"],
    [null, "00:00"],
    [undefined, "00:00"],
    [Number.NaN, "00:00"],
  ])("%j → %s", (input, expected) => {
    expect(formatDuration(input as number | null | undefined)).toBe(expected);
  });
});

describe("formatDate", () => {
  it("formats like the phone (short month, day, year)", () => {
    expect(formatDate("2026-09-01T12:00:00Z", "en-US")).toBe("Sep 1, 2026");
  });

  it("returns empty for invalid dates", () => {
    expect(formatDate("nope", "en-US")).toBe("");
  });
});

describe("displayTitle", () => {
  it("handles prod rows with a null title", () => {
    expect(displayTitle({ title: "Lecture 4", source_file_name: "l4.mp3" })).toBe("Lecture 4");
    expect(displayTitle({ title: null, source_file_name: "l4.mp3" })).toBe("l4.mp3");
    expect(displayTitle({ title: "   ", source_file_name: null })).toBe("Untitled");
  });
});

describe("sourceTypeLabel", () => {
  it("labels known types and defaults unknown/null to File", () => {
    expect(sourceTypeLabel("youtube")).toBe("YouTube");
    expect(sourceTypeLabel("PDF")).toBe("PDF");
    expect(sourceTypeLabel(null)).toBe("File");
    expect(sourceTypeLabel("weird")).toBe("File");
  });
});

describe("thumbnailFor", () => {
  it("uses the YouTube mqdefault thumbnail like the phone", () => {
    expect(thumbnailFor({ source_type: "youtube", youtube_url: "https://youtu.be/dQw4w9WgXcQ" })).toEqual({
      imageUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      icon: "youtube",
    });
    expect(thumbnailFor({ source_type: "youtube", youtube_url: "https://www.youtube.com/shorts/dQw4w9WgXcQ" }).imageUrl).toBe(
      "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
    );
  });

  it("falls back to an icon for an unparseable YouTube URL", () => {
    expect(thumbnailFor({ source_type: "youtube", youtube_url: "https://example.com" })).toEqual({
      imageUrl: null,
      icon: "youtube",
    });
  });

  it("maps other source types to icons", () => {
    expect(thumbnailFor({ source_type: "video", youtube_url: null }).icon).toBe("video");
    expect(thumbnailFor({ source_type: "recording", youtube_url: null }).icon).toBe("mic");
    expect(thumbnailFor({ source_type: "audio", youtube_url: null }).icon).toBe("music");
    expect(thumbnailFor({ source_type: "pdf", youtube_url: null }).icon).toBe("document");
    expect(thumbnailFor({ source_type: null, youtube_url: null }).icon).toBe("document");
  });
});
