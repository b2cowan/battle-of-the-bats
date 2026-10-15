/**
 * What a failed sign-in says, by the code `signIn` (`lib/auth.ts`) returns — ONE map for every screen
 * that signs someone in with a password (the sign-in page, and the registration form's own sign-in
 * step since 2026-10-14), so a new code is added once and the two never word one failure two ways.
 * A screen may override a line for its own context (the registration form points "wrong password" at
 * the reset link beneath it) by spreading this map. Framework-free, so it costs a page no auth client.
 */
export const SIGN_IN_ERROR_COPY: Readonly<Record<string, string>> = {
  invalid_credentials: 'Incorrect email or password. Please try again.',
  email_not_confirmed: 'Please verify your email before signing in. Check your inbox for a confirmation link.',
  too_many_requests: 'Too many sign-in attempts. Please wait a moment and try again.',
  user_not_found: 'No account found for this email address.',
  auth_timeout: 'Sign-in is taking too long. Check your connection and try again.',
  network_error: 'Could not reach the auth service. Please try again.',
};

/** The one email shape check for a form and the route behind it — they must accept the same addresses. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value: string): boolean => EMAIL_RE.test(value);
