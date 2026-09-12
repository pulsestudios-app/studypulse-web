import { describe, expect, it } from "vitest";

import { classifyMediaSource, isVideoPath, storagePathBelongsToUser } from "./mediaSource";

const supabaseUrl = "https://uhfavszrclwwwnimxsbr.supabase.co";
const uid = "3f7a8f2e-5b1c-4d7e-9a3b-2c1d0e9f8a7b";

describe("classifyMediaSource", () => {
  it("youtube rows resolve to the video id", () => {
    expect(classifyMediaSource({ sourceType: "youtube", sourceMediaUri: null, youtubeUrl: "https://youtu.be/dQw4w9WgXcQ", supabaseUrl })).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
  });

  it("recording:// references map to the recordings bucket", () => {
    expect(classifyMediaSource({ sourceType: "recording", sourceMediaUri: `recording://${uid}/lecture.m4a`, youtubeUrl: null, supabaseUrl })).toEqual({
      kind: "storage",
      bucket: "recordings",
      path: `${uid}/lecture.m4a`,
    });
  });

  it("backend-saved upload keys map to the uploads bucket", () => {
    expect(classifyMediaSource({ sourceType: "audio", sourceMediaUri: `uploads/${uid}/job-file.mp3`, youtubeUrl: null, supabaseUrl })).toEqual({
      kind: "storage",
      bucket: "uploads",
      path: `uploads/${uid}/job-file.mp3`,
    });
  });

  it("re-signs persisted Supabase storage URLs from their path; other https URLs pass through", () => {
    expect(
      classifyMediaSource({
        sourceType: "recording",
        sourceMediaUri: `${supabaseUrl}/storage/v1/object/sign/recordings/${uid}/a%20b.m4a?token=expired`,
        youtubeUrl: null,
        supabaseUrl,
      }),
    ).toEqual({ kind: "storage", bucket: "recordings", path: `${uid}/a b.m4a` });
    expect(classifyMediaSource({ sourceType: "audio", sourceMediaUri: "https://cdn.example.com/x.mp3", youtubeUrl: null, supabaseUrl })).toEqual({
      kind: "url",
      url: "https://cdn.example.com/x.mp3",
    });
  });

  it("phone-local files are unplayable on the web", () => {
    for (const uri of ["file:///var/mobile/Containers/studypulse_media/u_1_main.m4a", "/data/user/0/app/files/x.mp4", "C:\\x\\y.mp3", "content://media/1"]) {
      expect(classifyMediaSource({ sourceType: "audio", sourceMediaUri: uri, youtubeUrl: null, supabaseUrl }).kind).toBe("phone-local");
    }
  });

  it("no uri → none", () => {
    expect(classifyMediaSource({ sourceType: "pdf", sourceMediaUri: null, youtubeUrl: null, supabaseUrl })).toEqual({ kind: "none" });
  });
});

describe("storagePathBelongsToUser (phone guard)", () => {
  it("checks the owner segment per bucket and rejects traversal", () => {
    expect(storagePathBelongsToUser({ kind: "storage", bucket: "recordings", path: `${uid}/a.m4a` }, uid)).toBe(true);
    expect(storagePathBelongsToUser({ kind: "storage", bucket: "recordings", path: `other/a.m4a` }, uid)).toBe(false);
    expect(storagePathBelongsToUser({ kind: "storage", bucket: "uploads", path: `uploads/${uid}/a.mp3` }, uid)).toBe(true);
    expect(storagePathBelongsToUser({ kind: "storage", bucket: "uploads", path: `uploads/${uid}/../x.mp3` }, uid)).toBe(false);
    expect(storagePathBelongsToUser({ kind: "storage", bucket: "converted-documents", path: `pdf/${uid}/a.pdf` }, uid)).toBe(true);
  });
});

describe("isVideoPath", () => {
  it("detects video extensions with or without a query string", () => {
    expect(isVideoPath("a/b.MP4")).toBe(true);
    expect(isVideoPath("https://x/y.webm?token=1")).toBe(true);
    expect(isVideoPath("a/b.m4a")).toBe(false);
  });
});
