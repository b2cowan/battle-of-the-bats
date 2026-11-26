/**
 * WHO NEVER SEES THE TERMS STEP — the one home (GST/HST Stage 6 step 6.3, ruling R4 of 2026-11-09). Exactly one kind:
 *
 *   · `staff` — FieldLogicHQ staff: a bootstrap admin email (`PLATFORM_ADMIN_EMAILS`) or an active `platform_users` row. The
 *     platform console is staff-only and is not a customer's agreement; it does not mount the sign-in screen at all.
 *   (A second kind, `demo`, covered the two shared accounts of the public demos; it went with them, 2026-11-26.)
 *
 * Fixture and seed accounts are NOT exempt: they record acceptance (`scripts/lib/record-legal-acceptance.mjs`). A second kind is a
 * decision, not a tidy-up — `tests/unit/legal-acceptance.test.ts` fails when this list changes.
 *
 * Reuses the platform check; never re-implements it.
 */

import 'server-only';
import { isPlatformAdminEmail } from './platform-auth';

export const ACCEPTANCE_EXEMPT_KINDS = ['staff'] as const;
export type AcceptanceExemptKind = (typeof ACCEPTANCE_EXEMPT_KINDS)[number];

/** Is this person exempt, and why? Staff may read `platform_users`. */
export async function acceptanceExemption(user: { email?: string | null }): Promise<AcceptanceExemptKind | null> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;
  if (await isPlatformAdminEmail(email)) return 'staff';
  return null;
}
