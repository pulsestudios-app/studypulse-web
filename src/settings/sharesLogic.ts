import type { ResultShare } from "../results/generationApi";

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
