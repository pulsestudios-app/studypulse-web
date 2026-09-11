import { describe, expect, it } from "vitest";

import { ANALYTICS_OPT_OUT_KEY, AUTH_STORAGE_KEY, clearAppStorage } from "./storage";

function fakeStorage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

describe("clearAppStorage", () => {
  it("removes app-owned keys (session, PKCE verifier) but keeps the analytics opt-out", () => {
    const local = fakeStorage({
      [AUTH_STORAGE_KEY]: "{session}",
      [`${AUTH_STORAGE_KEY}-code-verifier`]: "v",
      "studypulse.web.anything": "x",
      [ANALYTICS_OPT_OUT_KEY]: "true",
      "unrelated.key": "keep",
    });
    const session = fakeStorage({ "studypulse.web.auth.next": "/library" });

    const removed = clearAppStorage(local, session);

    expect(removed.sort()).toEqual([AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`, "studypulse.web.anything"].sort());
    expect([...local.map.keys()].sort()).toEqual([ANALYTICS_OPT_OUT_KEY, "unrelated.key"].sort());
    expect(session.map.size).toBe(0);
  });
});
