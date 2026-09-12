import { useState } from "react";

import { useSession } from "../auth/AuthProvider";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "../lib/analytics";
import { clearAppStateAndLeave, signOut } from "../lib/appState";
import { supabase } from "../lib/supabase";
import { useProfile } from "../profile/useProfile";
import { COPY } from "../results/copy";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { SharedLinksSection } from "./SharedLinksSection";
import { TrashSection } from "./TrashSection";

export function SettingsPage() {
  useDocumentTitle("Settings");
  const session = useSession();
  const { summary, isLoading, isError, refetch } = useProfile(session.user.id);
  const [analyticsOn, setAnalyticsOn] = useState(() => !isAnalyticsOptedOut());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  function onToggleAnalytics(next: boolean) {
    setAnalyticsOptOut(!next);
    setAnalyticsOn(next);
  }

  async function signOutEverywhere() {
    setSigningOutAll(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // Local state is cleared regardless.
    }
    clearAppStateAndLeave();
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
        <div className="row-actions">
          <button type="button" className="btn btn-small" onClick={() => void signOut()}>
            Sign out of this browser
          </button>
          <button type="button" className="btn btn-small" onClick={() => void signOutEverywhere()} disabled={signingOutAll}>
            {COPY.account.signOutEverywhere}
          </button>
        </div>
        <p className="type-caption text-secondary settings-hint">{COPY.account.signOutEverywhereHint}</p>
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
              <strong>Manage on your phone.</strong> Upgrades, cancellations and restores happen in the StudyPulse app (App Store or Google
              Play). Changes show up here automatically.
            </p>
          </>
        )}
      </section>

      <SharedLinksSection />
      <TrashSection />

      <section className="card settings-section" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className="settings-heading">
          Privacy
        </h2>
        <label className="settings-toggle">
          <input type="checkbox" checked={analyticsOn} onChange={(event) => onToggleAnalytics(event.target.checked)} />
          <span>
            <span className="settings-value">Share product analytics</span>
            <span className="type-caption text-secondary settings-toggle-help">Only anonymous usage events; no email or name. Saved for this browser.</span>
          </span>
        </label>
      </section>

      <section className="card settings-section settings-danger" aria-labelledby="settings-danger">
        <h2 id="settings-danger" className="settings-heading">
          Danger zone
        </h2>
        <p className="type-caption text-secondary settings-hint">{COPY.account.deleteBody}</p>
        <button type="button" className="btn btn-small btn-destructive" onClick={() => setDeleteOpen(true)}>
          {COPY.account.deleteAccount}
        </button>
      </section>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </div>
  );
}
