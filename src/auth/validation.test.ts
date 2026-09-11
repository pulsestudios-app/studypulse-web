import { describe, expect, it } from "vitest";

import { validateNewPassword, validateSignUp } from "./validation";

describe("validateSignUp", () => {
  it("accepts a valid sign-up", () => {
    expect(validateSignUp("student@uni.edu", "secret1", "secret1")).toBeNull();
  });

  it("rejects malformed emails", () => {
    expect(validateSignUp("", "secret1", "secret1")).toMatch(/valid email/);
    expect(validateSignUp("no-at-sign", "secret1", "secret1")).toMatch(/valid email/);
  });

  it("blocks disposable domains like the phone does (including subdomains)", () => {
    expect(validateSignUp("a@mailinator.com", "secret1", "secret1")).toMatch(/Disposable/);
    expect(validateSignUp("a@x.yopmail.com", "secret1", "secret1")).toMatch(/Disposable/);
  });

  it("enforces the phone's 6-character minimum and matching confirmation", () => {
    expect(validateSignUp("a@b.co", "12345", "12345")).toMatch(/at least 6/);
    expect(validateSignUp("a@b.co", "123456", "123457")).toMatch(/match/);
  });
});

describe("validateNewPassword", () => {
  it("applies the same rules as sign-up", () => {
    expect(validateNewPassword("abcdef", "abcdef")).toBeNull();
    expect(validateNewPassword("abc", "abc")).toMatch(/at least 6/);
    expect(validateNewPassword("abcdef", "abcdeg")).toMatch(/match/);
  });
});
