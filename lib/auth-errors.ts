/**
 * What a failed sign-in says, by the code `signIn` (`lib/auth.ts`) returns — ONE map for every screen
 * that signs someone in with a password (the sign-in page, and the registration form's own sign-in
 * step since 2026-10-14), so a new code is added once and the two never word one failure two ways.
 * A screen may override a line for its own context (the registration form points "wrong password" at
 * the reset link beneath it) by spreading this map. Framework-free, so it costs a page no auth client.
 */
export const SIGN_IN_ERROR_COPY: Readonly<Record<string, string>> = {
  // The sign-in page words these two in its own notices (a title and the way forward, The first look 2b, U1 and the
  // waiting account); these lines are the one-sentence form for a screen without them.
  invalid_credentials: 'That email and password don’t match. Try again.',
  email_not_confirmed: 'Confirm your email before signing in. Check your inbox for the link we sent.',
  too_many_requests: 'Too many sign-in attempts. Please wait a moment and try again.',
  user_not_found: 'No account found for this email address.',
  auth_timeout: 'Sign-in is taking too long. Check your connection and try again.',
  network_error: 'Could not reach the auth service. Please try again.',
};

/** What a failed sign-in says when its code is none of the above: never the raw code or the provider's English. */
export const SIGN_IN_ERROR_FALLBACK = 'Sign-in didn’t work. Try again in a moment.';

/** The words for a failed sign-in's code — the map's line, a screen's own override, else the one fallback sentence. */
export const signInErrorCopy = (code: string, overrides?: Readonly<Record<string, string>>): string =>
  overrides?.[code] ?? SIGN_IN_ERROR_COPY[code] ?? SIGN_IN_ERROR_FALLBACK;

/**
 * Why a screen sent someone to sign-in (`/auth/login?reason=…`), so sign-in can say so above its fields (The first
 * look 2b). `expiredLink`: a confirmation link that cannot be used (expired, already used, or broken), from the auth
 * callback or the Continue page (U3); a reset link that cannot be used carries the same reason to the forgot screen
 * instead (U4, `expiredResetLinkHref`). An organization invitation's failed link goes to its own page.
 * `accountExists`: a sign-up handed over an address that already has an account (the 409). A plain redirect carries no
 * reason and shows no notice.
 */
export const SIGN_IN_REASON = {
  expiredLink: 'expired-link',
  accountExists: 'account-exists',
} as const;

/** The sign-up's hand-off to sign-in when the address already has an account (the 409): the address filled, the
 *  destination kept, and the reason, so sign-in says why the person is there (U2). */
export const accountExistsSignInHref = (next: string, email: string): string =>
  `/auth/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}&reason=${SIGN_IN_REASON.accountExists}`;

const expiredLinkHref = (path: string, next: string | null): string =>
  `${path}?reason=${SIGN_IN_REASON.expiredLink}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

/** Where a link that cannot be used sends the person (F09, U3): sign-in with the reason, and where the link was headed
 *  when it said (already checked same-origin by the caller), so a new link from there returns to the same place. */
export const expiredLinkSignInHref = (next: string | null): string => expiredLinkHref('/auth/login', next);

/** Where a reset link that cannot be used sends the person (U4 screen 3): the forgot screen with the same notice, and
 *  the registration the reset started from (already checked by the caller), so the new link returns there too. */
export const expiredResetLinkHref = (next: string | null): string => expiredLinkHref('/auth/forgot-password', next);

/** The one email shape check for a form and the route behind it — they must accept the same addresses. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value: string): boolean => EMAIL_RE.test(value);
