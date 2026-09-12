// Copied from pulsestudios-app/StudyPulse@e06fff9 (launch-ota): src/components/results/YouTubePlayer.tsx (polling + prediction :128-207, reset :217-231)
// Keep in sync manually — no monorepo coupling. Changes vs source: the setInterval/requestAnimationFrame plumbing is replaced by a pure
// class the web player adapter drives (poll every 80 ms, predict every animation frame); the math is unchanged.

/** Phone cadence: getCurrentTime is polled every 80 ms while playing; frames in between are predicted. */
export const YOUTUBE_POLL_INTERVAL_MS = 80;
/** Phone initial calibrated offset (seconds) before any API round-trip has been measured. */
export const YOUTUBE_INITIAL_OFFSET_SEC = 0.15;

export class YoutubeTimePredictor {
  private lastTime = 0;
  private lastPoll = 0;
  private delaySamples: number[] = [];
  private calibratedOffset = YOUTUBE_INITIAL_OFFSET_SEC;
  private velocity = 1.0;
  private prevTime = 0;
  private prevPoll = 0;
  /** IFrame API numeric state; prediction only runs while 1 (playing). */
  playerState = -1;

  /** Phone: reset on video change. */
  reset(): void {
    this.lastTime = 0;
    this.lastPoll = 0;
    this.delaySamples = [];
    this.calibratedOffset = YOUTUBE_INITIAL_OFFSET_SEC;
    this.velocity = 1.0;
    this.prevTime = 0;
    this.prevPoll = 0;
    this.playerState = -1;
  }

  /**
   * Phone poll callback: `currentTime` read from the player, `apiDelaySec` = round-trip of that
   * read, `now` = wall clock (ms) when the value arrived. Returns the raw time to publish.
   */
  poll(currentTime: number, apiDelaySec: number, now: number): number {
    const samples = this.delaySamples;
    samples.push(apiDelaySec);
    if (samples.length > 5) {
      samples.shift();
    }
    this.calibratedOffset = samples.reduce((a, b) => a + b, 0) / samples.length;

    if (this.prevTime > 0 && this.prevPoll > 0) {
      const timeDelta = currentTime - this.prevTime;
      const wallDelta = (now - this.prevPoll) / 1000;
      if (wallDelta > 0.05 && timeDelta > 0) {
        this.velocity = Math.min(2, Math.max(0.5, timeDelta / wallDelta));
      }
    }
    this.prevTime = currentTime;
    this.prevPoll = now;

    this.lastTime = currentTime;
    this.lastPoll = now;
    return currentTime;
  }

  /** Phone RAF tick: predicted time while playing, or null when there is nothing to predict from. */
  predict(now: number): number | null {
    if (this.playerState === 1 && this.lastTime > 0 && this.lastPoll > 0) {
      const elapsed = (now - this.lastPoll) / 1000;
      return this.lastTime + elapsed * this.velocity + this.calibratedOffset;
    }
    return null;
  }

  get offset(): number {
    return this.calibratedOffset;
  }

  get currentVelocity(): number {
    return this.velocity;
  }
}
