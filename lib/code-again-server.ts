import { createClient } from './supabase-server';
import { FixedWindowRateLimiter } from './rate-limit';
import { backupCodesLeft, redeemBackupCode, verifyAuthenticatorCode } from './two-step-codes';
import type { SessionTwoStep } from './two-step-session';
import type { CodeAgainRefusal } from './code-again';

/**
 * The server half of the ONE "type your code again" window (Board Ready · two-step sign-in, Part 2; words and codes in
 * lib/code-again.ts). Both doors use it: everyone's (`/api/auth/two-step/code-again`) and staff's "sign in again"
 * (`/api/platform-admin/sign-in-again`, which adds its own audit lines and its 10-minute clock). One check, so the two
 * windows can never drift.
 *
 *   - The app's code is checked on the cookie-writing client: the session becomes "password and code" with a new time.
 *     A code already accepted once is refused (the sign-in service would take it twice in its window).
 *   - A backup code (owner call 6, 2026-11-11: the window takes one, staff included) is marked used and records THIS
 *     session, which counts as a fresh proof from then on (lib/two-step-session.ts reads it).
 *   - Ten tries in fifteen minutes per person, codes and backup codes together: a backup code is ~40 bits and the
 *     window is reachable by any signed-in session of the account.
 */

const CHECK_TIMEOUT_MS = 15_000;
const tries = new FixedWindowRateLimiter(15 * 60_000, 10);

export type ProofCheck =
  | { ok: true; via: 'code' | 'backup_code'; left?: number }
  | { ok: false; refusal: CodeAgainRefusal };

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(timer));
}

export async function checkProofAgain(
  state: SessionTwoStep,
  proof: { code?: unknown; backupCode?: unknown },
): Promise<ProofCheck> {
  if (!state.hasFactor) return { ok: false, refusal: 'no_authenticator' };
  if (!tries.take(state.user.id)) return { ok: false, refusal: 'too_many_tries' };
  try {
    if (typeof proof.backupCode === 'string' && proof.backupCode.trim()) {
      if (!state.sessionId) return { ok: false, refusal: 'not_checked' };
      const ok = await withTimeout(redeemBackupCode(state.user.id, state.sessionId, proof.backupCode));
      if (!ok) return { ok: false, refusal: 'wrong_backup_code' };
      // The code is used and this session proven: the count is a courtesy, never a reason to say "not checked".
      let left: number | undefined;
      try { left = await backupCodesLeft(state.user.id); } catch { left = undefined; }
      return { ok: true, via: 'backup_code', left };
    }
    const code = typeof proof.code === 'string' ? proof.code : '';
    const result = await withTimeout(verifyAuthenticatorCode(await createClient(), state.user.id, code));
    if (result.ok) return { ok: true, via: 'code' };
    if (result.reason === 'reused_code') return { ok: false, refusal: 'wrong_code' };
    return { ok: false, refusal: result.reason };
  } catch {
    return { ok: false, refusal: 'not_checked' };
  }
}

/** The HTTP status for each refusal (both doors answer the same). */
export const PROOF_REFUSAL_STATUS: Record<CodeAgainRefusal, number> = {
  wrong_code: 400,
  wrong_backup_code: 400,
  no_authenticator: 409,
  too_many_tries: 429,
  not_checked: 503,
};
