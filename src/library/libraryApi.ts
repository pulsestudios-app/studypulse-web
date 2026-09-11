import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { supabase } from "../lib/supabase";
import { SAVED_RESULTS_PAGE_SIZE, type SavedResultRecord } from "../shared/savedResult";
import { buildTitleSearchPattern, normalizeSearch, pageRange, splitPage } from "./pagination";

/**
 * Leaner than the phone's PHONE_SAVED_RESULTS_LIST_COLUMNS: the web list has no
 * Summaries/Quizzes tabs or export, so `transcript_full_text`, `summary_main_idea`
 * and `quiz` (potentially large) are not fetched. Local media URIs are phone-only.
 */
export const LIBRARY_LIST_COLUMNS = "id,title,source_type,source_file_name,youtube_url,duration_seconds,folder_id,created_at";

/** Prod schema allows null title/source_type/duration_seconds even though the phone type doesn't. */
export type LibraryRow = Pick<SavedResultRecord, "id" | "source_file_name" | "created_at"> & {
  title: string | null;
  source_type: string | null;
  youtube_url: string | null;
  duration_seconds: number | null;
  folder_id: string | null;
};

export type LibraryPage = {
  items: LibraryRow[];
  page: number;
  hasNext: boolean;
};

export async function fetchLibraryPage(params: { userId: string; page: number; search: string }): Promise<LibraryPage> {
  const { from, to } = pageRange(params.page, SAVED_RESULTS_PAGE_SIZE);
  let query = supabase
    .from("saved_results")
    .select(LIBRARY_LIST_COLUMNS)
    .eq("user_id", params.userId)
    .is("deleted_at", null);
  const pattern = buildTitleSearchPattern(params.search);
  if (pattern) {
    query = query.ilike("title", pattern);
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    // Tie-breaker so offset pages are stable when rows share a timestamp.
    .order("id", { ascending: false })
    .range(from, to);
  if (error) {
    throw error;
  }
  const { items, hasNext } = splitPage((data ?? []) as LibraryRow[], SAVED_RESULTS_PAGE_SIZE);
  return { items, page: params.page, hasNext };
}

export function useLibraryPage(userId: string, page: number, search: string) {
  const q = normalizeSearch(search);
  return useQuery({
    queryKey: ["library", userId, page, q],
    queryFn: () => fetchLibraryPage({ userId, page, search: q }),
    placeholderData: keepPreviousData,
  });
}
