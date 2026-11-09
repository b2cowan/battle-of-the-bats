/**
 * WHO NEVER SEES THE TERMS STEP — the one home (GST/HST Stage 6 step 6.3, ruling R4 of 2026-11-09). Exactly two kinds:
 *
 *   · `staff` — FieldLogicHQ staff: a bootstrap admin email (`PLATFORM_ADMIN_EMAILS`) or an active `platform_users` row. The
 *     platform console is staff-only and is not a customer's agreement; it does not mount the sign-in screen at all.
 *   · `demo`  — the two demo accounts the no-login demo door signs in (`isDemoOrganizerEmail`, `lib/demo-org.ts`). A prospect
 *     walking the shop window is not agreeing to anything, and the tour must run with the switch on.
 *
 * Fixture and seed accounts are NOT exempt: they record acceptance (`scripts/lib/record-legal-acceptance.mjs`). A third kind is a
 * decision, not a tidy-up — `tests/unit/legal-acceptance.test.ts` fails when this list changes.
 *
 * Reuses the platform and demo checks; never re-implements them.
 */

import 'server-only';
import { isPlatformAdminEmail } from './platform-auth';
import { isDemoOrganizerEmail } from './demo-org';

export const ACCEPTANCE_EXEMPT_KINDS = ['staff', 'demo'] as const;
export type AcceptanceExemptKind = (typeof ACCEPTANCE_EXEMPT_KINDS)[number];

/** Is this person exempt, and why? The demo check is pure; staff may read `platform_users`. */
export async function acceptanceExemption(user: { email?: string | null }): Promise<AcceptanceExemptKind | null> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return null;
  if (isDemoOrganizerEmail(email)) return 'demo';
  if (await isPlatformAdminEmail(email)) return 'staff';
  return null;
}
