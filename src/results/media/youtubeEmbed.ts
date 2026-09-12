/**
 * YouTube IFrame postMessage protocol (the same channel the IFrame Player API script uses),
 * driven directly so no third-party script is loaded under our CSP.
 */
export const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";

export function youtubeEmbedUrl(videoId: string, pageOrigin: string): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    origin: pageOrigin,
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    playsinline: "1",
  });
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export type YoutubeCommand =
  | { func: "playVideo" }
  | { func: "pauseVideo" }
  | { func: "seekTo"; args: [number, boolean] };

export function youtubeCommandMessage(command: YoutubeCommand): string {
  return JSON.stringify({ event: "command", func: command.func, args: "args" in command ? command.args : [] });
}

export const YOUTUBE_LISTEN_MESSAGE = JSON.stringify({ event: "listening" });

export type YoutubeInfo = { currentTime?: number; duration?: number; playerState?: number };

/** Player states per the IFrame API: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued. */
export const YOUTUBE_STATE_PLAYING = 1;

/** Parses an `infoDelivery` / `onStateChange` frame; returns null for anything else. */
export function parseYoutubeMessage(data: unknown): YoutubeInfo | null {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const msg = parsed as { event?: unknown; info?: unknown };
  if (msg.event === "onStateChange" && typeof msg.info === "number") {
    return { playerState: msg.info };
  }
  if (msg.event !== "infoDelivery" || !msg.info || typeof msg.info !== "object") {
    return null;
  }
  const info = msg.info as Record<string, unknown>;
  const out: YoutubeInfo = {};
  if (typeof info.currentTime === "number" && Number.isFinite(info.currentTime)) {
    out.currentTime = info.currentTime;
  }
  if (typeof info.duration === "number" && Number.isFinite(info.duration)) {
    out.duration = info.duration;
  }
  if (typeof info.playerState === "number") {
    out.playerState = info.playerState;
  }
  return out;
}
