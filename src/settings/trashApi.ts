import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { LIBRARY_LIST_COLUMNS, type LibraryRow } from "../library/libraryApi";
import { supabase } from "../lib/supabase";

import { TRASH_RETENTION_DAYS, withoutRow } from "./trashLogic";

export { daysUntilPurge, TRASH_RETENTION_DAYS, withoutRow } from "./trashLogic";
export type TrashRow = LibraryRow & { deleted_at: string };

/** Phone library/api.ts listTrashedSavedResults: last 30 days, newest deletion first (lean columns). */
export async function listTrashedResults(userId: string): Promise<TrashRow[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - TRASH_RETENTION_DAYS);
  const { data, error } = await supabase
    .from("saved_results")
    .select(`${LIBRARY_LIST_COLUMNS},deleted_at`)
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoff.toISOString())
    .order("deleted_at", { ascending: false })
    .limit(200);
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as TrashRow[];
}

/** Phone purgeOldTrashItems: rows deleted more than 30 days ago are removed on load. */
export async function purgeExpiredTrash(userId: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - TRASH_RETENTION_DAYS);
  const { error } = await supabase.from("saved_results").delete().eq("user_id", userId).not("deleted_at", "is", null).lt("deleted_at", cutoff.toISOString());
  if (error) {
    throw error;
  }
}

export async function restoreFromTrash(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("saved_results").update({ deleted_at: null }).eq("id", id).eq("user_id", userId);
  if (error) {
    throw error;
  }
}

export async function permanentlyDelete(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("saved_results").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    throw error;
  }
}

export const trashKey = (userId: string) => ["trash", userId] as const;

export function useTrash(userId: string) {
  return useQuery({
    queryKey: trashKey(userId),
    queryFn: async () => {
      await purgeExpiredTrash(userId).catch(() => undefined);
      return listTrashedResults(userId);
    },
    staleTime: 30_000,
  });
}

export function useTrashActions(userId: string) {
  const client = useQueryClient();
  const remove = (id: string) => client.setQueryData<TrashRow[]>(trashKey(userId), (rows) => (rows ? withoutRow(rows, id) : rows));
  const invalidateLibrary = () => void client.invalidateQueries({ queryKey: ["library", userId] });
  const restore = useMutation({
    mutationFn: (id: string) => restoreFromTrash(userId, id),
    onSuccess: (_d, id) => {
      remove(id);
      invalidateLibrary();
    },
  });
  const destroy = useMutation({ mutationFn: (id: string) => permanentlyDelete(userId, id), onSuccess: (_d, id) => remove(id) });
  const empty = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => permanentlyDelete(userId, id)));
    },
    onSuccess: () => client.setQueryData<TrashRow[]>(trashKey(userId), []),
  });
  return { restore, destroy, empty };
}
