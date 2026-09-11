import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { clearAppStateAndLeave } from "../lib/appState";
import { supabase } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const hadSession = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        hadSession.current = Boolean(data.session);
        setState({ session: data.session, loading: false });
      })
      .catch(() => {
        if (active) {
          setState({ session: null, loading: false });
        }
      });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && hadSession.current) {
        // Revoked/expired refresh token, or sign-out in another tab: drop everything.
        clearAppStateAndLeave();
        return;
      }
      hadSession.current = Boolean(session);
      setState({ session, loading: false });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** For components rendered inside <RequireAuth>, where a session is guaranteed. */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): Session {
  const { session } = useContext(AuthContext);
  if (!session) {
    throw new Error("useSession() used outside an authenticated route");
  }
  return session;
}
