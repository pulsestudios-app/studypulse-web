/** Minimal inline icons standing in for the phone's Ionicons (no icon font / CDN needed under CSP). */
export type IconName =
  | "youtube"
  | "video"
  | "music"
  | "mic"
  | "document"
  | "search"
  | "library"
  | "settings"
  | "chevron-left"
  | "chevron-right"
  | "logout"
  | "google";

const PATHS: Record<Exclude<IconName, "google">, string> = {
  youtube: "M4 7.5C4 6 5 5 6.5 5h11C19 5 20 6 20 7.5v9c0 1.5-1 2.5-2.5 2.5h-11C5 19 4 18 4 16.5v-9zM10 9v6l5-3-5-3z",
  video: "M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.5l5-3v11l-5-3V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  music: "M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.9 0 1.7.4 2.5 1V5l11-2v12.5a2.5 2.5 0 1 1-2.5-2.5c.9 0 1.7.4 2.5 1V6.5L9 8.3v9.2z",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zm-6 9h1.5a4.5 4.5 0 0 0 9 0H18a6 6 0 0 1-5.25 5.95V21h-1.5v-3.05A6 6 0 0 1 6 12z",
  document: "M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 1.5V9h4.5L13 4.5zM7.5 12v1.5h9V12h-9zm0 3.5V17h9v-1.5h-9z",
  search: "M10.5 4a6.5 6.5 0 0 1 5.2 10.4l4.4 4.4-1.3 1.3-4.4-4.4A6.5 6.5 0 1 1 10.5 4zm0 1.8a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4z",
  library: "M4 4h4v16H4V4zm6 0h4v16h-4V4zm5.3 1.2 3.8-1 4.1 15.5-3.8 1-4.1-15.5z",
  settings:
    "M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM10.3 2h3.4l.5 2.6c.6.2 1.2.5 1.7.9l2.5-.9 1.7 2.9-2 1.7c.1.6.1 1.3 0 1.9l2 1.7-1.7 2.9-2.5-.9c-.5.4-1.1.7-1.7.9l-.5 2.6h-3.4l-.5-2.6c-.6-.2-1.2-.5-1.7-.9l-2.5.9-1.7-2.9 2-1.7a6 6 0 0 1 0-1.9l-2-1.7L5.6 3.6l2.5.9c.5-.4 1.1-.7 1.7-.9L10.3 2z",
  "chevron-left": "M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12l6.6-6.6z",
  "chevron-right": "M8.6 5.4 10 4l8 8-8 8-1.4-1.4 6.6-6.6-6.6-6.6z",
  logout: "M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9V3zM7.6 7.6 9 9l-2 2h8v2H7l2 2-1.4 1.4L3.2 12l4.4-4.4z",
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  if (name === "google") {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={className}>
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d={PATHS[name]} fillRule="evenodd" />
    </svg>
  );
}
