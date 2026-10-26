import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { stripe } from './stripe';
import { RETURNED_BANK_DEBIT_FEE_CENTS } from './plan-config';
import { workspaceHoldsFoundingComp } from './founding-season';
import { effectiveOrgFactsForId } from './entitlement-grants';
import { RETURNED_DEBIT_FEE_WORDS as W } from './online-payment-words';
import { formatStoredDate } from './timezone';

/**
 * STRIPE'S FEE FOR A RETURNED OR REVERSED BANK DEBIT, RECOVERED FROM THE CLUB (Club Tier Stage 12c Part 6; plan §0k answer
 * 2, owner 2026-10-26). Stripe charges the platform (fees_collector = application) and the fee payer can't be set per fee,
 * so each one is recorded against the club (`platform_debit_fees`, one per debit and kind) and billed as a "Returned bank
 * debit" line on its next FieldLogicHQ invoice — a pending invoice item on the club's subscription, which Stripe adds to
 * the next invoice by itself. A comped club (Founding Season) or one with no live subscription is not billed: FieldLogicHQ
 * absorbs it, and the row says why. Never throws: the money path that called it has already happened.
 */
export async function recordDebitFee(p: { orgId: string; onlinePaymentId: string; kind: 'returned' | 'reversed'; livemode: boolean }): Promise<void> {
  try {
    const { data: row, error } = await supabaseAdmin.from('platform_debit_fees')
      .insert({ org_id: p.orgId, online_payment_id: p.onlinePaymentId, kind: p.kind, amount: RETURNED_BANK_DEBIT_FEE_CENTS / 100, livemode: p.livemode })
      .select('id, created_at').maybeSingle();
    if (error) {
      if (error.code === '23505') return; // recorded already (a replayed event)
      throw error;
    }
    if (row) await billDebitFee(row.id as string, p.orgId, row.created_at as string);
  } catch (err) {
    console.error('[platform-debit-fee] not recorded:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Bill one recorded fee on the club's subscription, or stamp why it is not billed. Free is read through the door (the
 * Founding Season comp, or free time running — never the stored columns); whether a subscription is live is Stripe's own
 * answer, read at billing time.
 */
async function billDebitFee(feeId: string, orgId: string, createdAt: string): Promise<void> {
  const exempt = async (why: 'comped' | 'no_subscription') => {
    await supabaseAdmin.from('platform_debit_fees').update({ exempt_reason: why }).eq('id', feeId);
  };
  const facts = await effectiveOrgFactsForId(orgId).catch(() => null);
  if (facts?.freeTime || (await workspaceHoldsFoundingComp(orgId).catch(() => false))) return exempt('comped');
  const { data: org } = await supabaseAdmin.from('organizations').select('stripe_customer_id, stripe_subscription_id').eq('id', orgId).maybeSingle();
  if (!org?.stripe_customer_id || !org.stripe_subscription_id) return exempt('no_subscription');
  try {
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id as string);
    if (!['active', 'trialing', 'past_due'].includes(sub.status)) return exempt('no_subscription');
    // The line is in the subscription's own currency; FieldLogicHQ bills in Canadian dollars, and a fee in another
    // currency would be a wrong amount, so it is held for a person instead.
    if (sub.currency !== 'cad') throw new Error(`The subscription bills in ${sub.currency}, not CAD.`);
    const item = await stripe.invoiceItems.create({
      customer: org.stripe_customer_id as string,
      subscription: sub.id,
      amount: RETURNED_BANK_DEBIT_FEE_CENTS,
      currency: 'cad',
      description: W.invoiceLine(formatStoredDate(createdAt)),
      metadata: { platform_debit_fee_id: feeId, org_id: orgId },
    }, { idempotencyKey: `debit-fee:${feeId}` });
    await supabaseAdmin.from('platform_debit_fees').update({ stripe_invoice_item_id: item.id, billed_at: new Date().toISOString(), bill_error: null }).eq('id', feeId);
  } catch (err) {
    await supabaseAdmin.from('platform_debit_fees').update({ bill_error: (err instanceof Error ? err.message : String(err)).slice(0, 500) }).eq('id', feeId);
  }
}
