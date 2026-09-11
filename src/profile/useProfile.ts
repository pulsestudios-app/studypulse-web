import { useQuery } from "@tanstack/react-query";

import { ensureProfileBillingCycle } from "../lib/backend";
import { supabase } from "../lib/supabase";
import type { ProfileRecord } from "../shared/profilePlan";
import { needsBillingCycleEnsure, PROFILE_PLAN_COLUMNS, summarizePlan, type PlanSummary } from "./planSummary";

async function fetchProfile(userId: string): Promise<ProfileRecord> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_PLAN_COLUMNS).eq("id", userId).maybeSingle();
  if (error) {
    throw error;
  }
  return (data ?? null) as ProfileRecord;
}

/**
 * Same source as the phone: the user's own `profiles` row via RLS, rolling the
 * billing cycle through the backend first when it has ended. If the backend call
 * fails (e.g. CORS not deployed yet) the stored row is still shown — for an ended
 * cycle `resolveUsedMinutes` already reports 0 used.
 */
export async function loadProfile(userId: string): Promise<ProfileRecord> {
  const profile = await fetchProfile(userId);
  if (!needsBillingCycleEnsure(profile)) {
    return profile;
  }
  try {
    await ensureProfileBillingCycle();
    return await fetchProfile(userId);
  } catch {
    return profile;
  }
}

export function useProfile(userId: string): {
  profile: ProfileRecord | undefined;
  summary: PlanSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => loadProfile(userId),
    staleTime: 60_000,
  });
  return {
    profile: query.data,
    summary: query.data === undefined ? undefined : summarizePlan(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}
