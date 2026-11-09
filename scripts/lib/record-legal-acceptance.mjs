/**
 * A fixture or seed account records acceptance of the Terms (GST/HST Stage 6 step 6.3, Chunk A, A5; ruling R5 of 2026-11-09).
 *
 * Every script and dev seed route that makes a login calls this once the account exists, so a fixture never meets the
 * sign-in screen ("We've published our Terms") when the legal pages are on. It writes what the app's own door writes: one
 * `legal_acceptances` row (door `'fixture'`, both versions, the exact box sentence), THEN the `app_metadata` mirror.
 *
 * The version is the one the RUNNING ENVIRONMENT would record — `currentVersion()` itself, read from `lib/legal-documents.ts`
 * over this process's env (scripts load `.env.local`, as the dev server does):
 *   · the pages off  → records nothing (production records nothing while the mode is off);
 *   · the dev preview → `'draft'`;
 *   · published (6.7) → the dated current version.
 *
 * ⚠ AFTER 6.7, RE-RUN A FIXTURE TO RE-ACCEPT. Its `'draft'` rows stop counting the day the publication constant flips (a
 * `'draft'` never satisfies a dated version), so a fixture seeded before then meets the sign-in screen until it is seeded again.
 *
 * NOT for staff (`seed-platform-staff`, `app/api/dev/seed/platform-user`) or the two demo seeds: those accounts are exempt
 * (`lib/legal-acceptance-exempt.ts`) and never tick.
 *
 * Two failure rules over ONE writer: `recordLegalAcceptance` (the scripts) never throws — a failed write is a warning, the
 * fixture still runs, and before 6.7 production has no `legal_acceptances` table, so a script pointed there must not stop on
 * it. `writeFixtureAcceptance` (the UAT specs, through `tests/uat/helpers/legal-acceptance.ts`) throws, so a spec fails loudly
 * instead of meeting the Terms screen half-way through. The row itself is `acceptanceRow` (`lib/legal-acceptance-rules.ts`),
 * the same one the app's own doors insert.
 */
import { TERMS_ACCEPTED_KEY, acceptanceRow, mirroredTermsVersion } from '../../lib/legal-acceptance-rules.ts';

/**
 * Record acceptance for one account, or throw. `db` is a service-role Supabase client; `user` an auth user. Nothing when the
 * pages are off, when there is no user, or when the mirror already holds this version (a re-seeded account adds no second
 * row — the mirror is written only after a row).
 * @param {any} db
 * @param {{ id: string, email?: string | null, app_metadata?: unknown } | null | undefined} user
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<void>}
 */
export async function writeFixtureAcceptance(db, user, env = process.env) {
  if (!user?.id) return;
  const row = acceptanceRow(user, 'fixture', env);
  if (row === null || mirroredTermsVersion(user.app_metadata) === row.terms_version) return;
  const { error } = await db.from('legal_acceptances').insert(row);
  if (error) throw new Error(`the acceptance row was not written (${error.message}); this account will meet the Terms screen at first sign-in`);
  const { error: mirrorError } = await db.auth.admin.updateUserById(user.id, { app_metadata: { [TERMS_ACCEPTED_KEY]: row.terms_version } });
  if (mirrorError) throw new Error(`the mirror was not written (${mirrorError.message}); the app repairs it from the row`);
}

/**
 * The scripts' form: the same write, never throwing.
 * @param {any} db
 * @param {{ id: string, email?: string | null, app_metadata?: unknown } | null | undefined} user
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<void>}
 */
export async function recordLegalAcceptance(db, user, env = process.env) {
  try {
    await writeFixtureAcceptance(db, user, env);
  } catch (err) {
    console.warn(`[record-legal-acceptance] ${user?.email ?? user?.id}: ${err instanceof Error ? err.message : err}.`);
  }
}
