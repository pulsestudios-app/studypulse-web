import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../lib/supabase";
import { parseResultRow, RESULT_COLUMNS, type ResultView } from "./resultParse";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isResultId(value: string): boolean {
  return UUID_RE.test(value);
}

export async function fetchResult(userId: string, id: string): Promise<ResultView | null> {
  // Phone getSavedResultById: no deleted_at filter — trashed rows still open (the page shows a banner).
  const { data, error } = await supabase.from("saved_results").select(RESULT_COLUMNS).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? parseResultRow(data as unknown as Record<string, unknown>) : null;
}

export const resultQueryKey = (userId: string, id: string) => ["result", userId, id] as const;

export function useResult(userId: string, id: string) {
  return useQuery({
    queryKey: resultQueryKey(userId, id),
    queryFn: () => fetchResult(userId, id),
    enabled: isResultId(id),
    staleTime: 60_000,
  });
}

/** Optimistically patches the cached view; callers persist to Supabase separately. */
export function useResultPatch(userId: string, id: string) {
  const client = useQueryClient();
  return (patch: Partial<ResultView>) => {
    client.setQueryData<ResultView | null>(resultQueryKey(userId, id), (current) => (current ? { ...current, ...patch } : current));
  };
}

/** Runs a persistence write; on failure, invalidates so the view falls back to what the row holds. */
export function usePersist(userId: string, id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (write: () => Promise<void>) => write(),
    onError: () => void client.invalidateQueries({ queryKey: resultQueryKey(userId, id) }),
  });
}
