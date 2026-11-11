import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * THE SERVER'S ONE "WHO IS SIGNED IN" (Board Ready · two-step sign-in, Part 1; plan BOARD_READY_PLAN.md §5 Stage 0a).
 *
 * Every server decision about the signed-in person goes through `getSignedInUser` (or `readSessionTwoStep` where the
 * caller needs the session's two-step facts). Nothing on the server calls `auth.getUser()` itself:
 * `tests/unit/two-step-server-check-guard.test.ts` fails the build when something does, which is the decision point.
 *
 * ⚖ The rule (owner rulings 2026-11-10): a person who has turned two-step on is NOT signed in until this session typed
 * the code, whatever seat they hold, wherever they are. A password alone (a stolen one) opens nothing on the server.
 * The database says the same thing for the few tables a signed-in token can reach directly
 * (`public.session_passed_two_step()`, mig 463): keep the two in step.
 *
 * A session has "passed" when ANY of:
 *   - the person has no authenticator (two-step is off for them);
 *   - the sign-in service marks the session `aal2` (the code was typed in it);
 *   - one of OUR backup codes let this very session through (the service still calls it `aal1`; we recorded its id).
 *
 * Facts from Part 1 Step 0 (proven on dev 2026-11-11): a refresh keeps `aal2` and does NOT move the `amr` `totp`
 * timestamp, so "when the code was last typed" is read from it; `getUser` sees a signed-out session at once (a set-up
 * signs every other session out), so it is called first and the token is decoded only after it passed.
 *
 * No `next/headers` and no service-role client library here: the proxy (which reads the request's own cookies) uses this
 * too, and keeps its bundle light (the club-host lookup's rule, lib/club-host.ts). The one database read goes through the
 * REST door with the service key.
 */

export type SessionTwoStep = {
  user: User;
  /** The sign-in service's level for this session. */
  aal: 'aal1' | 'aal2';
  /** The session's id (the token's `session_id`), which a backup code is recorded against. */
  sessionId: string | null;
  /** The person has a verified authenticator (two-step is on). */
  hasFactor: boolean;
  /** When a code (or one of our backup codes) last proved this session, ms epoch; null = never. */
  provedAt: number | null;
  /** True when a backup code, not the authenticator, is what let this session through. */
  viaBackupCode: boolean;
  /** The session is signed in as far as our server is concerned (see the rule above). */
  passed: boolean;
};

type TokenClaims = {
  sub?: string;
  aal?: string;
  session_id?: string;
  amr?: Array<{ method?: string; timestamp?: number }>;
};

/** The access token's claims. Only ever called on a token `getUser` has just accepted. */
export function decodeAccessTokenClaims(accessToken: string | null | undefined): TokenClaims | null {
  if (!accessToken) return null;
  const part = accessToken.split('.')[1];
  if (!part) return null;
  try {
    // atob + TextDecoder, not Buffer: runs the same in the proxy and on the server.
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const json = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    return JSON.parse(json) as TokenClaims;
  } catch {
    return null;
  }
}

/** When the authenticator code was last typed in this session (the `amr` `totp` entry), ms epoch; null = never. */
export function codeTypedAt(claims: TokenClaims | null): number | null {
  const entries = (claims?.amr ?? []).filter(e => e?.method === 'totp' && typeof e.timestamp === 'number');
  if (entries.length === 0) return null;
  return Math.max(...entries.map(e => e.timestamp as number)) * 1000;
}

export function hasVerifiedFactor(user: Pick<User, 'factors'> | null | undefined): boolean {
  return (user?.factors ?? []).some(f => f.status === 'verified');
}

/** When one of OUR backup codes let this session through, ms epoch; null = none did. */
async function backupCodeProvedAt(userId: string, sessionId: string | null): Promise<number | null> {
  if (!sessionId) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const uuid = /^[0-9a-f-]{36}$/i;
  // Fails CLOSED: an unreadable record is "no backup code let it through", so the person is asked for a code again.
  if (!url || !key || !uuid.test(userId) || !uuid.test(sessionId)) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/two_step_backup_codes?select=used_at&user_id=eq.${userId}&used_session_id=eq.${sessionId}&order=used_at.desc&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(2500) },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ used_at: string | null }>;
    const at = rows[0]?.used_at ? Date.parse(rows[0].used_at) : NaN;
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

/**
 * The session's two-step facts, or null when nobody is signed in. Calls `getUser` (the sign-in service checks the token),
 * then reads the same session's token for its level and methods.
 */
export async function readSessionTwoStep(supabase: SupabaseClient): Promise<SessionTwoStep | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  const claims = decodeAccessTokenClaims(session?.access_token);
  // The token must be the user's own: a mismatch reads as "not signed in", never as somebody else.
  if (!claims || claims.sub !== user.id) return null;

  const aal = claims.aal === 'aal2' ? 'aal2' : 'aal1';
  // Two-step is ON for a person with a verified authenticator, and also while they are replacing a lost phone (their
  // old authenticator removed, the new one not finished): a stolen password must not find a gap there either.
  const hasFactor = hasVerifiedFactor(user) || isReplacingAuthenticator(user);
  const sessionId = typeof claims.session_id === 'string' ? claims.session_id : null;
  const typedAt = aal === 'aal2' ? codeTypedAt(claims) : null;

  // Our backup codes: read when they can matter — a session the service calls password-only, or one whose last code is
  // older than the shortest window anything asks for (a backup code typed at a re-ask must count; /review 2026-11-11).
  let backupAt: number | null = null;
  if (hasFactor && (aal === 'aal1' || typedAt === null || Date.now() - typedAt > BACKUP_READ_AFTER_MS)) {
    backupAt = await backupCodeProvedAt(user.id, sessionId);
  }

  const passed = !hasFactor || aal === 'aal2' || backupAt !== null;
  const provedAt = typedAt === null ? backupAt : backupAt === null ? typedAt : Math.max(typedAt, backupAt);
  const viaBackupCode = backupAt !== null && (typedAt === null || backupAt > typedAt);
  return { user, aal, sessionId, hasFactor, provedAt, viaBackupCode, passed };
}

/** A code typed within this long needs no backup-code read: nothing asks for a fresher proof than 15 minutes. */
const BACKUP_READ_AFTER_MS = 15 * 60_000;

/**
 * Replacing a lost phone (tab 3, "Set up my new phone"): the sign-in service will not set up a second authenticator for a
 * session it calls password-only, so the old one is removed first. Until the new one is verified, this mark on the
 * account (app_metadata, which only the service role writes) keeps two-step ON: the person signs in with a backup code.
 */
export const REPLACING_AUTHENTICATOR_FLAG = 'two_step_replacing';
export function isReplacingAuthenticator(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return (user?.app_metadata as Record<string, unknown> | undefined)?.[REPLACING_AUTHENTICATOR_FLAG] === true;
}

/** The signed-in person, or null — null too when two-step is on and this session has not typed the code. */
export async function getSignedInUser(supabase: SupabaseClient): Promise<User | null> {
  const state = await readSessionTwoStep(supabase);
  return state?.passed ? state.user : null;
}

/** A code (or a backup code) proved this session within the last `minutes`. Part 2 wires it to five actions. */
export function provedWithin(state: Pick<SessionTwoStep, 'provedAt' | 'passed'> | null, minutes: number, now = Date.now()): boolean {
  if (!state?.passed || state.provedAt === null) return false;
  return now - state.provedAt <= minutes * 60_000;
}
