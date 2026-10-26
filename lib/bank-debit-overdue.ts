import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { landCheckoutSession } from './online-payment-landing';
import { DEBIT_OVERDUE_DAYS } from './bank-debit';

/**
 * A bank debit still CLEARING past Stripe's window (Club Tier Stage 12c Part 5, review 2026-10-26). The webhook is the
 * source of truth, but a missed `async_payment_succeeded` / `async_payment_failed` (an event the Connect destination
 * doesn't subscribe to, an endpoint down past Stripe's retries) would hold the place — and refuse every later payment —
 * for good. So the pay page and the family's status page ask Stripe about an OVERDUE clearing debit when they are read:
 * the landing lands it, records it returned, or leaves it clearing. Never throws: a page always renders.
 */
export async function settleOverdueDebits(at: { teamId: string } | { registrationId: string }): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - DEBIT_OVERDUE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let q = supabaseAdmin.from('online_payments').select('stripe_account_id, stripe_checkout_session_id')
      .eq('status', 'clearing').lt('clearing_at', cutoff);
    if ('teamId' in at) {
      q = q.eq('team_id', at.teamId);
    } else {
      const { data: reg } = await supabaseAdmin.from('league_registrations').select('id, season_id, signup_ref').eq('id', at.registrationId).maybeSingle();
      if (!reg) return;
      q = q.eq('flow', 'league_signup').eq('season_id', reg.season_id as string).eq('signup_key', (reg.signup_ref as string | null) ?? (reg.id as string));
    }
    const { data } = await q.limit(5);
    for (const op of (data ?? []) as Array<{ stripe_account_id: string; stripe_checkout_session_id: string | null }>) {
      if (op.stripe_checkout_session_id) await landCheckoutSession(op.stripe_account_id, op.stripe_checkout_session_id);
    }
  } catch (err) {
    console.error('[bank-debit-overdue] could not ask Stripe about an overdue debit:', err instanceof Error ? err.message : String(err));
  }
}
