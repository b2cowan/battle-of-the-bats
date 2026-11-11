import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase-admin';

/**
 * BACKUP CODES and ONE-TIME CODE CHECKS (Board Ready · two-step sign-in, Part 1; drawings tab 2 and tab 3).
 *
 * Backup codes are OURS, not the sign-in service's (its recovery codes are still "experimental"). Ten per person, shown
 * once, used once, stored only as one-way hashes (sha-256 of a per-code salt and the code; a code is 40 random bits).
 * Using one lets that sign-in through: the code's row records the session it let in, and both our server
 * (lib/two-step-session.ts) and the database (public.session_passed_two_step, mig 463) accept that session.
 *
 * The sign-in service accepts the same authenticator code twice within its window (Part 1 Step 0), so every code WE
 * check on the server is recorded (two_step_code_uses, hashed with the person's id) and refused a second time.
 */

export const BACKUP_CODE_COUNT = 10;
/** No 0/O or 1/I/L: a code read off paper is typed right. 31 letters, 8 per code → about 39.6 bits. */
const BACKUP_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const BACKUP_LENGTH = 8;

export const AUTHENTICATOR_CODE_PATTERN = /^\d{6}$/;

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** "kd7p r4ts" / "KD7P-R4TS" → "KD7PR4TS". */
export function normalizeBackupCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** "KD7PR4TS" → "KD7P-R4TS", the way the codes are shown. */
export function formatBackupCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The six digits of an authenticator code, or null when it isn't six digits. */
export function normalizeAuthenticatorCode(input: string): string | null {
  const digits = input.replace(/\s+/g, '');
  return AUTHENTICATOR_CODE_PATTERN.test(digits) ? digits : null;
}

function newBackupCode(): string {
  let out = '';
  for (let i = 0; i < BACKUP_LENGTH; i++) out += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
  return out;
}

/**
 * A fresh set of ten. The person's unused codes are deleted first (a new set replaces the old one); USED codes are kept,
 * because a used code is what lets the session it signed in keep working. Returns the codes, formatted, to show ONCE.
 */
export async function createBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, newBackupCode);
  const rows = codes.map(code => {
    const salt = randomBytes(16).toString('hex');
    return { salt, code_hash: sha256(`${salt}:${code}`) };
  });
  // One step in the database (mig 463, two_step_backup_codes_replace): the old unused set and the new one swap together,
  // under a per-person lock, so a double press never leaves twenty codes, or none.
  const { error } = await supabaseAdmin.rpc('two_step_backup_codes_replace', { p_user: userId, p_rows: rows });
  if (error) throw error;
  return codes.map(formatBackupCode);
}

/** How many unused backup codes the person has. */
export async function backupCodesLeft(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('two_step_backup_codes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Use one backup code for this session. True when it matched an unused code (which is now used, and records the
 * session); false otherwise. The mark is conditional on the code still being unused, so two tabs racing the same code
 * cannot both get in.
 */
export async function redeemBackupCode(userId: string, sessionId: string, typed: string): Promise<boolean> {
  const code = normalizeBackupCode(typed);
  if (code.length !== BACKUP_LENGTH) return false;
  const { data, error } = await supabaseAdmin
    .from('two_step_backup_codes')
    .select('id, salt, code_hash')
    .eq('user_id', userId)
    .is('used_at', null);
  if (error) throw error;
  const match = (data ?? []).find(row => {
    const want = Buffer.from(row.code_hash as string, 'hex');
    const got = Buffer.from(sha256(`${row.salt}:${code}`), 'hex');
    return want.length === got.length && timingSafeEqual(want, got);
  });
  if (!match) return false;
  const { data: marked, error: markErr } = await supabaseAdmin
    .from('two_step_backup_codes')
    .update({ used_at: new Date().toISOString(), used_session_id: sessionId })
    .eq('id', match.id)
    .is('used_at', null)
    .select('id');
  if (markErr) throw markErr;
  return (marked ?? []).length === 1;
}

const codeUseHash = (userId: string, code: string) => sha256(`${userId}:${code}`);

/** Codes are kept this long as "already used"; an authenticator code lives 30 seconds, plus the service's slack. */
const CODE_USE_KEEP_MS = 5 * 60_000;

/**
 * Record an authenticator code as used by this person. False when the same code was already accepted in the last few
 * minutes (a replay), true when it is fresh and now recorded.
 */
export async function recordCodeUse(userId: string, code: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - CODE_USE_KEEP_MS).toISOString();
  // Everyone's old rows go, not only this person's (/legal 2026-11-11): the record stays short-lived for all.
  await supabaseAdmin.from('two_step_code_uses').delete().lt('used_at', cutoff);
  const { error } = await supabaseAdmin
    .from('two_step_code_uses')
    .insert({ user_id: userId, code_hash: codeUseHash(userId, code) });
  if (!error) return true;
  if (error.code === '23505') return false; // the same code, already accepted
  throw error;
}

export type CodeCheck = { ok: true } | { ok: false; reason: 'wrong_code' | 'reused_code' | 'no_authenticator' | 'not_checked' };

/**
 * Check an authenticator code on the SERVER, for the signed-in person, on a client that writes the session cookies (the
 * session becomes `aal2` with a new "code typed" time). Refuses a code this person already used. Platform "sign in
 * again" uses it now; Part 2's five actions use it.
 */
export async function verifyAuthenticatorCode(supabase: SupabaseClient, userId: string, typed: string): Promise<CodeCheck> {
  const code = normalizeAuthenticatorCode(typed);
  if (!code) return { ok: false, reason: 'wrong_code' };
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { ok: false, reason: 'not_checked' };
  const factor = factors?.totp?.find(f => f.status === 'verified');
  if (!factor) return { ok: false, reason: 'no_authenticator' };

  // Recorded BEFORE the service checks it (/review 2026-11-11): verifying rewrites the session's "code typed" time, so a
  // replayed code must be refused before it can refresh anything. A code the service then refuses is forgotten again.
  if (!(await recordCodeUse(userId, code))) return { ok: false, reason: 'reused_code' };
  const forget = () => supabaseAdmin.from('two_step_code_uses').delete().eq('user_id', userId).eq('code_hash', codeUseHash(userId, code));
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (chErr || !challenge) { await forget(); return { ok: false, reason: 'not_checked' }; }
  const { error: vErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
  if (vErr) {
    await forget();
    return { ok: false, reason: vErr.code === 'mfa_verification_failed' || vErr.status === 422 ? 'wrong_code' : 'not_checked' };
  }
  return { ok: true };
}
