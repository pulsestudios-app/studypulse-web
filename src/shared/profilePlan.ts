// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/features/billing/profilePlan.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: import paths only.

import type { ProfileLike } from "./billingCycle";
import { getNextResetDateFromProfile } from "./billingCycle";

export type ProfileRecord = Record<string, unknown> | null;

export type EffectivePlan =
  | "free"
  | "student"
  | "semester"
  | "pro"
  | "pro_weekly"
  | "yearly"
  | "unlimited"
  | "lifetime";
export type UpgradeTargetPlan = "student" | "semester" | "pro" | "yearly" | "unlimited" | "lifetime";

function readTrialEndsAt(profile: ProfileRecord): string | undefined {
  if (!profile) {
    return undefined;
  }
  const primary = profile.trial_ends_at;
  if (typeof primary === "string" && primary.length > 0) {
    return primary;
  }
  return undefined;
}

export function isOnTrial(profile: ProfileRecord): boolean {
  const raw = readTrialEndsAt(profile);
  if (!raw) {
    return false;
  }
  const end = new Date(raw);
  if (Number.isNaN(end.getTime())) {
    return false;
  }
  return end.getTime() > Date.now();
}

export function getStoredPlan(profile: ProfileRecord): EffectivePlan {
  if (!profile) {
    return "free";
  }
  const raw = profile.plan;
  if (typeof raw !== "string" || !raw.trim()) {
    return "free";
  }
  const normalized = raw.trim().toLowerCase() as EffectivePlan;
  const allowed: EffectivePlan[] = [
    "free",
    "student",
    "semester",
    "pro",
    "pro_weekly",
    "yearly",
    "unlimited",
    "lifetime",
  ];
  return allowed.includes(normalized) ? normalized : "free";
}

export function getEffectivePlan(profile: ProfileRecord): EffectivePlan {
  const stored = getStoredPlan(profile);
  const status = String(profile?.subscription_status ?? "").toLowerCase();
  const expires = Date.parse(String(profile?.subscription_expires_at ?? profile?.current_cycle_end_at ?? ""));
  if (profile?.subscription_active === true && ["active", "canceled", "in_grace_period"].includes(status)
      && (stored === "lifetime" || expires > Date.now())) return stored;
  if (isOnTrial(profile)) {
    return "pro";
  }
  return "free";
}

const REFERRAL_ELIGIBLE_STORED_PLANS: EffectivePlan[] = [
  "student",
  "semester",
  "pro",
  "pro_weekly",
  "yearly",
  "unlimited",
  "lifetime",
];

function subscriptionStillActive(profile: ProfileRecord): boolean {
  if (!profile) {
    return false;
  }
  if (profile.subscription_active === true) {
    return true;
  }
  const status =
    typeof profile.subscription_status === "string" ? profile.subscription_status.toLowerCase() : "";
  return status === "active";
}

/** Paid (non-trial) subscribers can share referral codes and earn referral rewards. */
export function canShareReferrals(profile: ProfileRecord): boolean {
  if (!profile) {
    return false;
  }
  if (isOnTrial(profile)) {
    return false;
  }
  const plan = getStoredPlan(profile);
  if (plan === "free" || !REFERRAL_ELIGIBLE_STORED_PLANS.includes(plan)) {
    return false;
  }
  if (plan === "lifetime") {
    return true;
  }
  return subscriptionStillActive(profile);
}

export function getTrialDaysRemaining(profile: ProfileRecord): number | null {
  if (!isOnTrial(profile)) {
    return null;
  }
  const raw = readTrialEndsAt(profile);
  if (!raw) {
    return null;
  }
  const end = new Date(raw).getTime();
  const diffMs = end - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function getPlanTranscriptionLimitMinutes(profile: ProfileRecord): number {
  const plan = getEffectivePlan(profile);
  const bonusMinutesRaw = profile?.bonus_minutes;
  const bonusMinutes =
    typeof bonusMinutesRaw === "number" && Number.isFinite(bonusMinutesRaw) ? Math.max(0, bonusMinutesRaw) : 0;

  const baseLimit = (() => {
    switch (plan) {
      case "free":
        return 45;
      case "student":
      case "semester":
        return 600;
      case "pro":
      case "yearly":
        return 1000;
      case "pro_weekly":
        return 100;
      case "unlimited":
      case "lifetime":
        return 999999;
      default:
        return 15;
    }
  })();

  return baseLimit + bonusMinutes;
}

export function getMaxConcurrentJobs(profile: ProfileRecord): number {
  const plan = getEffectivePlan(profile);
  switch (plan) {
    case "free":
      return 1;
    case "student":
    case "semester":
      return 2;
    case "pro":
    case "pro_weekly":
    case "yearly":
      return 3;
    case "unlimited":
    case "lifetime":
      return 5;
    default:
      return 1;
  }
}

export function getRecommendedUpgrade(currentPlan: EffectivePlan): UpgradeTargetPlan | null {
  switch (currentPlan) {
    case "free":
      return "student";
    case "student":
    case "semester":
      return "pro";
    case "pro":
    case "yearly":
    case "pro_weekly":
      return "unlimited";
    case "unlimited":
      return "lifetime";
    case "lifetime":
      return null;
    default:
      return "student";
  }
}

/** Optional second target when two upgrades are both reasonable (e.g. Free → Pro). */
export function getAlternateRecommendedUpgrade(currentPlan: EffectivePlan): UpgradeTargetPlan | null {
  switch (currentPlan) {
    case "free":
      return "pro";
    case "student":
    case "semester":
      return "unlimited";
    default:
      return null;
  }
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

/** Prefer passing the user's profile row for rolling-cycle reset dates. */
export function getNextResetDate(profile?: ProfileLike): string {
  if (profile) {
    return getNextResetDateFromProfile(profile);
  }
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const month = next.toLocaleString("en-US", { month: "long" });
  return `${month} ${ordinalSuffix(next.getDate())}`;
}

export function formatPlanLabel(profile: ProfileRecord): string {
  if (isOnTrial(profile)) {
    return "Pro (trial)";
  }
  const plan = getStoredPlan(profile);
  const labels: Record<EffectivePlan, string> = {
    free: "Free",
    student: "Student",
    semester: "Semester",
    pro: "Pro",
    pro_weekly: "Exam Pass",
    yearly: "Yearly",
    unlimited: "Unlimited",
    lifetime: "Lifetime",
  };
  return labels[plan] ?? "Free";
}

/** Display label for the AI tier (matches marketing copy). */
export function getModelForPlan(plan: EffectivePlan): string {
  switch (plan) {
    case "free":
    case "student":
    case "semester":
      return "Haiku";
    case "pro":
    case "pro_weekly":
    case "yearly":
      return "Sonnet";
    case "unlimited":
    case "lifetime":
      return "Sonnet";
    default:
      return "Haiku";
  }
}

const FREE_PLAN_FEATURES: readonly string[] = [
  "45 min transcription per month",
  "Transcript & Summary only",
  "Quiz generation on paid plans",
  "Watermarked exports",
  "Ad supported",
];

const STUDENT_TIER_FEATURES: readonly string[] = [
  "600 min per month",
  "Full transcript, summary & concepts",
  "Unlimited quiz generation",
  "Library saving",
  "No ads",
  "Export without watermark",
];

const PRO_TIER_FEATURES: readonly string[] = [
  "1,000 min per month",
  "Everything in Student",
  "Better AI",
  "Priority processing",
  "YouTube & Shorts support",
  "No watermark",
];

const EXAM_PASS_FEATURES: readonly string[] = [
  "100 minutes per week",
  "Same features as Pro",
  "Perfect for exam season",
  "Cancel anytime",
  "No commitment",
];

const UNLIMITED_FEATURES: readonly string[] = [
  "Unlimited transcription minutes",
  "Advanced AI",
  "Fastest processing speed",
  "Everything included",
  "Priority support",
];

const LIFETIME_FEATURES: readonly string[] = [
  "Unlimited everything forever",
  "Advanced AI",
  "Never pay again",
  "All future features included",
];

/** Bullet list describing plan capabilities (for upgrade UI and tooling). */
export function getPlanFeatures(plan: EffectivePlan): readonly string[] {
  switch (plan) {
    case "free":
      return FREE_PLAN_FEATURES;
    case "student":
    case "semester":
      return STUDENT_TIER_FEATURES;
    case "pro":
    case "yearly":
      return PRO_TIER_FEATURES;
    case "pro_weekly":
      return EXAM_PASS_FEATURES;
    case "unlimited":
      return UNLIMITED_FEATURES;
    case "lifetime":
      return LIFETIME_FEATURES;
    default:
      return FREE_PLAN_FEATURES;
  }
}
