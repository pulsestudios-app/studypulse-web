import { createContext, useContext } from "react";

/** What the transcript needs from whichever player is mounted (audio, video, or YouTube). */
export type PlaybackState = {
  /** Current position in milliseconds (0 when nothing is playing). */
  positionMs: number;
  durationMs: number;
  playing: boolean;
  /** False when there is no playable media (phone-local file, missing URI). */
  available: boolean;
};

export type PlaybackController = PlaybackState & {
  seek: (seconds: number, play?: boolean) => void;
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
