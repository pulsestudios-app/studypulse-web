import { getYoutubeThumbnailUrl } from "../shared/youtube";
import type { LibraryRow } from "./libraryApi";

/** Phone library.tsx `formatDuration`: always MM:SS (90 minutes → "90:00"). */
export function formatDuration(seconds: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? (seconds as number) : 0));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

/** Phone library.tsx `formatDate`. */
export function formatDate(iso: string, locale?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
}

/** `saved_results.title` is nullable in prod; fall back to the file name, then "Untitled". */
export function displayTitle(row: Pick<LibraryRow, "title" | "source_file_name">): string {
  return row.title?.trim() || row.source_file_name?.trim() || "Untitled";
}

const SOURCE_LABELS: Record<string, string> = {
  youtube: "YouTube",
  recording: "Recording",
  audio: "Audio",
  video: "Video",
  pdf: "PDF",
  pptx: "Slides",
  docx: "Document",
  txt: "Text",
  file: "File",
};

export function sourceTypeLabel(sourceType: string | null | undefined): string {
  return SOURCE_LABELS[(sourceType ?? "").toLowerCase()] ?? "File";
}

export type ThumbnailIcon = "youtube" | "video" | "music" | "mic" | "document";

/**
 * Phone LibraryItemThumbnail: YouTube rows use img.youtube.com; video frames are
 * generated on-device from local files (not available on web), so those get an icon.
 */
export function thumbnailFor(row: Pick<LibraryRow, "source_type" | "youtube_url">): {
  imageUrl: string | null;
  icon: ThumbnailIcon;
} {
  const type = (row.source_type ?? "").toLowerCase();
  const imageUrl = row.youtube_url ? getYoutubeThumbnailUrl(row.youtube_url) : null;
  if (type === "youtube" || imageUrl) {
    return { imageUrl, icon: "youtube" };
  }
  if (type === "video") {
    return { imageUrl: null, icon: "video" };
  }
  if (type === "recording") {
    return { imageUrl: null, icon: "mic" };
  }
  if (type === "audio") {
    return { imageUrl: null, icon: "music" };
  }
  return { imageUrl: null, icon: "document" };
}
