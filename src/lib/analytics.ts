import posthog from "posthog-js";

import { cleanProperties, type AnalyticsProperties } from "../shared/analyticsPrivacy";
import { getEffectivePlan, isOnTrial, type ProfileRecord } from "../shared/profilePlan";
import { config } from "./config";
import { sanitizePostHogEvent } from "./privacy";
import { ANALYTICS_OPT_OUT_KEY, readStorage, STORAGE_PREFIX, writeStorage } from "./storage";

/** Web-only events plus the phone's event names reused where the action is the same. */
export type WebAnalyticsEvent = "web_session_started" | "web_sign_in" | "chat_message_sent" | "share_created";
export type WebSignInMethod = "password" | "google" | "email_link";

const SESSION_STARTED_KEY = `${STORAGE_PREFIX}analytics.sessionStarted`;
const PLACEHOLDER_KEY = "phc_STUDYPULSE_PLACEHOLDER";

let initialized = false;

function localStore(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function sessionStore(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.sessionStorage;
}

function isConfiguredKey(key: string): boolean {
  return Boolean(key && key !== PLACEHOLDER_KEY && !key.toLowerCase().includes("your_"));
}

export function isAnalyticsOptedOut(): boolean {
  return readStorage(localStore(), ANALYTICS_OPT_OUT_KEY) === "true";
}

/**
 * PostHog with the phone's posture: no autocapture, no pageviews, no replay,
 * identified-only person profiles, same property denylist. Web additions: URL
 * sanitizing in before_send, no remote config/flags (so project settings can't
 * switch capture features on), no external script loading, DNT respected.
 */
export function initAnalytics(): void {
  if (initialized || !isConfiguredKey(config.posthogKey) || isAnalyticsOptedOut()) {
    return;
  }
  posthog.init(config.posthogKey, {
    api_host: config.posthogHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    rageclick: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    disable_external_dependency_loading: true,
    advanced_disable_flags: true,
    person_profiles: "identified_only",
    persistence: "localStorage",
    save_referrer: false,
    respect_dnt: true,
    mask_personal_data_properties: true,
    before_send: sanitizePostHogEvent,
  });
  posthog.register({ platform: "web" });
  initialized = true;
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  writeStorage(localStore(), ANALYTICS_OPT_OUT_KEY, optedOut ? "true" : "false");
  if (optedOut) {
    if (initialized) {
      posthog.opt_out_capturing();
    }
    return;
  }
  if (initialized) {
    posthog.opt_in_capturing({ captureEventName: false });
  } else {
    initAnalytics();
  }
}

export function trackEvent(event: WebAnalyticsEvent, properties?: AnalyticsProperties): void {
  if (!initialized || isAnalyticsOptedOut()) {
    return;
  }
  try {
    posthog.capture(event, cleanProperties(properties));
  } catch {
    // Analytics must never break the app.
  }
}

/** Once per browser tab session (sessionStorage is cleared on sign-out). */
export function trackSessionStarted(): void {
  const store = sessionStore();
  if (readStorage(store, SESSION_STARTED_KEY) === "true") {
    return;
  }
  writeStorage(store, SESSION_STARTED_KEY, "true");
  trackEvent("web_session_started");
}

function daysSince(dateIso?: string | null): number {
  if (!dateIso) {
    return 0;
  }
  const started = new Date(dateIso).getTime();
  if (!Number.isFinite(started)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - started) / (24 * 60 * 60 * 1000)));
}

/** Same identity + person properties as the phone's syncAnalyticsUserProperties (no email, ever). */
export function identifyUser(userId: string, profile: ProfileRecord, signupDateIso?: string | null): void {
  if (!initialized || !userId || isAnalyticsOptedOut()) {
    return;
  }
  const signupDate = signupDateIso ? new Date(signupDateIso) : null;
  const signupDateValue =
    signupDate && Number.isFinite(signupDate.getTime()) ? signupDate.toISOString().slice(0, 10) : null;
  const clean = cleanProperties({
    plan_tier: getEffectivePlan(profile),
    trial_status: isOnTrial(profile) ? "active" : "inactive",
    signup_date: signupDateValue,
    days_active: daysSince(signupDateIso),
  });
  try {
    if (posthog.get_distinct_id() !== userId) {
      posthog.identify(userId, clean);
    } else {
      posthog.setPersonProperties(clean);
    }
  } catch {
    // ignore
  }
}

export function resetAnalytics(): void {
  if (!initialized) {
    return;
  }
  try {
    posthog.reset();
  } catch {
    // ignore
  }
}
