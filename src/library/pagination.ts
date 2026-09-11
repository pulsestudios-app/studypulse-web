/** Offset pagination for the library (phone: `.range(offset, offset + limit - 1)`, page size 50). */

export const MAX_PAGE = 10_000;
export const MAX_SEARCH_LENGTH = 100;

/** `?page=` → 1-based page number; anything malformed falls back to 1. */
export function parsePageParam(raw: string | null | undefined): number {
  if (!raw || !/^\d{1,6}$/.test(raw.trim())) {
    return 1;
  }
  const page = Number(raw.trim());
  return Math.min(MAX_PAGE, Math.max(1, page));
}

/**
 * Inclusive Supabase range for a page. Requests one extra row so the next-page
 * button can be enabled without a separate count query.
 */
export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * pageSize;
  return { from, to: from + pageSize };
}

export function splitPage<T>(rows: readonly T[], pageSize: number): { items: T[]; hasNext: boolean } {
  return { items: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
}

/** Trims, collapses whitespace and caps length; empty → "". */
export function normalizeSearch(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH);
}

/** Escapes LIKE metacharacters so user input matches literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * `ilike` pattern for a case-insensitive "title contains" search, or null for no filter.
 * Note: PostgREST treats `*` as an alias for `%` in like patterns, so a literal `*`
 * in the search box acts as a wildcard (harmless: it only broadens the match).
 */
export function buildTitleSearchPattern(raw: string | null | undefined): string | null {
  const search = normalizeSearch(raw);
  return search ? `%${escapeLikePattern(search)}%` : null;
}

/** Query string for library links; omits defaults so URLs stay clean. */
export function libraryHref(page: number, search: string): string {
  const params = new URLSearchParams();
  const q = normalizeSearch(search);
  if (q) {
    params.set("q", q);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}
