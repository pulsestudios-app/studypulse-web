// Copied from pulsestudios-app/StudyPulse@700c3d8 (launch-ota): src/features/auth/disposableEmail.ts
// Keep in sync manually — no monorepo coupling. Changes vs source: none.

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "33mail.com",
  "dispostable.com",
  "fakeinbox.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "maildrop.cc",
  "mailinator.com",
  "mohmal.com",
  "sharklasers.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

export function getDisposableEmailDomain(email: string): string | null {
  const domain = email.trim().toLowerCase().split("@").pop()?.replace(/\.+$/, "") ?? "";
  if (!domain) {
    return null;
  }
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain === blocked || domain.endsWith(`.${blocked}`)) {
      return blocked;
    }
  }
  return null;
}

export function isDisposableEmail(email: string): boolean {
  return getDisposableEmailDomain(email) != null;
}
