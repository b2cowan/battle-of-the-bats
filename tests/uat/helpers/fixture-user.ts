/**
 * The one way a UAT spec makes a login (GST/HST Stage 6 step 6.3, Chunk C; owner-logged 2026-11-09): the account is created
 * AND records Terms acceptance in one call, so a spec can't forget it. The scripts' counterpart is
 * `scripts/lib/fixture-user.mjs`; `tests/unit/legal-fixture-user-guard.test.ts` fails the build on any other `createUser`.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { recordLegalAcceptance } from './legal-acceptance';

export async function createFixtureUser(
  admin: SupabaseClient,
  { email, password, userMetadata }: { email: string; password: string; userMetadata?: Record<string, unknown> },
): Promise<User> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(userMetadata ? { user_metadata: userMetadata } : {}),
  });
  if (error || !data.user) throw new Error(`createFixtureUser ${email}: ${error?.message ?? 'no user returned'}`);
  try {
    await recordLegalAcceptance(admin, data.user);
  } catch (err) {
    // Never leave a login behind that the spec's own cleanup cannot see (it has not been handed the user yet).
    await admin.auth.admin.deleteUser(data.user.id).catch(() => undefined);
    throw err;
  }
  return data.user;
}
