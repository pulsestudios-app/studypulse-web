// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/features/billing/billingCycle.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: import paths only.

import {
  getEffectivePlan,
  getStoredPlan,
  isOnTrial,
  type EffectivePlan,
} from "./profilePlan";

export type ProfileLike = Record<string, unknown> | null;

export const TRIAL_CYCLE_DAYS = 7;
export const FREE_CYCLE_DAYS = 30;
export const WEEKLY_PLAN_CYCLE_DAYS = 7;

const PAID_PLANS: EffectivePlan[] = [
  "student",
  "semester",
  "pro",
  "pro_weekly",
  "yearly",
  "unlimited",
  "lifetime",
];

export type BillingCyclePatch = {
  plan_type: string;
  current_cycle_start_at: string;
  current_cycle_end_at: string;
  minutes_used_in_cycle: number;
  usage_month?: string;
  minutes_used_this_month?: number;
  subscription_active?: boolean;
  subscription_status?: string;
};

export function parseIsoTimestamp(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function getMonthKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) {
    return `${day}th`;
  }
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatCycleResetDate(cycleEnd: Date): string {
  const month = cycleEnd.toLocaleString("en-US", { month: "long" });
  return `${month} ${ordinalSuffix(cycleEnd.getDate())}`;
}

export function isPaidPlanType(planType: string): boolean {
  return PAID_PLANS.includes(planType as EffectivePlan);
}

function cycleDurationDaysForPlan(plan: EffectivePlan): number {
  if (plan === "pro_weekly") {
    return WEEKLY_PLAN_CYCLE_DAYS;
  }
  return FREE_CYCLE_DAYS;
}

function subscriptionStillActive(profile: ProfileLike): boolean {
  if (!profile) {
    return false;
  }
  if (profile.subscription_active === true) {
    return true;
  }
  const status = typeof profile.subscription_status === "string" ? profile.subscription_status.toLowerCase() : "";
  return status === "active";
}

function trialEndFromProfile(profile: ProfileLike): Date | null {
  if (!profile) {
    return null;
  }
  const primary = profile.trial_ends_at;
  if (typeof primary === "string" && primary.trim()) {
    return parseIsoTimestamp(primary);
  }
  return null;
}

function inferPlanType(profile: ProfileLike, now: Date): string {
  const stored = typeof profile?.plan_type === "string" ? profile.plan_type.trim().toLowerCase() : "";
  if (stored === "trial" || stored === "free" || isPaidPlanType(stored)) {
    return stored;
  }
  if (isOnTrial(profile)) {
    return "trial";
  }
  const effective = getEffectivePlan(profile);
  if (effective !== "free" && subscriptionStillActive(profile)) {
    return effective;
  }
  if (effective !== "free") {
    return effective;
  }
  return "free";
}

function parseStoredMinutesUsed(raw: unknown): number | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === "string" && !raw.trim()) {
    return null;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
  }
  return null;
}

/** Preserve legacy monthly usage when first assigning rolling cycle fields. */
function resolveInitialCycleMinutes(
  profile: ProfileLike,
  now: Date
): Pick<BillingCyclePatch, "minutes_used_in_cycle" | "minutes_used_this_month" | "usage_month"> {
  const usageMonth = getMonthKey(now);
  const existingMinutes = parseStoredMinutesUsed(profile?.minutes_used_this_month);
  if (existingMinutes == null) {
    return {
      minutes_used_in_cycle: 0,
      minutes_used_this_month: 0,
      usage_month: usageMonth,
    };
  }
  const profileMonth = typeof profile?.usage_month === "string" ? profile.usage_month : "";
  if (profileMonth !== usageMonth) {
    return {
      minutes_used_in_cycle: 0,
      minutes_used_this_month: 0,
      usage_month: usageMonth,
    };
  }
  return {
    minutes_used_in_cycle: existingMinutes,
    minutes_used_this_month: existingMinutes,
    usage_month: usageMonth,
  };
}

export function buildTrialCyclePatch(now: Date, trialEnd: Date): BillingCyclePatch {
  return {
    plan_type: "trial",
    current_cycle_start_at: now.toISOString(),
    current_cycle_end_at: trialEnd.toISOString(),
    minutes_used_in_cycle: 0,
    usage_month: getMonthKey(now),
    minutes_used_this_month: 0,
  };
}

export function buildFreeCyclePatch(cycleStart: Date): BillingCyclePatch {
  const end = addDaysUtc(cycleStart, FREE_CYCLE_DAYS);
  return {
    plan_type: "free",
    current_cycle_start_at: cycleStart.toISOString(),
    current_cycle_end_at: end.toISOString(),
    minutes_used_in_cycle: 0,
    usage_month: getMonthKey(cycleStart),
    minutes_used_this_month: 0,
    subscription_active: false,
    subscription_status: "expired",
  };
}

export function buildPaidCyclePatch(
  plan: EffectivePlan,
  cycleStart: Date,
  cycleEnd: Date,
  resetMinutes: boolean
): BillingCyclePatch {
  const patch: BillingCyclePatch = {
    plan_type: plan,
    current_cycle_start_at: cycleStart.toISOString(),
    current_cycle_end_at: cycleEnd.toISOString(),
    minutes_used_in_cycle: resetMinutes ? 0 : 0,
  };
  if (resetMinutes) {
    patch.minutes_used_in_cycle = 0;
    patch.usage_month = getMonthKey(cycleStart);
    patch.minutes_used_this_month = 0;
  }
  return patch;
}

/** Initial or missing cycle fields for an existing profile row. */
export function buildInitialCyclePatch(profile: ProfileLike, now: Date): BillingCyclePatch {
  const preserved = resolveInitialCycleMinutes(profile, now);
  const trialEnd = trialEndFromProfile(profile);
  if (isOnTrial(profile) && trialEnd && trialEnd.getTime() > now.getTime()) {
    const start = parseIsoTimestamp(profile?.current_cycle_start_at) ?? now;
    return { ...buildTrialCyclePatch(start, trialEnd), ...preserved };
  }

  const stored = getStoredPlan(profile);
  if (stored !== "free" && subscriptionStillActive(profile)) {
    const start = now;
    const end = addDaysUtc(start, cycleDurationDaysForPlan(stored));
    return {
      plan_type: stored,
      current_cycle_start_at: start.toISOString(),
      current_cycle_end_at: end.toISOString(),
      ...preserved,
    };
  }

  return { ...buildFreeCyclePatch(now), ...preserved };
}

/**
 * When the current cycle has ended, compute the next cycle per product rules.
 */
export function buildRolloverCyclePatch(profile: ProfileLike, now: Date): BillingCyclePatch {
  const cycleEnd = parseIsoTimestamp(profile?.current_cycle_end_at) ?? now;
  const cycleStart = cycleEnd;
  const planType = inferPlanType(profile, now);
  const stored = getStoredPlan(profile);

  if (planType === "trial" || (isOnTrial(profile) && !subscriptionStillActive(profile))) {
    const trialEnd = trialEndFromProfile(profile);
    if (trialEnd && trialEnd.getTime() > now.getTime()) {
      return buildTrialCyclePatch(now, trialEnd);
    }
    return buildFreeCyclePatch(cycleStart);
  }

  if (subscriptionStillActive(profile) && stored !== "free") {
    const end = addDaysUtc(cycleStart, cycleDurationDaysForPlan(stored));
    return {
      plan_type: stored,
      current_cycle_start_at: cycleStart.toISOString(),
      current_cycle_end_at: end.toISOString(),
      minutes_used_in_cycle: 0,
      usage_month: getMonthKey(cycleStart),
      minutes_used_this_month: 0,
    };
  }

  return buildFreeCyclePatch(cycleStart);
}

export function isWithinBillingCycle(profile: ProfileLike, now = new Date()): boolean {
  const start = parseIsoTimestamp(profile?.current_cycle_start_at);
  const end = parseIsoTimestamp(profile?.current_cycle_end_at);
  if (!start || !end) {
    return false;
  }
  const t = now.getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function getMinutesUsedInCycle(profile: ProfileLike, now = new Date()): number {
  if (!isWithinBillingCycle(profile, now)) {
    return 0;
  }
  const raw = profile?.minutes_used_in_cycle;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.round(parsed));
    }
  }
  return 0;
}

/** Legacy calendar-month fallback when cycle columns are absent. */
export function getLegacyMonthlyUsedMinutes(profile: ProfileLike, now = new Date()): number {
  const monthKey = getMonthKey(now);
  const profileMonth = typeof profile?.usage_month === "string" ? profile.usage_month : "";
  if (profileMonth !== monthKey) {
    return 0;
  }
  const raw = profile?.minutes_used_this_month;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw);
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
}

export function resolveUsedMinutes(profile: ProfileLike, now = new Date()): number {
  if (parseIsoTimestamp(profile?.current_cycle_end_at)) {
    return getMinutesUsedInCycle(profile, now);
  }
  return getLegacyMonthlyUsedMinutes(profile, now);
}

export function computeBillingCyclePatch(profile: ProfileLike, now = new Date()): BillingCyclePatch | null {
  const end = parseIsoTimestamp(profile?.current_cycle_end_at);
  const start = parseIsoTimestamp(profile?.current_cycle_start_at);

  if (!start || !end) {
    return buildInitialCyclePatch(profile, now);
  }

  if (now.getTime() < end.getTime()) {
    return null;
  }

  return buildRolloverCyclePatch(profile, now);
}

export function getNextResetDateFromProfile(profile: ProfileLike): string {
  const end = parseIsoTimestamp(profile?.current_cycle_end_at);
  if (end && end.getTime() > Date.now()) {
    return formatCycleResetDate(end);
  }
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return formatCycleResetDate(next);
}
