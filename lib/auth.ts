import { createClient } from './supabase-browser';
import { getCurrentPushEndpoint, detachAccountPushOnSignOut } from './push-client';
import { clearConsoleRecent } from './console-recent';
import { browserDraftStore, clearAllDrafts } from './bank-check-draft';
import { twoStepStepUrl } from './two-step-paths';

const AUTH_TIMEOUT_MS = 15000;

function timeoutError() {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('auth_timeout')), AUTH_TIMEOUT_MS);
  });
}

/** Resolve `p`, but never wait longer than `ms` — falling back to `fallback` (used to time-box the
 *  best-effort push teardown so a dead network can't stall sign-out). */
function raceTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>(resolve => window.setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * What a password sign-in answered.
 *   - `error`: the failure's code (null on success).
 *   - `needsCode`: the password matched and this account has two-step on, so the code comes next. Only with
 *     `codeStep: 'here'` (the shared sign-in page shows the step itself).
 *   - `handedOff`: same, and the browser is already on its way to the shared code step. The caller stops: whatever it
 *     meant to do next would be refused until the code is typed, and the code step returns the person to `next`.
 */
export type SignInResult = { error: string | null; needsCode?: boolean; handedOff?: boolean };

/**
 * THE ONE PASSWORD SIGN-IN in the browser (twelve doors call it). ⚖ Two-step sign-in (Board Ready, Part 1, tab 3): when
 * the account has two-step on, the password alone is not a sign-in. Every door hands off to the code step on the one
 * shared sign-in page rather than growing a code field of its own; `next` (default: this page) is where the person
 * returns after the code. The server refuses the password-only session meanwhile (lib/two-step-session.ts).
 */
export async function signIn(
  email: string,
  password: string,
  opts: { codeStep?: 'here'; next?: string } = {},
): Promise<SignInResult> {
  let error: unknown;
  const supabase = createClient();

  try {
    const result = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeoutError(),
    ]);
    error = result.error;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    return { error: message === 'auth_timeout' ? 'auth_timeout' : 'network_error' };
  }

  if (!error) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Also an account replacing a lost phone (its old authenticator gone, the new one not finished): two-step stays on, and
    // the code step's backup code is the way in (lib/two-step-session.ts, REPLACING_AUTHENTICATOR_FLAG).
    const { data: { session } } = await supabase.auth.getSession();
    const replacing = (session?.user?.app_metadata as Record<string, unknown> | undefined)?.two_step_replacing === true;
    if ((level?.currentLevel === 'aal1' && level.nextLevel === 'aal2') || replacing) {
      if (opts.codeStep === 'here') return { error: null, needsCode: true };
      const back = opts.next ?? `${window.location.pathname}${window.location.search}`;
      window.location.assign(twoStepStepUrl('code', back));
      return { error: null, handedOff: true };
    }
    return { error: null };
  }

  const authError = error as { code?: string; message?: string };
  const message = authError.message ?? '';
  const normalized = message.toLowerCase();
  // Supabase names its rate limit `over_request_rate_limit`; every sign-in screen words it as `too_many_requests`.
  if (authError.code === 'over_request_rate_limit') return { error: 'too_many_requests' };
  if (authError.code) return { error: authError.code };
  if (normalized.includes('email not confirmed')) return { error: 'email_not_confirmed' };
  if (normalized.includes('invalid login credentials')) return { error: 'invalid_credentials' };
  return { error: message };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  // The support console's Find keeps the last records opened in this browser; whichever door a staff member signs out
  // through, a shared computer must not show them to the next person (Support console Stage 2, threat T8). A no-op in a
  // browser that never opened the console.
  clearConsoleRecent();
  // The bank check's working drafts (a statement balance typed, lines marked) are the signed-in person's: a shared
  // computer starts the next person on an empty card (Bank check working draft WD1). A no-op where none was kept.
  clearAllDrafts(browserDraftStore());
  // WI-6: stop this device's ACCOUNT push BEFORE the session is destroyed — the unsubscribe API
  // authorizes the delete off the still-live session, so this can't ride the SIGNED_OUT event
  // (session's already gone there; that pattern fits follows, which are local). Best-effort +
  // time-boxed so a dead network never blocks sign-out. Touches ONLY the account push_subscriptions
  // row for this endpoint — never the legacy anonymous fan-alert delivery rows.
  try {
    const endpoint = await raceTimeout(getCurrentPushEndpoint(), 2000, null);
    if (endpoint) {
      // Server-only detach (NOT removePushDevice) — must not locally unsubscribe the shared browser
      // subscription that anonymous fan alerts also use. The DELETE is scoped to this account's row,
      // so even if it's abandoned by the timeout and lands late, it can't clobber a later sign-in.
      await raceTimeout(detachAccountPushOnSignOut(endpoint).catch(() => {}), 3000, undefined);
    }
  } catch {
    // Push teardown is best-effort; a leftover server row is 410-pruned or re-pointed on next sign-in.
  }
  await supabase.auth.signOut();
  // Shared-device follow hygiene (clear account-owned follows + restore parked
  // anonymous pins) runs off the SIGNED_OUT auth event in lib/follow.ts, so every
  // sign-out path is covered without this wrapper depending on the follow layer.
}

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
