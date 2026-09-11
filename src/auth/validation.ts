import { isDisposableEmail } from "../shared/disposableEmail";

/** Phone reset-password rule: at least 6 characters and matching confirmation. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  if (password !== confirm) {
    return "Passwords don't match.";
  }
  return null;
}

/** Same client-side rules as the phone's sign-up screen (6+ chars, no disposable domains). */
export function validateSignUp(email: string, password: string, confirm: string): string | null {
  const trimmed = email.trim();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address.";
  }
  if (isDisposableEmail(trimmed)) {
    return "Disposable email addresses are not allowed. Please use a permanent email.";
  }
  return validateNewPassword(password, confirm);
}
