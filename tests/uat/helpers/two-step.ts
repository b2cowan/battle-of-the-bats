/**
 * TWO-STEP SIGN-IN in the UAT run (Board Ready, Part 1; drawings tab 9). Two accounts sign in with a real code on purpose,
 * so the code step is tested every run rather than by accident:
 *   - the UAT platform account (staff always use two-step), and
 *   - one dedicated two-step account (`UAT_TWO_STEP_EMAIL`, default below), whose spec walks the code step itself.
 *
 * The "known authenticator key" is the run's own: auth.setup removes the account's authenticators, sets up a fresh one
 * through the sign-in service, and writes its key to `.auth/two-step-keys.json` (gitignored with the sessions), so every
 * spec types the code that key produces. Setting it up signs the account's other sessions out, which is why it happens
 * once, first, in the setup project.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../../lib/supabase-admin';
import { findAuthUserByEmail } from '../../../lib/auth-account-lookup';
import { createFixtureUser } from './fixture-user';

export const TWO_STEP_KEYS_FILE = path.join(__dirname, '..', '.auth', 'two-step-keys.json');

/** RFC 6238: the 6-digit code an authenticator app shows for `secret` (base32) now, or `offset` steps away. */
export function totpCode(secret: string, offset = 0): string {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) bits += alpha.indexOf(c).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30) + offset));
  const h = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

/**
 * A code that will still be good for a few seconds: if this 30-second step is about to end, wait for the next one, so a
 * slow form fill never types a code that expired on the way.
 */
export async function freshTotpCode(secret: string): Promise<string> {
  const left = 30 - (Math.floor(Date.now() / 1000) % 30);
  if (left < 6) await new Promise(r => setTimeout(r, (left + 1) * 1000));
  return totpCode(secret);
}

/**
 * Remove the account's authenticators and set up a fresh one through the sign-in service, as the account itself would.
 * Returns the new key. The account must exist and `password` must be its password.
 */
export async function enrolKnownAuthenticator(email: string, password: string): Promise<string> {
  const user = await findAuthUserByEmail(email);
  if (!user) throw new Error(`two-step UAT: no account for ${email}`);
  const { data: listed } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  for (const f of listed?.factors ?? []) await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`two-step UAT: sign-in for ${email} failed: ${signInErr.message}`);
  const { data: enrolled, error: enrolErr } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `UAT ${Date.now().toString(36)}`,
    issuer: 'FieldLogicHQ',
  });
  if (enrolErr || !enrolled) throw new Error(`two-step UAT: enrol for ${email} failed: ${enrolErr?.message}`);
  const secret = enrolled.totp.secret;
  const { error: verifyErr } = await client.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: await freshTotpCode(secret) });
  if (verifyErr) throw new Error(`two-step UAT: verify for ${email} failed: ${verifyErr.message}`);
  return secret;
}

type KeyEntry = { secret: string; password?: string };

export function saveTwoStepKey(email: string, entry: KeyEntry): void {
  const keys = readTwoStepKeys();
  keys[email.toLowerCase()] = entry;
  fs.mkdirSync(path.dirname(TWO_STEP_KEYS_FILE), { recursive: true });
  fs.writeFileSync(TWO_STEP_KEYS_FILE, JSON.stringify(keys, null, 2));
}

export function readTwoStepKeys(): Record<string, KeyEntry> {
  try { return JSON.parse(fs.readFileSync(TWO_STEP_KEYS_FILE, 'utf8')); } catch { return {}; }
}

export function twoStepKeyFor(email: string): KeyEntry {
  const key = readTwoStepKeys()[email.toLowerCase()];
  if (!key) throw new Error(`two-step UAT: no key for ${email} — the auth-setup project writes it`);
  return key;
}

/** The dedicated two-step account: made (or its password reset) by auth.setup each run; no seat anywhere. */
export const UAT_TWO_STEP_EMAIL = (process.env.UAT_TWO_STEP_EMAIL ?? 'uat-two-step@uat-test-org.local').toLowerCase();

/** Make sure the dedicated account exists with a password this run knows. Returns the password. */
export async function ensureTwoStepAccount(): Promise<string> {
  const password = `Uat-${crypto.randomBytes(9).toString('base64url')}`;
  const existing = await findAuthUserByEmail(UAT_TWO_STEP_EMAIL);
  if (existing) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(`two-step UAT: password reset failed: ${error.message}`);
  } else {
    await createFixtureUser(supabaseAdmin, { email: UAT_TWO_STEP_EMAIL, password });
  }
  return password;
}
