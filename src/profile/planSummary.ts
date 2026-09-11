import { getNextResetDateFromProfile, resolveUsedMinutes } from "../shared/billingCycle";
import {
  formatPlanLabel,
  getEffectivePlan,
  getPlanTranscriptionLimitMinutes,
  getStoredPlan,
  getTrialDaysRemaining,
  isOnTrial,
  type EffectivePlan,
  type ProfileRecord,
} from "../shared/profilePlan";

/**
 * Profile columns the plan/usage logic reads (profilePlan.ts + billingCycle.ts).
 * Explicit instead of the phone's `select("*")` so push tokens, device id and
 * referral data never reach the browser.
 */
export const PROFILE_PLAN_COLUMNS = [
  "plan",
  "plan_type",
  "trial_ends_at",
  "subscription_active",
  "subscription_status",
  "subscription_expires_at",
  "current_cycle_start_at",
  "current_cycle_end_at",
  "minutes_used_in_cycle",
  "minutes_used_this_month",
  "usage_month",
  "bonus_minutes",
  "transcription_limit_minutes",
].join(",");

export type PlanSummary = {
  plan: EffectivePlan;
  label: string;
  /** Unlimited/lifetime show "N min used" instead of a quota (phone profile screen). */
  unlimited: boolean;
  usedMinutes: number;
  limitMinutes: number;
  remainingMinutes: number;
  /** 0..1 for the usage bar; 0 when unlimited. */
  usedFraction: number;
  trialDaysLeft: number | null;
  resetsOn: string;
  /** Same strings the phone's profile screen renders. */
  usageLine: string;
  /** Compact "12 / 45 min" for the header. */
  shortUsage: string;
};

/** Phone: `isBillingCycleStillActive` in library/api.ts — when false it calls billing-cycle/ensure first. */
export function needsBillingCycleEnsure(profile: ProfileRecord, now = new Date()): boolean {
  const raw = profile?.current_cycle_end_at;
  if (typeof raw !== "string" || !raw.trim()) {
    return true;
  }
  const end = new Date(raw);
  return Number.isNaN(end.getTime()) || end.getTime() <= now.getTime();
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

/**
 * Mirrors the phone: `getMonthlyUsage` (limit/used) + profile.tsx `loadUsage` (display strings).
 */
export function summarizePlan(profile: ProfileRecord, now = new Date()): PlanSummary {
  const plan = getEffectivePlan(profile);
  const stored = getStoredPlan(profile);
  const label = formatPlanLabel(profile);
  const trialDaysLeft = isOnTrial(profile) ? getTrialDaysRemaining(profile) : null;
  const resetsOn = getNextResetDateFromProfile(profile);

  if (stored === "unlimited" || stored === "lifetime") {
    const usedMin = asNumber(profile?.minutes_used_this_month, 0);
    const rounded = Math.round(usedMin);
    return {
      plan,
      label,
      unlimited: true,
      usedMinutes: rounded,
      limitMinutes: Number.POSITIVE_INFINITY,
      remainingMinutes: Number.POSITIVE_INFINITY,
      usedFraction: 0,
      trialDaysLeft,
      resetsOn,
      usageLine: `${rounded.toLocaleString()} min used this month`,
      shortUsage: `${rounded.toLocaleString()} min used`,
    };
  }

  const planLimit = getPlanTranscriptionLimitMinutes(profile);
  const limitMinutes = Number.isFinite(planLimit) ? planLimit : asNumber(profile?.transcription_limit_minutes, 999999);
  const usedMinutes = resolveUsedMinutes(profile, now);
  const remainingMinutes = Math.max(0, limitMinutes - usedMinutes);
  const unlimitedLimit = limitMinutes >= 999000;
  const limitDisplay = unlimitedLimit ? "Unlimited" : `${limitMinutes.toFixed(0)} min`;

  return {
    plan,
    label,
    unlimited: unlimitedLimit,
    usedMinutes,
    limitMinutes,
    remainingMinutes,
    usedFraction: unlimitedLimit || limitMinutes <= 0 ? 0 : Math.min(1, usedMinutes / limitMinutes),
    trialDaysLeft,
    resetsOn,
    usageLine: `${usedMinutes.toFixed(1)} / ${limitDisplay} used this month`,
    shortUsage: unlimitedLimit ? `${usedMinutes} min used` : `${usedMinutes} / ${limitMinutes.toFixed(0)} min`,
  };
}
