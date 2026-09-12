import { useQuery, useQueryClient } from "@tanstack/react-query";

import { countDueReviewCards } from "../shared/reviewQueue";

export const dueCountKey = (userId: string) => ["review-due-count", userId] as const;

/** Phone Home: `countDueReviewCards` on focus; the badge shows only when > 0. */
export function useDueCount(userId: string) {
  return useQuery({ queryKey: dueCountKey(userId), queryFn: () => countDueReviewCards(userId), staleTime: 30_000 });
}

export function useInvalidateDueCount(userId: string) {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: dueCountKey(userId) });
}
