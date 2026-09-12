import { getYoutubeVideoId } from "../../shared/youtube";

/**
 * `saved_results.source_media_uri` is polymorphic (see phone `resolveRecordingMediaUri` and the
 * backend's jobResultSave): a `recording://<uid>/<file>` reference, a bare `uploads/<uid>/…`
 * object key, an already-signed http(s) URL, a phone-local file path, or null (YouTube).
 */
export type MediaSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "storage"; bucket: "recordings" | "uploads" | "converted-documents"; path: string }
  | { kind: "url"; url: string }
  | { kind: "phone-local" }
  | { kind: "none" };

const STORAGE_URL_RE = /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;

export function classifyMediaSource(input: {
  sourceType: string;
  sourceMediaUri: string | null;
  youtubeUrl: string | null;
  supabaseUrl: string;
}): MediaSource {
  const youtubeId = input.youtubeUrl ? getYoutubeVideoId(input.youtubeUrl) : null;
  if (input.sourceType === "youtube" || youtubeId) {
    return youtubeId ? { kind: "youtube", videoId: youtubeId } : { kind: "none" };
  }
  const uri = input.sourceMediaUri?.trim() ?? "";
  if (!uri) {
    return { kind: "none" };
  }
  if (uri.startsWith("recording://")) {
    return { kind: "storage", bucket: "recordings", path: uri.slice("recording://".length) };
  }
  if (/^https?:\/\//i.test(uri)) {
    // A persisted Supabase storage URL (legacy rows): re-sign from its path instead of trusting an expired token.
    try {
      const url = new URL(uri);
      const match = url.pathname.match(STORAGE_URL_RE);
      if (match && url.origin === new URL(input.supabaseUrl).origin) {
        const bucket = match[1];
        if (bucket === "recordings" || bucket === "uploads" || bucket === "converted-documents") {
          return { kind: "storage", bucket, path: decodeURIComponent(match[2]) };
        }
      }
    } catch {
      // fall through
    }
    return { kind: "url", url: uri };
  }
  if (/^(?:file:|content:|\/|[A-Za-z]:\\)/i.test(uri) || uri.includes("studypulse_media/")) {
    return { kind: "phone-local" };
  }
  if (uri.startsWith("uploads/")) {
    return { kind: "storage", bucket: "uploads", path: uri };
  }
  // Backend converted-document keys look like `<type>/<uid>/…`.
  if (/^[a-z0-9_-]+\/[0-9a-f-]{36}\//i.test(uri)) {
    return { kind: "storage", bucket: "converted-documents", path: uri };
  }
  return { kind: "phone-local" };
}

/** Phone guard: only sign paths that belong to the signed-in user, never with `..` segments. */
export function storagePathBelongsToUser(source: Extract<MediaSource, { kind: "storage" }>, userId: string): boolean {
  const parts = source.path.split("/");
  if (parts.includes("..") || parts.some((p) => !p)) {
    return false;
  }
  const ownerIndex = source.bucket === "recordings" ? 0 : 1;
  return parts[ownerIndex] === userId;
}

export function isVideoPath(path: string): boolean {
  return /\.(mp4|mov|avi|mkv|webm|m4v)(\?|$)/i.test(path);
}
