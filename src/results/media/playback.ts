import { createContext, useContext } from "react";

/** What the transcript needs from whichever player is mounted (audio, video, or YouTube). */
export type PlaybackState = {
  /** Current position in milliseconds (0 when nothing is playing). Coarse for YouTube; see subscribeTime. */
  positionMs: number;
  durationMs: number;
  playing: boolean;
  /** False when there is no playable media (phone-local file, missing URI). */
  available: boolean;
  /** YouTube only: the phone's player status string ("unstarted" | "playing" | "paused" | "buffering" | "ended" | "video cued"). */
  youtubeStatus?: string;
};

export type PlaybackController = PlaybackState & {
  seek: (seconds: number, play?: boolean) => void;
  /**
   * YouTube only: high-rate time signal (raw polls + predicted frames, in seconds), delivered
   * outside React state so the phone's "only re-render when the segment changes" rule holds.
   */
  subscribeTime?: (listener: (seconds: number) => void) => () => void;
};

export const IDLE_PLAYBACK: PlaybackController = {
  positionMs: 0,
  durationMs: 0,
  playing: false,
  available: false,
  seek: () => undefined,
};

export const PlaybackContext = createContext<PlaybackController>(IDLE_PLAYBACK);

export function usePlayback(): PlaybackController {
  return useContext(PlaybackContext);
}
