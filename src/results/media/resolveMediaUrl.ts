import { supabase } from "../../lib/supabase";
import { COPY } from "../copy";
import { storagePathBelongsToUser, type MediaSource } from "./mediaSource";

/** Phone `resolveRecordingMediaUri`: sign directly with Supabase Storage for one hour. */
export const SIGNED_URL_TTL_SECONDS = 3600;

export async function resolveMediaUrl(source: MediaSource, userId: string): Promise<string | null> {
  if (source.kind === "url") {
    return source.url;
  }
  if (source.kind !== "storage") {
    return null;
  }
  if (!storagePathBelongsToUser(source, userId)) {
    throw new Error("Recording not available for this account.");
  }
  const { data, error } = await supabase.storage.from(source.bucket).createSignedUrl(source.path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error(COPY.media.failed);
  }
  return data.signedUrl;
}
