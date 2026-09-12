import { describe, expect, it } from "vitest";

import { parseYoutubeMessage, youtubeCommandMessage, youtubeEmbedUrl } from "./youtubeEmbed";

describe("youtubeEmbedUrl", () => {
  it("uses the nocookie host with the JS API enabled and our origin", () => {
    const url = new URL(youtubeEmbedUrl("dQw4w9WgXcQ", "https://app.pulsestudios.app"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/dQw4w9WgXcQ");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("https://app.pulsestudios.app");
  });
});

describe("youtubeCommandMessage", () => {
  it("serializes seekTo with allowSeekAhead", () => {
    expect(JSON.parse(youtubeCommandMessage({ func: "seekTo", args: [42.5, true] }))).toEqual({ event: "command", func: "seekTo", args: [42.5, true] });
    expect(JSON.parse(youtubeCommandMessage({ func: "playVideo" }))).toEqual({ event: "command", func: "playVideo", args: [] });
  });
});

describe("parseYoutubeMessage", () => {
  it("reads infoDelivery frames as strings or objects", () => {
    expect(parseYoutubeMessage(JSON.stringify({ event: "infoDelivery", info: { currentTime: 12.3, duration: 100, playerState: 1 } }))).toEqual({
      currentTime: 12.3,
      duration: 100,
      playerState: 1,
    });
    expect(parseYoutubeMessage({ event: "infoDelivery", info: { currentTime: 1 } })).toEqual({ currentTime: 1 });
    expect(parseYoutubeMessage({ event: "onStateChange", info: 2 })).toEqual({ playerState: 2 });
  });

  it("ignores unrelated or malformed frames", () => {
    expect(parseYoutubeMessage("not json")).toBeNull();
    expect(parseYoutubeMessage({ event: "onReady" })).toBeNull();
    expect(parseYoutubeMessage({ event: "infoDelivery", info: { currentTime: "x" } })).toEqual({});
  });
});
