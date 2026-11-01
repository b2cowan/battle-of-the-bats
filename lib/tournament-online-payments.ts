import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature } from '@/lib/plan-features';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { factsFromRow, takesPayments, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow } from '@/lib/online-payment-account';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { getOrganizationBySlugForServer } from '@/lib/server-organizations';

/**
 * Does this tournament take payments online right now? The ONE answer the public registration form (via
 * /api/pay/tournament/[id]) and the registration emails share, so a form that says "pay by card" and an email that says
 * "FieldLogicHQ does not process online payments" can never disagree. Any doubt answers no: the copy stays what it was.
 */
export async function tournamentTakesOnlinePayments(tournamentId: string): Promise<boolean> {
  try {
    if (!onlinePaymentsOn() || !/^[0-9a-f-]{36}$/i.test(tournamentId)) return false;
    const { data: t } = await supabaseAdmin.from('tournaments').select('org_id, settings').eq('id', tournamentId).maybeSingle();
    if (!t || !tournamentTracksPayments(t.settings)) return false;
    const [{ data: org }, { data: acct }] = await Promise.all([
      supabaseAdmin.from('organizations').select('slug').eq('id', t.org_id as string).maybeSingle(),
      supabaseAdmin.from('org_payment_accounts').select(PAYOUTS_ACCOUNT_COLUMNS).eq('org_id', t.org_id as string).maybeSingle(),
    ]);
    const full = org?.slug ? await getOrganizationBySlugForServer(org.slug as string) : null;
    if (!full || !hasPlanFeature(full.planId, 'online_payments')) return false;
    return takesPayments(factsFromRow(acct as PayoutsAccountRow | null));
  } catch {
    return false; // an email never fails over its payment sentence
  }
}
