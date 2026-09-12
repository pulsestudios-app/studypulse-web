export const TRASH_RETENTION_DAYS = 30;

/** Phone trash.tsx getDaysUntilPurge: ceil of days until deleted_at + 30 days, floored at 0. */
export function daysUntilPurge(deletedAt: string, now = new Date()): number {
  const deleted = new Date(deletedAt);
  const purgeDate = new Date(deleted);
  purgeDate.setDate(purgeDate.getDate() + TRASH_RETENTION_DAYS);
  const daysLeft = Math.ceil((purgeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
}

export function withoutRow<T extends { id: string }>(rows: T[], id: string): T[] {
  return rows.filter((row) => row.id !== id);
}
