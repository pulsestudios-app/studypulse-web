import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";

import { useSession } from "../../auth/AuthProvider";
import { Icon } from "../../components/Icon";
import { config } from "../../lib/config";
import { COPY } from "../copy";
import { formatClock } from "../transcript/activeSegment";
import { classifyMediaSource, isVideoPath, type MediaSource } from "./mediaSource";
import { IDLE_PLAYBACK, type PlaybackController, type PlaybackState } from "./playback";
import { resolveMediaUrl } from "./resolveMediaUrl";
import {
  parseYoutubeMessage,
  YOUTUBE_EMBED_ORIGIN,
  YOUTUBE_LISTEN_MESSAGE,
  YOUTUBE_STATE_PLAYING,
  youtubeCommandMessage,
  youtubeEmbedUrl,
} from "./youtubeEmbed";

export type MediaPlayerHandle = { seek: (seconds: number, play?: boolean) => void };

type Props = {
  sourceType: string;
  sourceMediaUri: string | null;
  youtubeUrl: string | null;
  onState: (state: PlaybackController) => void;
  handleRef?: Ref<MediaPlayerHandle>;
};

/** Mounts the right player for the row and publishes position/seek to the transcript. */
export function MediaPlayer({ sourceType, sourceMediaUri, youtubeUrl, onState, handleRef }: Props) {
  const source = useMemo(
    () => classifyMediaSource({ sourceType, sourceMediaUri, youtubeUrl, supabaseUrl: config.supabaseUrl }),
    [sourceType, sourceMediaUri, youtubeUrl],
  );
  if (source.kind === "youtube") {
    return <YoutubePlayer videoId={source.videoId} onState={onState} handleRef={handleRef} />;
  }
  if (source.kind === "storage" || source.kind === "url") {
    const key = source.kind === "storage" ? `${source.bucket}/${source.path}` : source.url;
    return <HtmlMediaPlayer key={key} source={source} onState={onState} handleRef={handleRef} />;
  }
  return <UnavailableMedia kind={source.kind} onState={onState} />;
}

function UnavailableMedia({ kind, onState }: { kind: "phone-local" | "none"; onState: Props["onState"] }) {
  useEffect(() => {
    onState(IDLE_PLAYBACK);
  }, [onState]);
  if (kind === "none") {
    return null;
  }
  return (
    <div className="media-notice" role="note">
      <Icon name="mic" size={22} />
      <div>
        <strong>{COPY.media.onPhone}</strong>
        <p className="type-caption text-secondary">{COPY.media.onPhoneBody}</p>
      </div>
    </div>
  );
}

function HtmlMediaPlayer({
  source,
  onState,
  handleRef,
}: {
  source: Extract<MediaSource, { kind: "storage" | "url" }>;
  onState: Props["onState"];
  handleRef?: Ref<MediaPlayerHandle>;
}) {
  const session = useSession();
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PlaybackState>({ positionMs: 0, durationMs: 0, playing: false, available: true });
  const isVideo = source.kind === "storage" ? isVideoPath(source.path) : isVideoPath(source.url);

  // The component is keyed by source, so a new source mounts fresh state; retries clear the error themselves.
  useEffect(() => {
    let active = true;
    resolveMediaUrl(source, session.user.id)
      .then((resolved) => {
        if (active) {
          setUrl(resolved);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : COPY.media.failed);
        }
      });
    // Signed URLs expire after an hour; refresh a little before that.
    const timer = window.setTimeout(() => setAttempt((n) => n + 1), 55 * 60 * 1000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [source, session.user.id, attempt]);

  const seek = useCallback((seconds: number, play = false) => {
    const el = mediaRef.current;
    if (!el) {
      return;
    }
    el.currentTime = Math.max(0, seconds);
    if (play) {
      void el.play().catch(() => undefined);
    }
  }, []);

  useImperativeHandle(handleRef, () => ({ seek }), [seek]);

  useEffect(() => {
    onState({ ...state, seek });
  }, [state, seek, onState]);

  const sync = () => {
    const el = mediaRef.current;
    if (!el) {
      return;
    }
    setState({
      positionMs: Math.floor(el.currentTime * 1000),
      durationMs: Number.isFinite(el.duration) ? Math.floor(el.duration * 1000) : 0,
      playing: !el.paused && !el.ended,
      available: true,
    });
  };

  if (error) {
    return (
      <div className="media-notice notice-error" role="alert">
        <span>{error}</span>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        >
          {COPY.media.retry}
        </button>
      </div>
    );
  }
  if (!url) {
    return <div className="media-loading skeleton" aria-label={COPY.media.loading} />;
  }
  const shared = {
    src: url,
    controls: true,
    preload: "metadata" as const,
    onTimeUpdate: sync,
    onPlay: sync,
    onPause: sync,
    onEnded: sync,
    onLoadedMetadata: sync,
    onError: () => setError(COPY.media.failed),
  };
  return isVideo ? (
    <video ref={(el) => void (mediaRef.current = el)} className="media-video" playsInline {...shared} />
  ) : (
    <div className="media-audio">
      <audio ref={(el) => void (mediaRef.current = el)} className="media-audio-el" {...shared} />
      <span className="type-caption text-secondary media-clock">
        {formatClock(state.positionMs / 1000)} / {formatClock(state.durationMs / 1000)}
      </span>
    </div>
  );
}

/** Drives the embed with the IFrame API's postMessage protocol; no external script under CSP. */
function YoutubePlayer({ videoId, onState, handleRef }: { videoId: string; onState: Props["onState"]; handleRef?: Ref<MediaPlayerHandle> }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<PlaybackState>({ positionMs: 0, durationMs: 0, playing: false, available: true });
  const embedUrl = useMemo(() => youtubeEmbedUrl(videoId, window.location.origin), [videoId]);

  const post = useCallback((message: string) => {
    frameRef.current?.contentWindow?.postMessage(message, YOUTUBE_EMBED_ORIGIN);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YOUTUBE_EMBED_ORIGIN || event.source !== frameRef.current?.contentWindow) {
        return;
      }
      const info = parseYoutubeMessage(event.data);
      if (!info) {
        return;
      }
      setState((prev) => ({
        positionMs: info.currentTime !== undefined ? Math.floor(info.currentTime * 1000) : prev.positionMs,
        durationMs: info.duration !== undefined ? Math.floor(info.duration * 1000) : prev.durationMs,
        playing: info.playerState !== undefined ? info.playerState === YOUTUBE_STATE_PLAYING : prev.playing,
        available: true,
      }));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const seek = useCallback(
    (seconds: number, play = false) => {
      // Phone seekYouTube: start playback first so a cued/paused iframe honours the seek.
      post(youtubeCommandMessage({ func: "playVideo" }));
      window.setTimeout(() => {
        post(youtubeCommandMessage({ func: "seekTo", args: [Math.max(0, seconds), true] }));
        if (!play) {
          window.setTimeout(() => post(youtubeCommandMessage({ func: "pauseVideo" })), 150);
        }
      }, 100);
    },
    [post],
  );

  useImperativeHandle(handleRef, () => ({ seek }), [seek]);

  useEffect(() => {
    onState({ ...state, seek });
  }, [state, seek, onState]);

  return (
    <div className="media-youtube">
      <iframe
        ref={frameRef}
        title="YouTube video"
        src={embedUrl}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => post(YOUTUBE_LISTEN_MESSAGE)}
      />
    </div>
  );
}
