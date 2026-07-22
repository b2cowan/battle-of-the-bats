import { createClient } from './supabase-browser';
import { getCurrentPushEndpoint, detachAccountPushOnSignOut } from './push-client';

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

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  let error: unknown;

  try {
    const supabase = createClient();
    const result = await Promise.race([
      supabase.auth.signInWithPassword({ email, password }),
      timeoutError(),
    ]);
    error = result.error;
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    return { error: message === 'auth_timeout' ? 'auth_timeout' : 'network_error' };
  }

  if (!error) return { error: null };

  const authError = error as { code?: string; message?: string };
  const message = authError.message ?? '';
  const normalized = message.toLowerCase();
  if (authError.code) return { error: authError.code };
  if (normalized.includes('email not confirmed')) return { error: 'email_not_confirmed' };
  if (normalized.includes('invalid login credentials')) return { error: 'invalid_credentials' };
  return { error: message };
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
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

// ── Legacy stubs — kept so any remaining callers compile during the transition ─
// Auth is now handled by middleware + Supabase session cookies.

/** @deprecated Use signIn() instead */
export function login(): boolean { return false; }

/** @deprecated Use signOut() instead */
export function logout(): void {}

/** @deprecated Auth is enforced by middleware */
export function isAuthenticated(): boolean { return false; }
