// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/lib/youtube.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

export function getYoutubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }

    if (host.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) {
        return v;
      }
      const embed = parsed.pathname.match(/\/embed\/([\w-]{11})/);
      if (embed?.[1]) {
        return embed[1];
      }
      const shorts = parsed.pathname.match(/\/shorts\/([\w-]{11})/);
      if (shorts?.[1]) {
        return shorts[1];
      }
    }
  } catch {
    const short = trimmed.match(/youtu\.be\/([\w-]{11})/);
    if (short?.[1]) {
      return short[1];
    }
    const long = trimmed.match(/[?&]v=([\w-]{11})/);
    if (long?.[1]) {
      return long[1];
    }
  }

  return null;
}

export function getYoutubeThumbnailUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  if (!id) {
    return null;
  }
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}
