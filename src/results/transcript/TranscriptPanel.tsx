import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TranscriptSegment, WordTiming } from "../../shared/processingTypes";
import { groupTranscriptSegmentIndices, MIN_BUBBLE_WORDS } from "../../shared/transcriptGrouping";
import { getSegmentEndSec, splitKaraokeText } from "../../shared/transcriptKaraoke";
import {
  applyYoutubeSeek,
  buildSegmentTimeMap,
  INITIAL_YOUTUBE_SYNC,
  updateYoutubeSync,
  youtubeDisplaySegments,
  youtubeHighlightIndex,
  youtubeTapSeekUnavailable,
  type YoutubeSyncState,
} from "../../shared/youtubeSync";
import { COPY } from "../copy";
import { usePlayback, type PlaybackController } from "../media/playback";
import { bubbleSeekSec, findActiveSegmentIndex, formatTranscriptTime, speakerColor } from "./activeSegment";

type Props = {
  segments: TranscriptSegment[];
  wordTimings: WordTiming[];
  isYoutube: boolean;
};

/**
 * Phone YouTube path ([jobId].tsx): stored segments (or evenly spread sentences for a zero-timed
 * blob) → integer-second map → index that only changes when the mapped segment changes, hidden
 * unless the player is playing/paused/buffering. Fed by the player's raw polls + predicted frames.
 */
function useYoutubeSync(segments: TranscriptSegment[], playback: PlaybackController, enabled: boolean) {
  const displaySegments = useMemo(
    () => (enabled ? youtubeDisplaySegments(segments, playback.durationMs) : segments),
    [enabled, segments, playback.durationMs],
  );
  const map = useMemo(() => (enabled ? buildSegmentTimeMap(displaySegments, playback.durationMs) : new Map<number, number>()), [
    enabled,
    displaySegments,
    playback.durationMs,
  ]);
  const [sync, setSync] = useState<YoutubeSyncState>(INITIAL_YOUTUBE_SYNC);
  const syncRef = useRef(sync);
  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  }, [map]);
  // Phone positionMsRef: the latest raw position, updated on every tick even when the index is frozen.
  const latestMsRef = useRef(0);

  const commit = useCallback((next: YoutubeSyncState) => {
    if (next !== syncRef.current) {
      syncRef.current = next;
      setSync(next);
    }
  }, []);

  // Phone [jobId].tsx:3235-3244 — when the map changes, re-resolve from the latest raw position.
  useEffect(() => {
    if (!enabled || map.size === 0) {
      return;
    }
    const idx = map.get(Math.floor(latestMsRef.current / 1000)) ?? -1;
    if (idx !== syncRef.current.activeSegIndex) {
      commit({ positionMs: syncRef.current.positionMs, activeSegIndex: idx });
    }
  }, [enabled, map, commit]);

  const { subscribeTime } = playback;
  useEffect(() => {
    if (!enabled || !subscribeTime) {
      return;
    }
    return subscribeTime((seconds) => {
      latestMsRef.current = Math.max(0, seconds * 1000);
      commit(updateYoutubeSync(mapRef.current, syncRef.current, seconds));
    });
  }, [enabled, subscribeTime, commit]);

  /** Phone applyYoutubeSeekPositionMs: a seek re-resolves unconditionally. */
  const onSeek = useCallback(
    (seconds: number) => {
      const ms = Math.max(0, Math.floor(seconds * 1000));
      latestMsRef.current = ms;
      commit(applyYoutubeSeek(mapRef.current, ms));
    },
    [commit],
  );

  const highlightIndex = enabled ? youtubeHighlightIndex(map, playback.youtubeStatus ?? "unstarted", sync.activeSegIndex) : -1;
  const tapSeekUnavailable = enabled && youtubeTapSeekUnavailable(segments, displaySegments);
  return { displaySegments, highlightIndex, tapSeekUnavailable, onSeek };
}

export function TranscriptPanel({ segments, wordTimings, isYoutube }: Props) {
  const playback = usePlayback();
  const listRef = useRef<HTMLDivElement>(null);
  const yt = useYoutubeSync(segments, playback, isYoutube);
  const listSegments = yt.displaySegments;
  const groups = useMemo(() => groupTranscriptSegmentIndices(listSegments, MIN_BUBBLE_WORDS), [listSegments]);
  // Phone: word timings and speaker colours are never used for YouTube sources.
  const timings = isYoutube ? [] : wordTimings;
  const karaokeEnabled = timings.length > 0 && playback.available;
  const activeIndex = isYoutube
    ? yt.highlightIndex
    : playback.available
      ? findActiveSegmentIndex(listSegments, playback.positionMs, timings, playback.durationMs)
      : -1;
  const activeGroup = activeIndex >= 0 ? groups.findIndex((g) => g.includes(activeIndex)) : -1;

  useEffect(() => {
    if (activeGroup < 0) {
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-group="${activeGroup}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeGroup]);

  if (listSegments.length === 0) {
    return <p className="text-secondary transcript-empty">{COPY.transcript.empty}</p>;
  }

  const canSeek = playback.available && !yt.tapSeekUnavailable;
  const seekTo = (segment: TranscriptSegment) => {
    if (!canSeek) {
      return;
    }
    const seconds = bubbleSeekSec(segment.start, timings, karaokeEnabled);
    playback.seek(seconds, true);
    if (isYoutube) {
      yt.onSeek(seconds);
    }
  };

  return (
    <div className="transcript" ref={listRef}>
      {yt.tapSeekUnavailable ? <p className="transcript-youtube-note">{COPY.transcript.youtubeTapSeekUnavailable}</p> : null}
      {isYoutube ? <p className="transcript-youtube-note">{COPY.transcript.youtubeSpeakers}</p> : null}
      {groups.map((group, groupIndex) => {
        const first = listSegments[group[0]];
        const speaker = first.speaker || COPY.transcript.speakerFallback;
        // Phone: speakerColor = useSpeakerColors ? getSpeakerColor(speaker) : theme.colors.lime
        const color = isYoutube ? "var(--color-lime)" : speakerColor(speaker);
        const isActive = groupIndex === activeGroup;
        const isMulti = group.length > 1;
        return (
          <div
            key={groupIndex}
            data-group={groupIndex}
            className={`transcript-bubble${isActive ? " transcript-bubble-active" : ""}`}
            style={{ borderLeftColor: color }}
          >
            {isMulti ? (
              <>
                <span className="transcript-speaker transcript-speaker-row" style={{ color }}>
                  {speaker}
                </span>
                {group.map((segIndex) => {
                  const seg = listSegments[segIndex];
                  // Phone TranscriptTab:696-697 — the active line's meta turns lime; body text stays primary.
                  const lineActive = segIndex === activeIndex;
                  return (
                    <p key={segIndex} className="transcript-line" onClick={() => seekTo(seg)} role="presentation">
                      <button type="button" className={`transcript-time${lineActive ? " is-active" : ""}`} disabled={!canSeek} tabIndex={-1}>
                        {` • ${formatTranscriptTime(seg.start)}  `}
                      </button>
                      <SegmentText
                        segment={seg}
                        segments={listSegments}
                        segIndex={segIndex}
                        timings={timings}
                        karaoke={karaokeEnabled && lineActive}
                        positionSec={playback.positionMs / 1000}
                        durationMs={playback.durationMs}
                      />
                    </p>
                  );
                })}
              </>
            ) : (
              <p className="transcript-line" onClick={() => seekTo(first)} role="presentation">
                <span className="transcript-speaker" style={{ color }}>
                  {speaker}
                </span>
                <button type="button" className={`transcript-time${isActive ? " is-active" : ""}`} disabled={!canSeek} tabIndex={-1}>
                  {` • ${formatTranscriptTime(first.start)}  `}
                </button>
                <SegmentText
                  segment={first}
                  segments={listSegments}
                  segIndex={group[0]}
                  timings={timings}
                  karaoke={karaokeEnabled && group[0] === activeIndex}
                  positionSec={playback.positionMs / 1000}
                  durationMs={playback.durationMs}
                />
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SegmentText({
  segment,
  segments,
  segIndex,
  timings,
  karaoke,
  positionSec,
  durationMs,
}: {
  segment: TranscriptSegment;
  segments: TranscriptSegment[];
  segIndex: number;
  timings: WordTiming[];
  karaoke: boolean;
  positionSec: number;
  durationMs: number;
}) {
  const split = karaoke
    ? splitKaraokeText(segment.text, timings, positionSec, segment.start, getSegmentEndSec(segments, segIndex, durationMs, timings), 0)
    : null;
  return (
    <span className="transcript-segment">
      {split ? (
        <>
          {split.before}
          <mark className="karaoke-word">{split.active}</mark>
          {split.after}
        </>
      ) : (
        segment.text
      )}
    </span>
  );
}
