import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { LIBRARY_LIST_COLUMNS, type LibraryRow } from "../library/libraryApi";
import { config } from "../lib/config";
import { supabase } from "../lib/supabase";
import { classifyMediaSource, storagePathBelongsToUser } from "../results/media/mediaSource";

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

type ForeverRow = { id: string; source_media_uri: string | null };

/** The student's own stored recording a note plays, if any (recordings bucket only). */
export function ownRecordingPath(uri: string | null, userId: string): string | null {
  const source = classifyMediaSource({ sourceType: "recording", sourceMediaUri: uri, youtubeUrl: null, supabaseUrl: config.supabaseUrl });
  if (source.kind !== "storage" || source.bucket !== "recordings") return null;
  return storagePathBelongsToUser(source, userId) ? source.path : null;
}

/**
 * Like the phone's deleteNotesForever (2026-11-08, bug hunt 3.18): the notes go, and so does
 * the recording each one played, unless another note (Library or Trash) still plays it.
 * Before, the web left the audio on the server forever.
 */
async function deleteNotesForever(userId: string, rows: ForeverRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("saved_results").delete().eq("user_id", userId).in("id", rows.map((r) => r.id));
  if (error) {
    throw error;
  }
  for (const row of rows) {
    const path = ownRecordingPath(row.source_media_uri, userId);
    if (!path || !row.source_media_uri) continue;
    const { data: others } = await supabase
      .from("saved_results")
      .select("id")
      .eq("user_id", userId)
      .eq("source_media_uri", row.source_media_uri)
      .limit(1);
    if (others && others.length > 0) continue;
    await supabase.storage.from("recordings").remove([path]).catch(() => undefined);
    // Marked deleted forever, so the phone's recovery never brings it back.
    const now = new Date().toISOString();
    await supabase
      .from("recordings")
      .update({ deleted_forever_at: now, deleted_at: now })
      .eq("user_id", userId)
      .eq("storage_path", path)
      .is("deleted_forever_at", null)
      .then(
        () => undefined,
        () => undefined
      );
  }
}

/** Phone purgeOldTrashItems: rows deleted more than 30 days ago are removed on load, with their recordings. */
export async function purgeExpiredTrash(userId: string): Promise<void> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - TRASH_RETENTION_DAYS);
  const { data, error } = await supabase
    .from("saved_results")
    .select("id,source_media_uri")
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoff.toISOString());
  if (error) {
    throw error;
  }
  await deleteNotesForever(userId, (data ?? []) as ForeverRow[]);
}

export async function restoreFromTrash(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("saved_results").update({ deleted_at: null }).eq("id", id).eq("user_id", userId);
  if (error) {
    throw error;
  }
}

export async function permanentlyDelete(userId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from("saved_results")
    .select("id,source_media_uri")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  await deleteNotesForever(userId, data ? [data as ForeverRow] : []);
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
