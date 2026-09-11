import { useState } from "react";

import { useSession } from "../auth/AuthProvider";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "../lib/analytics";
import { signOut } from "../lib/appState";
import { useProfile } from "../profile/useProfile";

export function SettingsPage() {
  useDocumentTitle("Settings");
  const session = useSession();
  const { summary, isLoading, isError, refetch } = useProfile(session.user.id);
  const [analyticsOn, setAnalyticsOn] = useState(() => !isAnalyticsOptedOut());

  function onToggleAnalytics(next: boolean) {
    setAnalyticsOptOut(!next);
    setAnalyticsOn(next);
  }

  return (
    <div className="settings">
      <h1 className="type-header">Settings</h1>

      <section className="card settings-section" aria-labelledby="settings-account">
        <h2 id="settings-account" className="settings-heading">
          Account
        </h2>
        <div className="settings-row">
          <span className="text-secondary">Signed in as</span>
          <span className="settings-value">{session.user.email ?? "—"}</span>
        </div>
        <button type="button" className="btn btn-danger" onClick={() => void signOut()}>
          Sign out of this browser
        </button>
      </section>

      <section className="card settings-section" aria-labelledby="settings-plan">
        <h2 id="settings-plan" className="settings-heading">
          Plan
        </h2>
        {isLoading ? (
          <div className="skeleton skeleton-line" aria-hidden="true" />
        ) : isError || !summary ? (
          <div className="notice notice-error" role="alert">
            Couldn't load your plan.{" "}
            <button type="button" className="btn btn-small" onClick={refetch}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="settings-row">
              <span className="text-secondary">Current plan</span>
              <span className="settings-value">{summary.label}</span>
            </div>
            {summary.trialDaysLeft !== null ? (
              <div className="settings-row">
                <span className="text-secondary">Trial</span>
                <span className="settings-value">
                  {summary.trialDaysLeft} day{summary.trialDaysLeft === 1 ? "" : "s"} left
                </span>
              </div>
            ) : null}
            <div className="settings-row">
              <span className="text-secondary">Usage</span>
              <span className="settings-value">{summary.usageLine}</span>
            </div>
            {!summary.unlimited ? (
              <div className="settings-row">
                <span className="text-secondary">Resets</span>
                <span className="settings-value">{summary.resetsOn}</span>
              </div>
            ) : null}
            <p className="notice settings-manage">
              <strong>Manage on your phone.</strong> Upgrades, cancellations and restores happen in the StudyPulse app
              (App Store or Google Play). Changes show up here automatically.
            </p>
          </>
        )}
      </section>

      <section className="card settings-section" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className="settings-heading">
          Privacy
        </h2>
        <label className="settings-toggle">
          <input type="checkbox" checked={analyticsOn} onChange={(event) => onToggleAnalytics(event.target.checked)} />
          <span>
            <span className="settings-value">Share anonymous usage analytics</span>
            <span className="type-caption text-secondary settings-toggle-help">
              Helps us improve StudyPulse. Never includes your content, titles or email. Saved for this browser.
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
