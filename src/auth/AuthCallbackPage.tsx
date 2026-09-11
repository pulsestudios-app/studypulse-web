import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { FullScreenSpinner } from "../components/FullScreenSpinner";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { trackEvent } from "../lib/analytics";
import { AuthLayout, FormNotice } from "./AuthLayout";
import { authCallbackErrorMessage, exchangeErrorMessage, parseAuthCallback } from "./callback";
import { exchangeCodeOnce, peekNextPath, takePendingSignInMethod } from "./session";

/** Landing page for Google OAuth and sign-up email confirmation (PKCE `?code=`). */
export function AuthCallbackPage() {
  useDocumentTitle("Signing in");
  const navigate = useNavigate();
  const [callback] = useState(() => parseAuthCallback(window.location.href));
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  useEffect(() => {
    if (callback.kind === "error") {
      takePendingSignInMethod();
      return;
    }
    if (callback.kind !== "code") {
      return;
    }
    let active = true;
    exchangeCodeOnce(callback.code)
      .then(() => {
        if (!active) {
          return;
        }
        trackEvent("web_sign_in", { method: takePendingSignInMethod() ?? "email_link" });
        navigate(peekNextPath(), { replace: true });
      })
      .catch((error: unknown) => {
        if (active) {
          setExchangeError(exchangeErrorMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, [callback, navigate]);

  if (callback.kind === "none") {
    return <Navigate to="/auth/sign-in" replace />;
  }
  const error = callback.kind === "error" ? authCallbackErrorMessage(callback.code) : exchangeError;
  if (!error) {
    return <FullScreenSpinner label="Signing you in" />;
  }
  return (
    <AuthLayout title="Sign-in didn't complete">
      <FormNotice tone="error">{error}</FormNotice>
      <Link to="/auth/sign-in" className="btn btn-primary btn-block">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
