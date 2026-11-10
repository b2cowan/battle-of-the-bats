/**
 * The one way a script makes a login (GST/HST Stage 6 step 6.3, Chunk C; owner-logged 2026-11-09).
 *
 * A fixture or seed account must record acceptance of the Terms (`record-legal-acceptance.mjs`), or it meets the sign-in
 * screen "We've published our Terms" once the legal pages are on. Hand-placing that call beside ~30 `auth.admin.createUser`
 * sites meant a new seed could forget it silently. So a script makes its login HERE, and acceptance is recorded as part of
 * making it — there is nothing to remember. `tests/unit/legal-fixture-user-guard.test.ts` fails the build when a script or
 * UAT file calls `auth.admin.createUser(` anywhere else.
 *
 * Not for staff (`seed-platform-staff`) or the two demo seeds (`seed-demo-tournament`, `seed-demo-coach`): those accounts are
 * exempt (`lib/legal-acceptance-exempt.ts`), never tick, and keep their own `createUser`. The UAT specs' counterpart is
 * `tests/uat/helpers/fixture-user.ts`.
 */
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
 * The sign-in for this address: found (password reset to `password`, unless `resetPassword` is false; nothing else about it
 * changes) or made (confirmed, with `userMetadata`). Either way the account records Terms acceptance (the warn-and-carry-on form).
 * @param {any} db a service-role Supabase client
 * @param {{ email: string, password: string, userMetadata?: Record<string, unknown>, resetPassword?: boolean, env?: Record<string, string | undefined> }} opts
 * @returns {Promise<{ user: any, created: boolean }>}
 */
export async function ensureFixtureUser(db, { email, password, userMetadata, resetPassword = true, env = process.env }) {
  const metadata = userMetadata ? { user_metadata: userMetadata } : {};
  let user = await findUserByEmail(db, email);
  let created = false;
  if (user) {
    if (resetPassword) {
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
