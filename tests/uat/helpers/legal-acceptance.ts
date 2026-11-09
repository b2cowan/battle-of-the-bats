/**
 * A UAT account records acceptance of the Terms (GST/HST Stage 6 step 6.3, Chunk A, A5), so a spec's throwaway account (or a
 * long-lived UAT role, `auth.setup.ts`) never meets the sign-in screen "We've published our Terms" when the legal pages are on.
 * The writer is the scripts' own (`scripts/lib/record-legal-acceptance.mjs`) in its throwing form: one row of the same shape
 * the app's doors insert (door `'fixture'`), THEN the `app_metadata` mirror — and a spec fails loudly when either is refused.
 *
 * ⚠ After 6.7 the long-lived UAT roles carry `'draft'` rows that stop counting; `auth.setup.ts` records again on every run.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { writeFixtureAcceptance } from '../../../scripts/lib/record-legal-acceptance.mjs';

export const recordLegalAcceptance = (
  admin: SupabaseClient,
  user: { id: string; email?: string | null; app_metadata?: unknown } | null | undefined,
): Promise<void> => writeFixtureAcceptance(admin, user);
