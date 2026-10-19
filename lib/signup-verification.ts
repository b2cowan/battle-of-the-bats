/**
 * VERIFY EVERY SIGN-UP — the one rule for whether a new account proves its email by link before it is used, and the
 * one way the verification email is sent (owner ruling 2026-10-16; hub docs/projects/active/SIGNUP_EMAIL_VERIFICATION_HUB.html).
 *
 * Before it, the org sign-up verified in production while the coach sign-up (start a team, start a league, the coach
 * join page, tournament registration, assistant invites) confirmed any address at once — so anyone could create an
 * account for someone else's email and collect the invitations, team claims and club access later addressed to it.
 *
 * On (production, or REQUIRE_SIGNUP_EMAIL_VERIFICATION=true): an account is created unconfirmed and the person
 * confirms by the emailed link, which signs them in and returns them to `next`. Off (dev by default): instant, as the
 * org sign-up already behaves there. Server-only.
 */
import { signupVerificationHtml, escapeHtml } from './email';
import { sendTransactionalEmail } from './platform-email-templates';
import { safeNextPath } from './safe-redirect';
import { startDoorLinkPath, type StartDoor } from './start-door';

/** Does a new account prove its email by link? One answer for every sign-up route. */
export function shouldRequireEmailVerification(): boolean {
  const explicit = process.env.REQUIRE_SIGNUP_EMAIL_VERIFICATION;
  if (explicit !== undefined) return explicit === 'true';
  return process.env.NODE_ENV === 'production';
}

/**
 * Where the verification link returns to: the caller's own screen when it names one (a same-site relative path) —
 * the tournament registration's resend knows the exact join page that links its registration. When the caller names
 * none (sign-in has no idea where a waiting account was headed), an account made by a start sign-up returns to its
 * door's step 2 (Account-First Sign-up, 2026-10-18); anything else to `fallback`.
 */
export function verificationReturnPath(next: unknown, fallback: string, door?: StartDoor | null): string {
  return safeNextPath(next, door ? startDoorLinkPath(door) : fallback);
}

/** The callback URL a verification link redirects to (it signs the person in, then opens `next`). */
export function verificationRedirect(origin: string, next: string): string {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * Send the verification email for a Supabase action link. The link is wrapped in the confirm page so a mail scanner
 * that opens links can't spend the one-time token. `continueName` (a team or league typed in the form) fills the
 * template's existing "continue setting up …" line; without one it reads "finish creating your account".
 */
export async function sendSignupVerificationEmail(p: {
  to: string;
  origin: string;
  actionLink: string;
  firstName?: string;
  continueName?: string | null;
}): Promise<void> {
  const verifyUrl = `${p.origin}/auth/signup-confirm?link=${encodeURIComponent(p.actionLink)}`;
  const continueName = p.continueName?.trim() ? p.continueName.trim().slice(0, 120) : null;
  await sendTransactionalEmail({
    key: 'signup_verification',
    to: p.to,
    // A customised template escapes its variables itself (lib/email-markup.ts), so it gets the raw name.
    vars: { verifyUrl, orgName: continueName ?? 'your account' },
    defaultSubject: 'Verify your FieldLogicHQ email',
    // Typed by an anonymous form — escaped before it reaches the built-in email's HTML.
    defaultHtml: signupVerificationHtml({
      verifyUrl,
      firstName: p.firstName ? escapeHtml(p.firstName) : undefined,
      orgName: continueName ? escapeHtml(continueName) : null,
    }),
  });
}
