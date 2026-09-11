import { useState, type FormEvent } from "react";
import { Link } from "react-router";

import { Icon } from "../components/Icon";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { supabase } from "../lib/supabase";
import { AuthLayout, FormNotice } from "./AuthLayout";
import { authRedirectUrl, setPendingSignInMethod } from "./session";
import { validateSignUp } from "./validation";

export function SignUpPage() {
  useDocumentTitle("Create account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validateSignUp(email, password, confirm);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    setPendingSignInMethod("email_link");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: authRedirectUrl("/auth/callback") },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.code === "weak_password" ? signUpError.message : "Couldn't create your account. Please try again.");
      return;
    }
    if (!data.session) {
      // Email confirmation required (also returned for already-registered emails, by design).
      setSent(true);
    }
  }

  async function onGoogle() {
    setPendingSignInMethod("google");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectUrl("/auth/callback") },
    });
    if (oauthError) {
      setError("Couldn't start Google sign-in. Please try again.");
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a confirmation link to finish creating your account.">
        <FormNotice tone="info">
          Open the link in this browser to sign in. It can take a minute to arrive — check spam if you don't see it.
        </FormNotice>
        <div className="auth-links type-caption">
          <Link to="/auth/sign-in">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle="Use the same account on the web and on your phone.">
      <button type="button" className="btn btn-block" onClick={onGoogle}>
        <Icon name="google" size={18} />
        Continue with Google
      </button>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Confirm password</span>
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
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <div className="auth-links type-caption">
        <span className="text-secondary">
          Already have an account? <Link to="/auth/sign-in">Sign in</Link>
        </span>
      </div>
    </AuthLayout>
  );
}
