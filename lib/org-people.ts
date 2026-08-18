/**
 * lib/org-people.ts — server-side reads/writes for the Families substrate
 * (org_people / org_person_emails, migrations 251–252).
 *
 * Everything here is SERVICE-ROLE ONLY. The tables carry contact data for
 * minors' guardians across an entire club; there is no client-side read path
 * and there must never be one. Callers are the /api/admin/families/* routes,
 * each of which has already answered BOTH authorization questions:
 * does this member hold the Families capability, AND does the record being
 * read belong to this member's org (plan §5.3, the two-check rule).
 *
 * ⚠ Person attachment has ONE home: the families_attach_people(org) database
 * function (migration 252). ~10 write paths create or edit guardian emails;
 * none of them mint people. Instead the Families area calls
 * attachPeopleForOrg() when it opens, which re-runs the (idempotent, org-scoped)
 * mint-and-attach. Do NOT add per-route minting — ten copies of one matching
 * rule is the drift this project exists to close.
 */

import { supabaseAdmin } from './supabase-admin';

/**
 * Mint people for, and attach person_id to, every source row in this org that
 * gained a guardian email since the last run. Idempotent; safe to call on every
 * Families-area read. Milliseconds at club sizes (partial indexes on
 * person_id IS NULL keep the scan tiny).
 */
export async function attachPeopleForOrg(orgId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('families_attach_people', { p_org_id: orgId });
  if (error) {
    // A failed attach must not take the whole area down — the screens still
    // render what is already attached; the gap is at most "rows added since
    // the last successful run". Logged loudly because it should never happen.
    console.error('[families] attachPeopleForOrg failed:', error.message);
  }
}

/**
 * File the consent-ledger row for a league waiver acceptance (mig 252).
 * The season's waiver text at the moment of acceptance is the evidence, stored
 * on the ledger row itself (family_consents.consent_text) — the season's copy
 * can be edited later, the ledger row cannot.
 *
 * The live-uniqueness index (org, email, basis, scope where withdrawn_at is null)
 * makes a second acceptance by the same guardian a no-op, which is correct: the
 * earliest live consent is the one that counts.
 */
export async function recordLeagueWaiverConsent(input: {
  orgId: string;
  guardianEmailNormalized: string;
  registrationId: string;
  waiverText: string;
  acceptedAt: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('family_consents')
    .insert({
      org_id: input.orgId,
      guardian_email: input.guardianEmailNormalized,
      basis: 'league_registration',
      basis_started_at: input.acceptedAt,
      scope: 'child_data',
      source_table: 'league_registrations',
      source_id: input.registrationId,
      consent_text: input.waiverText,
    });
  // 23505 = the live-uniqueness index (family_consents_live_uniq) already holds a
  // live consent for this guardian — the earliest one wins, so this is success.
  // (The index is PARTIAL — where withdrawn_at is null — so an upsert conflict
  // target cannot address it; tolerating the violation is the correct shape.)
  if (error && error.code !== '23505') {
    // Same posture as the confirmation email in this route: the registration
    // itself must not fail because the ledger write did.
    console.error('[families] recordLeagueWaiverConsent failed:', error.message);
  }
}
