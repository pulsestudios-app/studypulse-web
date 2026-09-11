import { Navigate, Outlet, useLocation } from "react-router";

import { FullScreenSpinner } from "../components/FullScreenSpinner";
import { useAuth } from "./AuthProvider";
import { peekNextPath, rememberNextPath } from "./session";

/** Everything outside /auth requires a session; remember where the user was headed. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <FullScreenSpinner />;
  }
  if (!session) {
    rememberNextPath(`${location.pathname}${location.search}`);
    return <Navigate to="/auth/sign-in" replace />;
  }
  return <Outlet />;
}

/** Sign-in / sign-up are pointless with a session; send the user on to their destination. */
export function RedirectIfAuthed() {
  const { session, loading } = useAuth();
  if (loading) {
    return <FullScreenSpinner />;
  }
  if (session) {
    return <Navigate to={peekNextPath()} replace />;
  }
  return <Outlet />;
}
