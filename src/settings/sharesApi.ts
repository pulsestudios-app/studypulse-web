import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { backendFetch } from "../lib/backend";
import type { ResultShare } from "../results/generationApi";

/** Phone src/features/sharing/api.ts: GET /v1/shares?limit=100 and DELETE /v1/shares/:id. */
export async function listResultShares(): Promise<ResultShare[]> {
  const payload = await backendFetch<{ shares?: ResultShare[] }>("/v1/shares?limit=100", { method: "GET" });
  return Array.isArray(payload?.shares) ? payload.shares : [];
}

export async function revokeResultShare(shareId: string): Promise<void> {
  await backendFetch<{ success: boolean }>(`/v1/shares/${encodeURIComponent(shareId)}`, { method: "DELETE" });
}

/** Phone shared-links.tsx: revoked, or expired. */
export function isShareInactive(share: Pick<ResultShare, "revokedAt" | "expiresAt">, now = Date.now()): boolean {
  return Boolean(share.revokedAt) || Boolean(share.expiresAt && new Date(share.expiresAt).getTime() <= now);
}

/** Phone row meta: "Summary · 12 views" or "Summary · Inactive". */
export function shareMeta(share: ResultShare, now = Date.now()): string {
  const scope = share.scope.charAt(0).toUpperCase() + share.scope.slice(1);
  return `${scope} · ${isShareInactive(share, now) ? "Inactive" : `${share.viewCount} views`}`;
}

/** Phone: after revoking, the row is marked revoked in place rather than removed. */
export function markRevoked(shares: ResultShare[], id: string, at = new Date().toISOString()): ResultShare[] {
  return shares.map((item) => (item.id === id ? { ...item, revokedAt: at } : item));
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
