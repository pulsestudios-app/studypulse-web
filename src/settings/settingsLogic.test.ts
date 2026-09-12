import { describe, expect, it } from "vitest";

import type { ResultShare } from "../results/generationApi";
import { canConfirmDeletion } from "./accountLogic";
import { isShareInactive, markRevoked, shareMeta } from "./sharesLogic";
import { daysUntilPurge, withoutRow } from "./trashLogic";

const share = (over: Partial<ResultShare> = {}): ResultShare => ({
  id: "s1",
  savedResultId: "r",
  scope: "summary",
  title: "T",
  createdAt: "2026-09-01T00:00:00Z",
  expiresAt: null,
  revokedAt: null,
  viewCount: 12,
  url: "https://x/s/abc",
  ...over,
});

describe("shared links (phone shared-links.tsx)", () => {
  const now = Date.parse("2026-09-12T12:00:00Z");
  it("inactive when revoked or expired; meta shows views otherwise", () => {
    expect(isShareInactive(share(), now)).toBe(false);
    expect(isShareInactive(share({ revokedAt: "2026-09-02T00:00:00Z" }), now)).toBe(true);
    expect(isShareInactive(share({ expiresAt: "2026-09-12T12:00:00Z" }), now)).toBe(true);
    expect(isShareInactive(share({ expiresAt: "2026-09-13T00:00:00Z" }), now)).toBe(false);
    expect(shareMeta(share(), now)).toBe("Summary · 12 views");
    expect(shareMeta(share({ scope: "flashcards", revokedAt: "x" }), now)).toBe("Flashcards · Inactive");
  });
  it("revoke marks the row in place instead of removing it", () => {
    const list = [share(), share({ id: "s2" })];
    const next = markRevoked(list, "s2", "2026-09-12T12:00:00Z");
    expect(next).toHaveLength(2);
    expect(next[1].revokedAt).toBe("2026-09-12T12:00:00Z");
    expect(next[0].revokedAt).toBeNull();
  });
});

describe("trash (phone trash.tsx)", () => {
  it("days until purge = ceil(deleted + 30d - now), floored at 0", () => {
    const now = new Date("2026-09-12T12:00:00Z");
    expect(daysUntilPurge("2026-09-12T11:00:00Z", now)).toBe(30);
    expect(daysUntilPurge("2026-09-01T12:00:00Z", now)).toBe(19);
    expect(daysUntilPurge("2026-08-01T00:00:00Z", now)).toBe(0);
  });
  it("restore/delete remove the row from the list", () => {
    expect(withoutRow([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
  });
});

describe("account deletion (phone profile.tsx)", () => {
  it("confirms only on an exact DELETE", () => {
    expect(canConfirmDeletion("DELETE")).toBe(true);
    expect(canConfirmDeletion("delete")).toBe(false);
    expect(canConfirmDeletion("DELETE ")).toBe(false);
    expect(canConfirmDeletion("")).toBe(false);
  });
});
