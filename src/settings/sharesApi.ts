import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backendFetch } from "../lib/backend";
import type { ResultShare } from "../results/generationApi";
import { markRevoked } from "./sharesLogic";

export { isShareInactive, markRevoked, shareMeta } from "./sharesLogic";

/** Phone src/features/sharing/api.ts: GET /v1/shares?limit=100 and DELETE /v1/shares/:id. */
export async function listResultShares(): Promise<ResultShare[]> {
  const payload = await backendFetch<{ shares?: ResultShare[] }>("/v1/shares?limit=100", { method: "GET" });
  return Array.isArray(payload?.shares) ? payload.shares : [];
}

export async function revokeResultShare(shareId: string): Promise<void> {
  await backendFetch<{ success: boolean }>(`/v1/shares/${encodeURIComponent(shareId)}`, { method: "DELETE" });
}

export const sharesKey = ["shares"] as const;

export function useShares() {
  return useQuery({ queryKey: sharesKey, queryFn: listResultShares, staleTime: 30_000 });
}

export function useRevokeShare() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: revokeResultShare,
    onSuccess: (_data, id) => client.setQueryData<ResultShare[]>(sharesKey, (current) => (current ? markRevoked(current, id) : current)),
  });
}
