/**
 * Builds the Content-Security-Policy injected into index.html for production builds.
 * GitHub Pages cannot set response headers, so the policy ships as a <meta> tag
 * (which means frame-ancestors / report-uri are unavailable).
 */
export type CspInput = {
  supabaseUrl: string;
  backendUrl: string;
  posthogHost?: string;
  sentryDsn?: string;
};

function originOf(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildCsp(input: CspInput): string {
  const supabase = originOf(input.supabaseUrl);
  const connect = new Set<string>(["'self'"]);
  if (supabase) {
    connect.add(supabase);
    connect.add(supabase.replace(/^http/, "ws"));
  }
  for (const extra of [input.backendUrl, input.posthogHost, input.sentryDsn]) {
    const origin = originOf(extra);
    if (origin) {
      connect.add(origin);
    }
  }

  // Media plays from signed Supabase Storage URLs; YouTube embeds are driven over postMessage (no script).
  const media = ["'self'", "blob:"];
  if (supabase) {
    media.push(supabase);
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'"],
    "style-src": ["'self'"],
    "img-src": ["'self'", "data:", "https://img.youtube.com"],
    "font-src": ["'self'"],
    "connect-src": [...connect],
    "media-src": media,
    "frame-src": ["https://www.youtube-nocookie.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
