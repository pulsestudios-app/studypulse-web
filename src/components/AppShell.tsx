import { useEffect } from "react";
import { NavLink, Outlet } from "react-router";

import { useSession } from "../auth/AuthProvider";
import { clearNextPath, markRecoverySession } from "../auth/session";
import { identifyUser, trackSessionStarted } from "../lib/analytics";
import { signOut } from "../lib/appState";
import { PlanBadge } from "../profile/PlanBadge";
import { useProfile } from "../profile/useProfile";
import { COPY } from "../results/copy";
import { useDueCount } from "../review/useDueCount";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function AppShell() {
  const session = useSession();
  const userId = session.user.id;
  const { profile, summary, isLoading } = useProfile(userId);
  const due = useDueCount(userId);
  const dueCount = due.data ?? 0;

  useEffect(() => {
    // The user reached the app: any stored post-sign-in destination / recovery marker is spent.
    clearNextPath();
    markRecoverySession(false);
    trackSessionStarted();
  }, []);

  useEffect(() => {
    if (profile !== undefined) {
      identifyUser(userId, profile, session.user.created_at);
    }
  }, [profile, userId, session.user.created_at]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/library" className="app-brand" aria-label="StudyPulse library">
            <Logo />
          </NavLink>
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/library" className="app-nav-link">
              <Icon name="library" size={18} />
              <span>Library</span>
            </NavLink>
            <NavLink to="/review" className="app-nav-link">
              <Icon name="cards" size={18} />
              <span>Review</span>
              {dueCount > 0 ? <span className="due-badge">{COPY.review.due(dueCount)}</span> : null}
            </NavLink>
            <NavLink to="/settings" className="app-nav-link">
              <Icon name="settings" size={18} />
              <span>Settings</span>
            </NavLink>
          </nav>
          <div className="app-header-right">
            <PlanBadge summary={summary} loading={isLoading} />
            <button type="button" className="btn btn-small app-signout" onClick={() => void signOut()} title="Sign out">
              <Icon name="logout" size={18} />
              <span className="app-signout-label">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
