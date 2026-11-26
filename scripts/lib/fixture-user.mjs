/**
 * The one way a script makes a login (GST/HST Stage 6 step 6.3, Chunk C; owner-logged 2026-11-09).
 *
 * A fixture or seed account must record acceptance of the Terms (`record-legal-acceptance.mjs`), or it meets the sign-in
 * screen "We've published our Terms" once the legal pages are on. Hand-placing that call beside ~30 `auth.admin.createUser`
 * sites meant a new seed could forget it silently. So a script makes its login HERE, and acceptance is recorded as part of
 * making it — there is nothing to remember. `tests/unit/legal-fixture-user-guard.test.ts` fails the build when a script or
 * UAT file calls `auth.admin.createUser(` anywhere else.
 *
 * Not for staff (`seed-platform-staff`): those accounts are
 * exempt (`lib/legal-acceptance-exempt.ts`), never tick, and keep their own `createUser`. The UAT specs' counterpart is
 * `tests/uat/helpers/fixture-user.ts`.
 */
import { createClient } from '@supabase/supabase-js';
import { recordLegalAcceptance } from './record-legal-acceptance.mjs';

/**
 * The auth user with this address (any case), or null. Pages 200 at a time, up to 40 pages.
 * @param {any} db a service-role Supabase client
 * @param {string} email
 * @returns {Promise<any | null>}
 */
export async function findUserByEmail(db, email) {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * Does `password` already sign this address in? Asked with a throwaway, non-persisting anon client, and signed out LOCALLY
 * afterwards — a password sign-in does not end the account's other sessions (measured 2026-10-19), a password RESET does.
 * True also for `email_not_confirmed` (the password is right; a reset would not confirm it either).
 * @returns {Promise<boolean>} false only for `invalid_credentials`; any other failure throws (never guess into a reset).
 */
async function passwordAlreadyWorks(email, password, env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error(`check ${email} can sign in: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing (password left alone)`);
  const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) { await probe.auth.signOut({ scope: 'local' }); return true; }
  if (error.code === 'email_not_confirmed') return true;
  if (error.code === 'invalid_credentials') return false;
  throw new Error(`check ${email} can sign in (password left alone): ${error.code ?? ''} ${error.message}`);
}

/**
 * The sign-in for this address: found or made (confirmed, with `userMetadata`). Either way the account records Terms
 * acceptance (the warn-and-carry-on form).
 *
 * A found account's password is set to `password` ONLY when that password does not already sign it in (`resetPassword`
 * false skips even that). ⚠ A reset signs the account out EVERYWHERE, so resetting on every run killed the saved UAT and
 * layout-sweep sign-ins of whatever session was mid-run: the free coach's on 2026-10-19 (fixed then in its own seed), and
 * the club admin's during the club UAT suite on 2026-11-19 (Club Tier Stage 8 cause check). Nothing else about a found
 * account changes.
 * @param {any} db a service-role Supabase client
 * @param {{ email: string, password: string, userMetadata?: Record<string, unknown>, resetPassword?: boolean, env?: Record<string, string | undefined> }} opts
 * @returns {Promise<{ user: any, created: boolean }>}
 */
export async function ensureFixtureUser(db, { email, password, userMetadata, resetPassword = true, env = process.env }) {
  const metadata = userMetadata ? { user_metadata: userMetadata } : {};
  let user = await findUserByEmail(db, email);
  let created = false;
  if (user) {
    if (resetPassword && !(await passwordAlreadyWorks(email, password, env))) {
      // Password only — an existing account keeps its name and its confirmation as another seed or a tester left them.
      const { data, error } = await db.auth.admin.updateUserById(user.id, { password });
      if (error) throw new Error(`updateUser ${email}: ${error.message}`);
      user = data?.user ?? user;
    }
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, ...metadata });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    user = data.user;
    created = true;
  }
  await recordLegalAcceptance(db, user, env);
  return { user, created };
}
