import type { ErrorEvent } from "@sentry/react";
import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";

import {
  redactPathIds,
  sanitizePostHogEvent,
  sanitizeUrl,
  scrubWebBreadcrumb,
  scrubWebSentryEvent,
  scrubWebSentryTransaction,
} from "./privacy";

const ID = "3f7a8f2e-5b1c-4d7e-9a3b-2c1d0e9f8a7b";

describe("sanitizeUrl", () => {
  it("drops query strings and fragments, redacts ids", () => {
    expect(sanitizeUrl(`https://app.pulsestudios.app/auth/callback?code=${ID}`)).toBe(
      "https://app.pulsestudios.app/auth/callback",
    );
    expect(sanitizeUrl(`https://app.pulsestudios.app/results/${ID}#x`)).toBe("https://app.pulsestudios.app/results/:id");
    expect(sanitizeUrl("/library?q=my+secret+notes&page=2")).toBe("/library");
    expect(sanitizeUrl("https://user:pass@example.com/a?b=c")).toBe("https://example.com/a");
  });

  it("leaves non-URLs alone and hides other schemes", () => {
    expect(sanitizeUrl("$direct")).toBe("$direct");
    expect(sanitizeUrl("blob:https://x/abc")).toBe("blob:[redacted]");
  });

  it("redactPathIds", () => {
    expect(redactPathIds(`/results/${ID}/share/${ID.toUpperCase()}`)).toBe("/results/:id/share/:id");
  });
});

describe("sanitizePostHogEvent", () => {
  const base = (): CaptureResult => ({
    uuid: "u",
    event: "web_sign_in",
    properties: {
      token: "phc_project_key",
      distinct_id: "user-uuid",
      $current_url: `https://app.pulsestudios.app/auth/callback?code=${ID}`,
      $pathname: `/results/${ID}`,
      $referrer: "https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=y",
      $referring_domain: "accounts.google.com",
      $browser: "Chrome",
      method: "google",
      title: "Lecture about my private life",
      email: "a@b.com",
      note: "contact me at a@b.com or https://evil.example/x",
    },
    $set: { $initial_current_url: "/library?q=diagnosis", plan_tier: "free" },
  });

  it("keeps PostHog internals, sanitizes URLs, applies the phone denylist", () => {
    const out = sanitizePostHogEvent(base());
    expect(out?.properties).toEqual({
      token: "phc_project_key",
      distinct_id: "user-uuid",
      $current_url: "https://app.pulsestudios.app/auth/callback",
      $pathname: "/results/:id",
      $referrer: "https://accounts.google.com/o/oauth2/v2/auth",
      $referring_domain: "accounts.google.com",
      $browser: "Chrome",
      method: "google",
      note: "contact me at [email] or [url]",
    });
    expect(out?.$set).toEqual({ $initial_current_url: "/library", plan_tier: "free" });
  });

  it("passes null through", () => {
    expect(sanitizePostHogEvent(null)).toBeNull();
  });
});

describe("scrubWebSentryEvent", () => {
  it("applies the phone scrubber and web URL redaction", () => {
    const event = {
      type: undefined,
      message: "failed for a@b.com",
      transaction: `/results/${ID}`,
      request: {
        url: `https://app.pulsestudios.app/library?q=private&page=2`,
        query_string: "q=private",
        headers: { Authorization: "Bearer abc.def", "x-app-key": "k", Accept: "json" },
        cookies: { a: "b" },
      },
      exception: {
        values: [{ type: "Error", value: "GET https://x.supabase.co/rest/v1/saved_results?title=ilike.bio failed for a@b.com" }],
      },
      breadcrumbs: [
        { category: "navigation", data: { from: "/library?q=private", to: `/results/${ID}?tab=quiz` } },
        { category: "fetch", data: { url: "https://x.supabase.co/rest/v1/profiles?select=plan&id=eq.1", method: "GET" } },
      ],
    } as unknown as ErrorEvent;

    const out = scrubWebSentryEvent(event)!;
    expect(out.message).toBe("failed for [REDACTED_EMAIL]");
    expect(out.transaction).toBe("/results/:id");
    expect(out.request?.url).toBe("https://app.pulsestudios.app/library");
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toMatchObject({ Authorization: "[REDACTED]", "x-app-key": "[REDACTED]" });
    const value = out.exception?.values?.[0].value ?? "";
    expect(value).not.toContain("bio");
    expect(value).not.toContain("a@b.com");
    const [nav, fetchCrumb] = out.breadcrumbs ?? [];
    expect(nav.data).toEqual({ from: "/library", to: "/results/:id" });
    expect(JSON.stringify(fetchCrumb.data)).not.toContain("select=plan");
  });
});

describe("scrubWebBreadcrumb", () => {
  it("strips queries from navigation targets", () => {
    expect(scrubWebBreadcrumb({ category: "navigation", data: { to: "/library?q=x" } }).data).toEqual({ to: "/library" });
  });
});

describe("scrubWebSentryTransaction", () => {
  it("redacts span URLs, query data and transaction names", () => {
    const out = scrubWebSentryTransaction({
      type: "transaction",
      transaction: `https://app.pulsestudios.app/results/${ID}?x=1`,
      spans: [
        {
          span_id: "s",
          trace_id: "t",
          start_timestamp: 0,
          description: "GET https://x.supabase.co/rest/v1/saved_results?title=ilike.%25bio%25",
          data: { "http.query": "?title=ilike.bio", "url.full": "https://x.supabase.co/rest/v1/a?b=c", "http.method": "GET" },
        },
      ],
    } as Parameters<typeof scrubWebSentryTransaction>[0])!;
    expect(out.transaction).toBe("https://app.pulsestudios.app/results/:id");
    const span = out.spans![0];
    expect(span.description).not.toContain("bio");
    expect(span.data).toMatchObject({ "http.query": "[REDACTED]", "http.method": "GET" });
    expect(String(span.data?.["url.full"])).not.toContain("b=c");
  });
});
