/**
 * THE PAYMENTS TERMS AGREEMENT RECORD (Club Tier Stage 12, mig 497; payments terms §15: "We record who agreed, when, and to
 * which version, and keep that record for at least six years after your account closes").
 *
 * One row per tick of "I agree to the FieldLogicHQ payments terms for <club>." — append-only, and it outlives the organization
 * and the account (plain ids, the names and the email as text). The payouts row keeps its terms columns as the club's CURRENT
 * STANDING; this is the EVIDENCE, written BEFORE the standing changes, so a standing never says "agreed" without a record behind
 * it. No IP address and no device, matching the Terms of Service record (mig 455, ruling R1).
 *
 * Changing who pays the fee is not here: it records no agreement (it is refused while the agreement is behind).
 */
import { supabaseAdmin } from './supabase-admin';
import { PAYMENTS_TERMS_VERSION, PAYOUTS_WORDS } from './online-payment-words';

/** Which action the tick came with (mig 497's CHECK; 'backfill' is the migration's alone). */
export type PaymentsTermsAction = 'set_up' | 'reconnect' | 'agree_again';

export interface PaymentsTermsAgreementRow {
  org_id: string;
  org_name: string;
  user_id: string;
  user_email: string;
  terms_version: string;
  box_text: string;
  action: PaymentsTermsAction;
  agreed_at: string;
}

/**
 * The row, built from what the window showed: the version the route has already checked equals the one the window sent, and
 * the sentence is built by the same words function the window renders, from the same name (the club's name).
 */
export function paymentsTermsAgreementRow(p: {
  org: { id: string; name: string };
  user: { id: string; email?: string | null };
  action: PaymentsTermsAction;
  at: string;
}): PaymentsTermsAgreementRow {
  return {
    org_id: p.org.id,
    org_name: p.org.name,
    user_id: p.user.id,
    user_email: p.user.email ?? 'unknown',
    terms_version: PAYMENTS_TERMS_VERSION,
    box_text: PAYOUTS_WORDS.before.termsCheckbox(p.org.name),
    action: p.action,
    agreed_at: p.at,
  };
}

/** Keep the tick. Throws on failure, so the caller changes nothing: an agreement that is not recorded did not happen. */
export async function recordPaymentsTermsAgreement(p: Parameters<typeof paymentsTermsAgreementRow>[0]): Promise<void> {
  const { error } = await supabaseAdmin.from('payments_terms_agreements').insert(paymentsTermsAgreementRow(p));
  if (error) throw error;
}
