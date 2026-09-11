import { describe, expect, it } from "vitest";

import {
  authCallbackErrorMessage,
  DEFAULT_AFTER_AUTH_PATH,
  exchangeErrorMessage,
  parseAuthCallback,
  sanitizeNextPath,
} from "./callback";

const ORIGIN = "https://app.pulsestudios.app";
const CODE = "3f7a8f2e-5b1c-4d7e-9a3b-2c1d0e9f8a7b";

describe("parseAuthCallback", () => {
  it("reads a PKCE code from the query string", () => {
    expect(parseAuthCallback(`${ORIGIN}/auth/callback?code=${CODE}`)).toEqual({ kind: "code", code: CODE });
  });

  it("reads errors from the query string, preferring error_code", () => {
    expect(
      parseAuthCallback(`${ORIGIN}/auth/callback?error=access_denied&error_code=otp_expired&error_description=Link+expired`),
    ).toEqual({ kind: "error", code: "otp_expired" });
  });

  it("reads errors Supabase puts in the fragment", () => {
    expect(parseAuthCallback(`${ORIGIN}/auth/reset#error=access_denied&error_code=otp_expired`)).toEqual({
      kind: "error",
      code: "otp_expired",
    });
    expect(parseAuthCallback(`${ORIGIN}/auth/callback#error=server_error`)).toEqual({ kind: "error", code: "server_error" });
  });

  it("treats an error as authoritative even if a code is also present", () => {
    expect(parseAuthCallback(`${ORIGIN}/auth/callback?code=${CODE}&error=access_denied`)).toEqual({
      kind: "error",
      code: "access_denied",
    });
  });

  it("returns none when there is nothing to handle", () => {
    expect(parseAuthCallback(`${ORIGIN}/auth/callback`)).toEqual({ kind: "none" });
    expect(parseAuthCallback("not a url")).toEqual({ kind: "none" });
  });

  it("rejects malformed codes", () => {
    expect(parseAuthCallback(`${ORIGIN}/auth/callback?code=short`)).toEqual({ kind: "none" });
    expect(parseAuthCallback(`${ORIGIN}/auth/callback?code=${encodeURIComponent("<script>alert(1)</script>")}`)).toEqual({
      kind: "none",
    });
    expect(parseAuthCallback(`${ORIGIN}/auth/callback?code=${"a".repeat(600)}`)).toEqual({ kind: "none" });
  });

  it("normalizes and bounds error codes", () => {
    const result = parseAuthCallback(`${ORIGIN}/auth/callback?error=${"X".repeat(200)}`);
    expect(result.kind).toBe("error");
    expect(result.kind === "error" && result.code.length).toBe(64);
  });
});

describe("authCallbackErrorMessage", () => {
  it("maps known codes to fixed copy", () => {
    expect(authCallbackErrorMessage("otp_expired")).toMatch(/expired/);
    expect(authCallbackErrorMessage("bad_code_verifier")).toMatch(/same browser/);
  });

  it("never echoes unknown (attacker-controlled) input", () => {
    const message = authCallbackErrorMessage("call_555_0100_to_verify");
    expect(message).toBe("We couldn't complete sign-in. Please try again.");
  });
});

describe("exchangeErrorMessage", () => {
  it("detects a missing PKCE verifier (link opened in another browser)", () => {
    expect(exchangeErrorMessage(new Error("invalid request: both auth code and code verifier should be non-empty"))).toMatch(
      /same browser/,
    );
  });

  it("maps supabase-js's missing-verifier error (link opened in another browser)", () => {
    const error = Object.assign(new Error("PKCE code verifier not found in storage."), {
      code: "pkce_code_verifier_not_found",
    });
    expect(exchangeErrorMessage(error)).toMatch(/same browser/);
  });

  it("uses the GoTrue error code when present", () => {
    expect(exchangeErrorMessage(Object.assign(new Error("x"), { code: "otp_expired" }))).toMatch(/expired/);
  });

  it("falls back to a generic message", () => {
    expect(exchangeErrorMessage("boom")).toBe("We couldn't complete sign-in. Please try again.");
  });
});

describe("sanitizeNextPath", () => {
  it("keeps same-origin app paths with query and hash", () => {
    expect(sanitizeNextPath("/library?q=bio&page=2")).toBe("/library?q=bio&page=2");
    expect(sanitizeNextPath(`/results/${CODE}#top`)).toBe(`/results/${CODE}#top`);
  });

  it("defaults when empty", () => {
    expect(sanitizeNextPath(null)).toBe(DEFAULT_AFTER_AUTH_PATH);
    expect(sanitizeNextPath("")).toBe(DEFAULT_AFTER_AUTH_PATH);
  });

  it.each([
    "https://evil.example/library",
    "//evil.example/library",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "library",
    "/auth/sign-in",
    "/auth/callback?code=abc",
    "/auth",
    "/",
    "/library\nSet-Cookie: x",
  ])("rejects %j", (value) => {
    expect(sanitizeNextPath(value)).toBe(DEFAULT_AFTER_AUTH_PATH);
  });

  it("normalizes dot segments without escaping the origin", () => {
    expect(sanitizeNextPath("/settings/../library")).toBe("/library");
  });
});
