/**
 * THE ACCOUNT STEP OF A TOURNAMENT REGISTRATION MADE SIGNED OUT (Signed-in family accounts Stage 2, Part 4). Server-only.
 *
 * On the live site a new coach's account waits for its email (VERIFY EVERY SIGN-UP, lib/signup-verification.ts). The
 * form used to post the registration and then call the coach sign-up, and each sent its own email. Now `/api/register`
 * runs this step itself, AFTER the entry is filed and the organizer's alert is on its way (the organizer never waits on
 * the coach's inbox), so the coach's one email can carry the confirm link. One request, so no email is ever left
 * waiting on a second call that a closed tab or a lost signal never makes.
 *
 * It never throws and never refuses the registration: the entry is already in. Anything that goes wrong is `failed`,
 * and the coach still gets the registration email, whose "Open your Coaches Portal" sets an account up.
 *
 * The same rules as the coach sign-up's verify branch (app/api/auth/coach-signup/route.ts): an existing account is
 * looked up FIRST (a signup link generated over it would overwrite its password); one still waiting gets a MAGIC link,
 * as "Send the link again" sends (it confirms the email and keeps the password); the sign-up's own budget, shared.
 */
import { supabaseAdmin } from './supabase-admin';
import { findAuthUserByEmail } from './auth-account-lookup';
import { captureError } from './observability';
import { takeCoachSignupBudget, verificationRedirect } from './signup-verification';
import type { RegistrationAccountOutcome } from './registration-email-plan';

export type RegistrationAccount = {
  outcome: Exclude<RegistrationAccountOutcome, 'none'>;
  /** The Supabase action link the coach's email confirms with, when one was made. */
  actionLink: string | null;
  /** The account this step made (`created` only) — the registration records its Terms tick against it (step 6.3). */
  userId?: string | null;
};

const FAILED: RegistrationAccount = { outcome: 'failed', actionLink: null };

export async function openRegistrationAccount(p: {
  ip: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  origin: string;
  /** Where the confirm link returns (registrationPortalPath). */
  next: string;
}): Promise<RegistrationAccount> {
  // The form checks these before it posts; a request without them gets no account, not a refusal.
  if (p.password.length < 8 || !p.firstName || !p.lastName) return FAILED;
  // No mail service, no confirm email: never make an account that waits for an email that cannot go (the coach
  // sign-up refuses the same way). /review 2026-11-01.
  if (!process.env.RESEND_API_KEY) {
    await captureError(new Error('Registration account step needs verification but RESEND_API_KEY is not configured'), {
      statusCode: 500, user: { email: p.email }, requestContext: { operation: 'register account step' },
    });
    return FAILED;
  }
  if (!takeCoachSignupBudget(p.ip, p.email)) {
    console.warn(`[register] rate-limited account step ip=${p.ip}`);
    return FAILED;
  }
  const redirectTo = verificationRedirect(p.origin, p.next);
  try {
    const existing = await findAuthUserByEmail(p.email);
    if (existing) {
      if (existing.email_confirmed_at) return { outcome: 'exists', actionLink: null };
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: p.email, options: { redirectTo } });
      if (error || !data?.properties?.action_link) {
        await captureError(error ?? new Error('generateLink returned no action link'), {
          statusCode: 500, user: { email: p.email }, requestContext: { operation: 'supabaseAdmin.auth.admin.generateLink(magiclink)' },
        });
        return { outcome: 'exists', actionLink: null };
      }
      return { outcome: 'exists', actionLink: data.properties.action_link };
    }

    // Name parity with the coach sign-up: the same four fields on the auth user.
    const fullName = `${p.firstName} ${p.lastName}`.trim();
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: p.email,
      password: p.password,
      options: {
        data: { first_name: p.firstName, last_name: p.lastName, full_name: fullName, display_name: fullName },
        redirectTo,
      },
    });
    if (error || !data?.properties?.action_link) {
      // Made between the lookup and here: answer it as an account that exists, with no link of ours over it.
      if (error?.status === 422) return { outcome: 'exists', actionLink: null };
      await captureError(error ?? new Error('generateLink returned no action link'), {
        statusCode: 500, user: { email: p.email },
        requestContext: { operation: 'supabaseAdmin.auth.admin.generateLink(signup)', supabaseStatus: error?.status ?? null },
      });
      return FAILED;
    }
    return { outcome: 'created', actionLink: data.properties.action_link, userId: data.user?.id ?? null };
  } catch (err) {
    await captureError(err, { statusCode: 500, user: { email: p.email }, requestContext: { operation: 'register account step' } });
    return FAILED;
  }
}
