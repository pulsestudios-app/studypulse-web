import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";

import { FullScreenSpinner } from "../components/FullScreenSpinner";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthProvider";
import { AuthLayout, FormNotice } from "./AuthLayout";
import { authCallbackErrorMessage, exchangeErrorMessage, parseAuthCallback } from "./callback";
import { authRedirectUrl, exchangeCodeOnce, isRecoverySession, markRecoverySession } from "./session";
import { validateNewPassword } from "./validation";

type Mode = "checking" | "request" | "set" | "done";

/**
 * Two-step reset on one route:
 *  - no code: request form → resetPasswordForEmail(redirectTo /auth/reset)
 *  - ?code=…: exchange (PKCE verifier must be in this browser) → new-password form → updateUser
 */
export function ResetPasswordPage() {
  useDocumentTitle("Reset password");
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [link] = useState(() => parseAuthCallback(window.location.href));
  const [exchange, setExchange] = useState<"none" | "pending" | "ok" | "failed">(
    link.kind === "code" ? "pending" : "none",
  );
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (link.kind === "error") {
      navigate("/auth/reset", { replace: true });
      return;
    }
    if (link.kind !== "code") {
      return;
    }
    let active = true;
    exchangeCodeOnce(link.code)
      .then(() => {
        markRecoverySession(true);
        if (active) {
          setExchange("ok");
          navigate("/auth/reset", { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setExchangeError(exchangeErrorMessage(error));
          setExchange("failed");
          navigate("/auth/reset", { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [link, navigate]);

  const linkError = link.kind === "error" ? authCallbackErrorMessage(link.code) : exchangeError;
  let mode: Mode;
  if (done) {
    mode = "done";
  } else if (exchange === "pending") {
    mode = "checking";
  } else if (exchange === "ok") {
    mode = "set";
  } else if (exchange === "failed" || link.kind === "error") {
    mode = "request";
  } else if (loading) {
    mode = "checking";
  } else {
    // A reload after a successful exchange keeps the set-password form.
    mode = session && isRecoverySession() ? "set" : "request";
  }

  if (mode === "checking") {
    return <FullScreenSpinner label="Checking your reset link" />;
  }
  if (mode === "set") {
    return <SetPasswordForm onDone={() => setDone(true)} />;
  }
  if (mode === "done") {
    return (
      <AuthLayout title="Password updated" subtitle="You're signed in with your new password.">
        <Link to="/library" className="btn btn-primary btn-block">
          Go to your library
        </Link>
      </AuthLayout>
    );
  }
  return <RequestResetForm linkError={linkError} />;
}

function RequestResetForm({ linkError }: { linkError: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirectUrl("/auth/reset"),
    });
    setBusy(false);
    if (resetError && resetError.status === 429) {
      setError("Too many requests. Please wait a minute and try again.");
      return;
    }
    // Same message whether or not the account exists.
    setSent(true);
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new password.">
      {linkError ? <FormNotice tone="error">{linkError}</FormNotice> : null}
      {sent ? (
        <FormNotice tone="success">
          If an account exists for that email, a reset link is on its way. Open it in this browser.
        </FormNotice>
      ) : (
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <div className="auth-links type-caption">
        <Link to="/auth/sign-in">Back to sign in</Link>
      </div>
    </AuthLayout>
  );
}

function SetPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateNewPassword(password, confirm);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(
        updateError.code === "same_password"
          ? "Choose a password different from your current one."
          : updateError.code === "weak_password"
            ? updateError.message
            : "Couldn't update your password. Please request a new link.",
      );
      return;
    }
    markRecoverySession(false);
    onDone();
  }

  return (
    <AuthLayout title="Choose a new password">
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span className="field-label">New password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Confirm new password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthLayout>
  );
}
