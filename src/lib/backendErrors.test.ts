import { describe, expect, it } from "vitest";

import { readBackendErrorBody } from "./backendErrors";

describe("readBackendErrorBody", () => {
  it("reads the backend's error shapes", () => {
    expect(readBackendErrorBody({ error: "Profile not found" }, "x")).toEqual({ message: "Profile not found", code: null });
    expect(readBackendErrorBody({ error: { code: "EMAIL_NOT_VERIFIED", message: "Verify" } }, "x")).toEqual({
      message: "Verify",
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(readBackendErrorBody({ message: "Oops" }, "x")).toEqual({ message: "Oops", code: null });
  });

  it("falls back for empty or unexpected bodies", () => {
    expect(readBackendErrorBody(null, "fallback")).toEqual({ message: "fallback", code: null });
    expect(readBackendErrorBody({ error: "" }, "fallback")).toEqual({ message: "fallback", code: null });
    expect(readBackendErrorBody({ error: { code: 5 } }, "fallback")).toEqual({ message: "fallback", code: null });
  });
});
