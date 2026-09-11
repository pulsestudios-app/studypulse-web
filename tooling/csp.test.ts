import { describe, expect, it } from "vitest";

import { buildCsp } from "./csp";

describe("buildCsp", () => {
  const csp = buildCsp({
    supabaseUrl: "https://uhfavszrclwwwnimxsbr.supabase.co",
    backendUrl: "https://studypulse-production.up.railway.app",
    posthogHost: "https://us.i.posthog.com",
    sentryDsn: "https://publickey@o123.ingest.us.sentry.io/456",
  });
  const directive = (name: string) =>
    csp
      .split("; ")
      .find((d) => d.startsWith(`${name} `))
      ?.split(" ")
      .slice(1) ?? [];

  it("allows exactly the app's API origins for connect-src", () => {
    expect(directive("connect-src")).toEqual([
      "'self'",
      "https://uhfavszrclwwwnimxsbr.supabase.co",
      "wss://uhfavszrclwwwnimxsbr.supabase.co",
      "https://studypulse-production.up.railway.app",
      "https://us.i.posthog.com",
      "https://o123.ingest.us.sentry.io",
    ]);
  });

  it("never leaks the Sentry key into the policy", () => {
    expect(csp).not.toContain("publickey");
  });

  it("has no inline or eval script allowances", () => {
    expect(directive("script-src")).toEqual(["'self'"]);
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(directive("object-src")).toEqual(["'none'"]);
  });

  it("only allows YouTube thumbnails as remote images", () => {
    expect(directive("img-src")).toEqual(["'self'", "data:", "https://img.youtube.com"]);
  });

  it("skips relative or missing origins (dev proxy, analytics off)", () => {
    const dev = buildCsp({ supabaseUrl: "https://x.supabase.co", backendUrl: "/backend" });
    expect(dev).toContain("connect-src 'self' https://x.supabase.co wss://x.supabase.co;");
  });
});
