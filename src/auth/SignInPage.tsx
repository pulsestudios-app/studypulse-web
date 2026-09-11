import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Icon } from "../components/Icon";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { trackEvent } from "../lib/analytics";
import { supabase } from "../lib/supabase";
import { AuthLayout, FormNotice } from "./AuthLayout";
import { authRedirectUrl, setPendingSignInMethod } from "./session";

export function SignInPage() {
  useDocumentTitle("Sign in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy("password");
    setError(null);
    setNeedsConfirmation(false);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(null);
    if (signInError) {
      if (signInError.code === "email_not_confirmed") {
        setNeedsConfirmation(true);
        setError("Please confirm your email first — check your inbox for the link.");
      } else if (signInError.code === "invalid_credentials") {
        setError("Incorrect email or password.");
      } else {
        setError("Couldn't sign in. Please try again.");
      }
      return;
    }
    trackEvent("web_sign_in", { method: "password" });
    // RedirectIfAuthed navigates once the session lands in AuthProvider.
  }

  async function onGoogle() {
    setBusy("google");
    setError(null);
    setPendingSignInMethod("google");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectUrl("/auth/callback") },
    });
    if (oauthError) {
      setBusy(null);
      setError("Couldn't start Google sign-in. Please try again.");
    }
    // On success the browser is redirected to Google.
  }

  async function onResend() {
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: authRedirectUrl("/auth/callback") },
    });
    if (!resendError) {
      setResent(true);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to see your StudyPulse library.">
      <button type="button" className="btn btn-block" onClick={onGoogle} disabled={busy !== null}>
        <Icon name="google" size={18} />
        {busy === "google" ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        {needsConfirmation && !resent ? (
          <button type="button" className="btn btn-small" onClick={onResend}>
            Resend confirmation email
          </button>
        ) : null}
        {resent ? <FormNotice tone="success">Confirmation email sent.</FormNotice> : null}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy !== null}>
          {busy === "password" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="auth-links type-caption">
        <Link to="/auth/reset">Forgot password?</Link>
        <span className="text-secondary">
          New here? <Link to="/auth/sign-up">Create an account</Link>
        </span>
      </div>
    </AuthLayout>
  );
}
