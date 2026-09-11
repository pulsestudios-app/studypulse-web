import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { needsBillingCycleEnsure, PROFILE_PLAN_COLUMNS, summarizePlan } from "./planSummary";

const NOW = new Date("2026-09-11T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString();

const activeCycle = { current_cycle_start_at: iso(-10), current_cycle_end_at: iso(20) };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("summarizePlan (mirrors phone getMonthlyUsage + profile screen)", () => {
  it("free plan inside an active cycle", () => {
    const s = summarizePlan({ plan: "free", ...activeCycle, minutes_used_in_cycle: 12.4 });
    expect(s).toMatchObject({
      plan: "free",
      label: "Free",
      unlimited: false,
      usedMinutes: 12,
      limitMinutes: 45,
      remainingMinutes: 33,
      usageLine: "12.0 / 45 min used this month",
      shortUsage: "12 / 45 min",
      trialDaysLeft: null,
    });
    expect(s.usedFraction).toBeCloseTo(12 / 45);
  });

  it("active trial counts as Pro (1000 min) with the trial label", () => {
    const s = summarizePlan({ plan: "free", trial_ends_at: iso(3), ...activeCycle, minutes_used_in_cycle: 0 });
    expect(s).toMatchObject({ plan: "pro", label: "Pro (trial)", limitMinutes: 1000, trialDaysLeft: 3 });
  });

  it("paid plan with an active subscription (launch-ota rule, matches backend)", () => {
    const s = summarizePlan({
      plan: "student",
      subscription_active: true,
      subscription_status: "active",
      subscription_expires_at: iso(15),
      ...activeCycle,
      minutes_used_in_cycle: "100",
    });
    expect(s).toMatchObject({ plan: "student", label: "Student", limitMinutes: 600, usedMinutes: 100 });
  });

  it("expired subscription falls back to the free quota (label still shows the stored plan, as on the phone)", () => {
    const s = summarizePlan({
      plan: "pro",
      subscription_active: true,
      subscription_status: "active",
      subscription_expires_at: iso(-1),
      current_cycle_end_at: iso(-1),
    });
    expect(s).toMatchObject({ plan: "free", label: "Pro", limitMinutes: 45 });
  });

  it("adds bonus minutes to the limit", () => {
    expect(summarizePlan({ plan: "free", bonus_minutes: 30, ...activeCycle }).limitMinutes).toBe(75);
  });

  it("an ended cycle reports 0 used", () => {
    const s = summarizePlan({
      plan: "free",
      current_cycle_start_at: iso(-40),
      current_cycle_end_at: iso(-10),
      minutes_used_in_cycle: 44,
    });
    expect(s.usedMinutes).toBe(0);
  });

  it("legacy calendar-month usage when no cycle columns are set", () => {
    const s = summarizePlan({ plan: "free", usage_month: "2026-09", minutes_used_this_month: 20 });
    expect(s.usedMinutes).toBe(20);
    expect(summarizePlan({ plan: "free", usage_month: "2026-08", minutes_used_this_month: 20 }).usedMinutes).toBe(0);
  });

  it("unlimited/lifetime show minutes used instead of a quota", () => {
    const s = summarizePlan({ plan: "lifetime", minutes_used_this_month: 1234.4 });
    expect(s).toMatchObject({
      unlimited: true,
      label: "Lifetime",
      usedMinutes: 1234,
      usedFraction: 0,
      usageLine: `${(1234).toLocaleString()} min used this month`,
    });
  });

  it("handles a missing profile row", () => {
    expect(summarizePlan(null)).toMatchObject({ plan: "free", label: "Free", limitMinutes: 45, usedMinutes: 0 });
  });

  it("caps the usage bar at 100%", () => {
    expect(summarizePlan({ plan: "free", ...activeCycle, minutes_used_in_cycle: 90 }).usedFraction).toBe(1);
  });
});

describe("needsBillingCycleEnsure (phone isBillingCycleStillActive)", () => {
  it("is false only for a future cycle end", () => {
    expect(needsBillingCycleEnsure({ current_cycle_end_at: iso(1) }, NOW)).toBe(false);
    expect(needsBillingCycleEnsure({ current_cycle_end_at: iso(-1) }, NOW)).toBe(true);
    expect(needsBillingCycleEnsure({ current_cycle_end_at: "garbage" }, NOW)).toBe(true);
    expect(needsBillingCycleEnsure({}, NOW)).toBe(true);
    expect(needsBillingCycleEnsure(null, NOW)).toBe(true);
  });
});

describe("PROFILE_PLAN_COLUMNS", () => {
  it("never selects push tokens, email, device or referral data", () => {
    for (const column of ["email", "fcm_token", "expo_push_token", "device_id", "referral_code", "referred_by"]) {
      expect(PROFILE_PLAN_COLUMNS.split(",")).not.toContain(column);
    }
  });
});
