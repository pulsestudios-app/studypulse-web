import { useEffect, useMemo, useRef } from "react";

import type { TranscriptSegment, WordTiming } from "../../shared/processingTypes";
import { groupTranscriptSegmentIndices, MIN_BUBBLE_WORDS } from "../../shared/transcriptGrouping";
import { getSegmentEndSec, splitKaraokeText } from "../../shared/transcriptKaraoke";
import { COPY } from "../copy";
import { usePlayback } from "../media/playback";
import { bubbleSeekSec, findActiveSegmentIndex, formatTranscriptTime, speakerColor } from "./activeSegment";

type Props = {
  segments: TranscriptSegment[];
  wordTimings: WordTiming[];
  isYoutube: boolean;
};

export function TranscriptPanel({ segments, wordTimings, isYoutube }: Props) {
  const playback = usePlayback();
  const listRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => groupTranscriptSegmentIndices(segments, MIN_BUBBLE_WORDS), [segments]);
  // Phone: word timings and speaker colours are never used for YouTube sources.
  const timings = isYoutube ? [] : wordTimings;
  const karaokeEnabled = timings.length > 0 && playback.available;
  const activeIndex = playback.available ? findActiveSegmentIndex(segments, playback.positionMs, timings, playback.durationMs) : -1;
  const activeGroup = activeIndex >= 0 ? groups.findIndex((g) => g.includes(activeIndex)) : -1;

  useEffect(() => {
    if (activeGroup < 0) {
      return;
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-group="${activeGroup}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeGroup]);

  if (segments.length === 0) {
    return <p className="text-secondary transcript-empty">{COPY.transcript.empty}</p>;
  }

  const seekTo = (segment: TranscriptSegment) => {
    if (!playback.available) {
      return;
    }
    playback.seek(bubbleSeekSec(segment.start, timings, karaokeEnabled), true);
  };

  return (
    <div className="transcript" ref={listRef}>
      {isYoutube ? <p className="type-caption text-secondary transcript-note">{COPY.transcript.youtubeSpeakers}</p> : null}
      {groups.map((group, groupIndex) => {
        const first = segments[group[0]];
        const speaker = first.speaker || COPY.transcript.speakerFallback;
        const color = isYoutube ? "var(--color-border)" : speakerColor(speaker);
        const isActive = groupIndex === activeGroup;
        return (
          <div
            key={groupIndex}
            data-group={groupIndex}
            className={`transcript-bubble${isActive ? " transcript-bubble-active" : ""}`}
            style={{ borderLeftColor: color }}
          >
            <div className="transcript-meta">
              {!isYoutube ? (
                <span className="transcript-speaker" style={{ color }}>
                  {speaker}
                </span>
              ) : null}
              <button
                type="button"
                className="transcript-time"
                onClick={() => seekTo(first)}
                disabled={!playback.available}
                title={playback.available ? "Jump to this point" : undefined}
              >
                {formatTranscriptTime(first.start)}
              </button>
            </div>
            <p className="transcript-text">
              {group.map((segIndex, i) => (
                <SegmentText
                  key={segIndex}
                  segment={segments[segIndex]}
                  segments={segments}
                  segIndex={segIndex}
                  timings={timings}
                  karaoke={karaokeEnabled && segIndex === activeIndex}
                  positionSec={playback.positionMs / 1000}
                  durationMs={playback.durationMs}
                  trailingSpace={i < group.length - 1}
                  onClick={() => seekTo(segments[segIndex])}
                />
              ))}
            </p>
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
  trailingSpace,
  onClick,
}: {
  segment: TranscriptSegment;
  segments: TranscriptSegment[];
  segIndex: number;
  timings: WordTiming[];
  karaoke: boolean;
  positionSec: number;
  durationMs: number;
  trailingSpace: boolean;
  onClick: () => void;
}) {
  const split = karaoke
    ? splitKaraokeText(segment.text, timings, positionSec, segment.start, getSegmentEndSec(segments, segIndex, durationMs, timings), 0)
    : null;
  return (
    <span className="transcript-segment" onClick={onClick} role="presentation">
      {split ? (
        <>
          {split.before}
          <mark className="karaoke-word">{split.active}</mark>
          {split.after}
        </>
      ) : (
        segment.text
      )}
      {trailingSpace ? " " : ""}
    </span>
  );
}
