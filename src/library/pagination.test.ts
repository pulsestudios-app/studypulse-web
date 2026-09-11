import { describe, expect, it } from "vitest";

import { SAVED_RESULTS_PAGE_SIZE } from "../shared/savedResult";
import {
  buildTitleSearchPattern,
  escapeLikePattern,
  libraryHref,
  MAX_PAGE,
  MAX_SEARCH_LENGTH,
  normalizeSearch,
  pageRange,
  parsePageParam,
  splitPage,
} from "./pagination";

describe("parsePageParam", () => {
  it("parses positive integers", () => {
    expect(parsePageParam("1")).toBe(1);
    expect(parsePageParam("7")).toBe(7);
    expect(parsePageParam(" 3 ")).toBe(3);
  });

  it.each([null, undefined, "", "0", "-2", "1.5", "abc", "1e3", "0x10"])("falls back to 1 for %j", (raw) => {
    expect(parsePageParam(raw)).toBe(1);
  });

  it("caps very large pages", () => {
    expect(parsePageParam("999999")).toBe(MAX_PAGE);
    expect(parsePageParam("99999999999")).toBe(1);
  });
});

describe("pageRange / splitPage", () => {
  it("matches the phone's page size", () => {
    expect(SAVED_RESULTS_PAGE_SIZE).toBe(50);
  });

  it("requests one extra row per page (inclusive range)", () => {
    expect(pageRange(1, 50)).toEqual({ from: 0, to: 50 });
    expect(pageRange(2, 50)).toEqual({ from: 50, to: 100 });
    expect(pageRange(3, 10)).toEqual({ from: 20, to: 30 });
  });

  it("treats page < 1 as the first page", () => {
    expect(pageRange(0, 50)).toEqual({ from: 0, to: 50 });
  });

  it("uses the extra row only to detect a next page", () => {
    const full = Array.from({ length: 51 }, (_, i) => i);
    expect(splitPage(full, 50)).toEqual({ items: full.slice(0, 50), hasNext: true });
    expect(splitPage(full.slice(0, 50), 50)).toEqual({ items: full.slice(0, 50), hasNext: false });
    expect(splitPage([], 50)).toEqual({ items: [], hasNext: false });
  });

  it("consecutive pages neither overlap nor skip rows", () => {
    const rows = Array.from({ length: 120 }, (_, i) => i);
    const seen: number[] = [];
    for (let page = 1; page <= 3; page += 1) {
      const { from, to } = pageRange(page, 50);
      const { items } = splitPage(rows.slice(from, to + 1), 50);
      seen.push(...items);
    }
    expect(seen).toEqual(rows);
  });
});

describe("search", () => {
  it("normalizes whitespace and caps length", () => {
    expect(normalizeSearch("  cell   biology \n")).toBe("cell biology");
    expect(normalizeSearch(null)).toBe("");
    expect(normalizeSearch("x".repeat(500))).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it("escapes LIKE metacharacters", () => {
    expect(escapeLikePattern("100%_done\\")).toBe("100\\%\\_done\\\\");
  });

  it("builds a contains pattern or null", () => {
    expect(buildTitleSearchPattern("  Organic Chem ")).toBe("%Organic Chem%");
    expect(buildTitleSearchPattern("50%")).toBe("%50\\%%");
    expect(buildTitleSearchPattern("   ")).toBeNull();
  });
});

describe("libraryHref", () => {
  it("omits defaults", () => {
    expect(libraryHref(1, "")).toBe("/library");
    expect(libraryHref(2, "")).toBe("/library?page=2");
    expect(libraryHref(1, " bio ")).toBe("/library?q=bio");
    expect(libraryHref(3, "a&b")).toBe("/library?q=a%26b&page=3");
  });
});
