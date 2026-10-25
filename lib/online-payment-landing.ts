import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin } from './supabase-admin';
import { notify } from './notify';
import { clearSettled } from './needs-attention';
import { getOrganizationBySlugForServer } from './server-organizations';
import { canConnectPayouts, canRefundOnline, isPayoutsTreasurer } from './online-payment-access';
import { factsFromStripe, factsFromRow, payoutsPath, payoutsState, PAYOUTS_ACCOUNT_COLUMNS, type PayoutsAccountRow } from './online-payment-account';
import { retrieveAccount, retrieveCheckout, refundToCard } from './stripe-connect';
import { sendOnlineReceiptOnce, sendRefundEmail } from './online-payment-receipt';
import { ONLINE_NOTICE_WORDS as W, money as formatMoney } from './online-payment-words';
import type { Organization, OrgRole } from './types';

/**
 * THE LANDING (Club Tier Stage 12a). The one module through which an online payment reaches a team's record and a
 * refund reaches the card — `tests/unit/online-payments-guard.test.ts` holds that nothing else calls the mig 358
 * functions. Every write that moves money is a database function (mig 358) that calls the tournament's own writer, so a
 * card payment behaves exactly as a hand-recorded one.
 *
 * Called by the Connect webhook (the source of truth: "Paid" is never shown on the redirect alone), by the receipt page
 * when it re-reads a session the webhook has not landed yet, and by the refund route.
 */

type MemberRow = { user_id: string; role: OrgRole; capabilities: Record<string, boolean> | null };

async function orgById(orgId: string): Promise<Organization | null> {
  const { data } = await supabaseAdmin.from('organizations').select('slug').eq('id', orgId).maybeSingle();
  return data?.slug ? getOrganizationBySlugForServer(data.slug as string) : null;
}

async function activeMembers(orgId: string): Promise<MemberRow[]> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('user_id, role, capabilities')
    .eq('organization_id', orgId) // ⚠ organization_id: this table predates the org_id convention
    .eq('status', 'active');
  if (error) throw error;
  return ((data ?? []) as MemberRow[]).filter(m => m.user_id);
}

/** The owner and the treasurer (A1) — who hears that Stripe needs something. */
async function payoutsPeople(org: Organization): Promise<string[]> {
  const members = await activeMembers(org.id);
  return [...new Set(members.filter(m => canConnectPayouts(m) || isPayoutsTreasurer(m, org)).map(m => m.user_id))];
}

/** Whoever may refund (A13) — who hears that a payment or a refund needs a hand. */
async function refundPeople(org: Organization): Promise<string[]> {
  const members = await activeMembers(org.id);
  return [...new Set(members.filter(m => canRefundOnline(m, org)).map(m => m.user_id))];
}

/** Raise a Needs-attention item once per person: an uncleared one of the same kind and subject is never doubled. */
async function raiseOnce(p: {
  org: Organization; userIds: string[]; eventType: 'payouts_need_attention' | 'online_payment_not_recorded' | 'card_refund_failed';
  subjectKey: string; subjectId: string; title: string; body: string; link: string;
}): Promise<void> {
  if (!p.userIds.length) return;
  const { data } = await supabaseAdmin
    .from('notifications')
    .select('user_id, metadata')
    .eq('org_id', p.org.id)
    .eq('event_type', p.eventType)
    .is('cleared_at', null);
  const already = new Set(((data ?? []) as { user_id: string; metadata: Record<string, unknown> | null }[])
    .filter(n => (n.metadata?.[p.subjectKey] ?? null) === p.subjectId)
    .map(n => n.user_id));
  const userIds = p.userIds.filter(u => !already.has(u));
  if (!userIds.length) return;
  await notify({
    orgId: p.org.id, userIds, eventType: p.eventType, title: p.title, body: p.body, link: p.link,
    metadata: { [p.subjectKey]: p.subjectId }, requiredFeature: 'online_payments',
  });
}

// ── The account ─────────────────────────────────────────────────────────────────────────────────

/**
 * Re-read a club's account from Stripe (never trusting an event's payload: events arrive out of order) and store the
 * facts. Raises "Stripe needs something" when the card turns to needs attention, and lets it clear itself otherwise.
 */
export async function syncPayoutsAccount(stripeAccountId: string): Promise<PayoutsAccountRow | null> {
  const acct = await retrieveAccount(stripeAccountId);
  const facts = factsFromStripe(acct);
  const { data, error } = await supabaseAdmin
    .from('org_payment_accounts')
    .update({ ...facts, country: acct.country ?? null, stripe_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('stripe_account_id', stripeAccountId)
    .select(PAYOUTS_ACCOUNT_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  const row = data as PayoutsAccountRow | null;
  if (!row) return null; // an account we do not hold (deleted club, another platform's test): acknowledged, ignored
  const org = await orgById(row.org_id);
  if (org && payoutsState(factsFromRow(row)) === 'needs_attention') {
    const deadline = row.requirements_deadline ? W.byDeadline(row.requirements_deadline) : '';
    await raiseOnce({
      org, userIds: await payoutsPeople(org), eventType: 'payouts_need_attention',
      subjectKey: 'stripeAccountId', subjectId: stripeAccountId,
      title: W.stripeNeedsTitle,
      body: row.charges_enabled ? W.stripeNeedsBodyStillOn(deadline) : W.stripeNeedsBodyPaused,
      link: payoutsHref(org),
    });
  }
  await clearSettled({ orgIds: [row.org_id], kinds: ['payouts_need_attention'] });
  return row;
}

/** Where the Payouts card lives (A8) — `payoutsPath`, the one home of the path. */
export function payoutsHref(org: Pick<Organization, 'slug' | 'planId'>): string {
  return payoutsPath(org);
}

// ── A payment ───────────────────────────────────────────────────────────────────────────────────

type OnlineRow = {
  id: string; org_id: string; team_id: string | null; tournament_id: string | null; status: string; landed_at: string | null;
  stripe_account_id: string; stripe_checkout_session_id: string | null; description: string; total_amount: number;
};

function cardOf(session: Stripe.Checkout.Session): { intent: string | null; charge: string | null; brand: string | null; last4: string | null } {
  const pi = session.payment_intent;
  const intent = typeof pi === 'string' ? pi : pi?.id ?? null;
  const ch = typeof pi === 'object' && pi ? pi.latest_charge : null;
  const charge = typeof ch === 'string' ? ch : ch?.id ?? null;
  const card = typeof ch === 'object' && ch ? ch.payment_method_details?.card : null;
  return { intent, charge, brand: card?.brand ?? null, last4: card?.last4 ?? null };
}

/**
 * A Checkout Session on a club's account completed and paid → land it. Idempotent (the database function answers
 * `already`). A landing that throws — an "our team" link made after the page opened, a deleted team — keeps the payment
 * PAID and numbered, with the reason, and raises "isn't in the team's record" for whoever may refund. Stripe has the
 * money either way; nothing is lost.
 */
export async function landCheckoutSession(stripeAccountId: string, sessionId: string): Promise<'landed' | 'already' | 'not_paid' | 'unknown' | 'not_recorded'> {
  const { data } = await supabaseAdmin
    .from('online_payments')
    .select('id, org_id, team_id, tournament_id, status, landed_at, stripe_account_id, stripe_checkout_session_id, description, total_amount')
    .eq('stripe_checkout_session_id', sessionId)
    .maybeSingle();
  const op = data as OnlineRow | null;
  if (!op || op.stripe_account_id !== stripeAccountId) return 'unknown';
  if (op.landed_at) return 'already';
  const session = await retrieveCheckout(stripeAccountId, sessionId);
  if (session.payment_status !== 'paid') return 'not_paid';
  const card = cardOf(session);
  const paidAt = new Date(((typeof session.payment_intent === 'object' && session.payment_intent?.created) || session.created) * 1000).toISOString();
  // Stripe's own figures must be the ones the payment was opened for; anything else is recorded by a person, not by us.
  const expected = Math.round(Number(op.total_amount) * 100);
  const mismatch = session.amount_total !== expected || (session.currency ?? '').toLowerCase() !== 'cad'
    ? `Stripe took ${(session.amount_total ?? 0) / 100} ${(session.currency ?? '').toUpperCase()}, not the ${expected / 100} CAD the page asked for`
    : null;

  const { data: landed, error: landError } = mismatch
    ? { data: null, error: { message: mismatch } }
    : await supabaseAdmin.rpc('online_payment_land', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand, p_last4: card.last4,
    });
  const error = landError;
  if (error) {
    await supabaseAdmin.rpc('online_payment_land_failed', {
      p_online_payment: op.id, p_paid_at: paidAt, p_payment_intent: card.intent, p_charge: card.charge, p_brand: card.brand,
      p_last4: card.last4, p_error: error.message,
    });
    const org = await orgById(op.org_id);
    if (org) {
      await raiseOnce({
        org, userIds: await refundPeople(org), eventType: 'online_payment_not_recorded',
        subjectKey: 'onlinePaymentId', subjectId: op.id,
        title: W.notRecordedTitle,
        body: W.notRecordedBody(op.description, formatMoney(Number(op.total_amount)), error.message),
        link: op.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournament=${op.tournament_id}` : `/${org.slug}/admin`,
      });
    }
    await sendOnlineReceiptOnce(op.id);
    return 'not_recorded';
  }
  await sendOnlineReceiptOnce(op.id);
  return (landed as { already?: boolean } | null)?.already ? 'already' : 'landed';
}

/** A Checkout Session expired unpaid: the payment closes, so the team can open a new one. */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  await supabaseAdmin.from('online_payments').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('stripe_checkout_session_id', sessionId).eq('status', 'open');
}

// ── A refund ────────────────────────────────────────────────────────────────────────────────────

type RefundOutcome = { state: 'succeeded' | 'pending' | 'failed'; refundId: string };

async function refundFailed(refundId: string, stripeRefundId: string | null, reason: string, onlinePaymentId: string): Promise<void> {
  await supabaseAdmin.rpc('online_payment_refund_failed', { p_refund: refundId, p_stripe_refund: stripeRefundId, p_reason: reason });
  const { data } = await supabaseAdmin.from('online_payments').select('org_id, description, tournament_id').eq('id', onlinePaymentId).maybeSingle();
  const org = data ? await orgById(data.org_id as string) : null;
  if (!org || !data) return;
  await raiseOnce({
    org, userIds: await refundPeople(org), eventType: 'card_refund_failed',
    subjectKey: 'onlinePaymentId', subjectId: onlinePaymentId,
    title: W.refundFailedTitle,
    body: W.refundFailedBody(data.description as string),
    link: data.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournament=${data.tournament_id}` : `/${org.slug}/admin`,
  });
}

async function landRefund(refundId: string, stripeRefundId: string | null): Promise<void> {
  const { data: landed, error } = await supabaseAdmin.rpc('online_payment_refund_land', { p_refund: refundId, p_stripe_refund: stripeRefundId });
  if (error) throw error;
  // One email per refund: only the first landing sends it (a repeat answers already).
  // Not for a refund made another way: that email would say the card was refunded.
  if (!(landed as { already?: boolean } | null)?.already && stripeRefundId) await sendRefundEmail(refundId);
  const { data } = await supabaseAdmin.from('online_payment_refunds').select('online_payment_id, org_id').eq('id', refundId).maybeSingle();
  if (data) await clearSettled({ orgIds: [data.org_id as string], kinds: ['card_refund_failed', 'online_payment_not_recorded'] });
}

/**
 * Refund an online payment to the card, in full (12a, A12). The refund is opened in the database FIRST (one live refund
 * per payment), then asked of Stripe. FieldLogicHQ's fee is never refunded (§0c); with A2's box ticked, the club pays
 * the payer's fee back out of its own balance.
 */
export async function refundOnlinePayment(p: {
  onlinePaymentId: string; feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null; actorId: string;
}): Promise<RefundOutcome> {
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: p.onlinePaymentId, p_fee_included: p.feeIncluded, p_reason: p.reason, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
  });
  if (error) throw new Error(error.message);
  const id = refundId as string;
  const [{ data: op }, { data: r }] = await Promise.all([
    supabaseAdmin.from('online_payments').select('stripe_account_id, stripe_payment_intent_id').eq('id', p.onlinePaymentId).single(),
    supabaseAdmin.from('online_payment_refunds').select('amount').eq('id', id).single(),
  ]);
  let refund: Stripe.Refund;
  try {
    refund = await refundToCard({
      accountId: op!.stripe_account_id as string,
      paymentIntentId: op!.stripe_payment_intent_id as string,
      amountCents: Math.round(Number(r!.amount) * 100),
      refundId: id,
      metadata: { online_payment_id: p.onlinePaymentId, refund_id: id },
    });
  } catch (e) {
    // A refusal is a failure; a lost connection is not — Stripe may have the refund, and its event will settle it.
    const type = (e as { type?: string } | null)?.type;
    if (type === 'StripeConnectionError' || type === 'StripeAPIError') return { state: 'pending', refundId: id };
    await refundFailed(id, null, e instanceof Error ? e.message : 'Stripe refused the refund', p.onlinePaymentId);
    return { state: 'failed', refundId: id };
  }
  await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id, updated_at: new Date().toISOString() }).eq('id', id);
  return applyStripeRefund(refund, id, p.onlinePaymentId);
}

async function applyStripeRefund(refund: Stripe.Refund, refundId: string, onlinePaymentId: string): Promise<RefundOutcome> {
  if (refund.status === 'succeeded') {
    await landRefund(refundId, refund.id);
    return { state: 'succeeded', refundId };
  }
  if (refund.status === 'failed' || refund.status === 'canceled') {
    await refundFailed(refundId, refund.id, refund.failure_reason ?? refund.status, onlinePaymentId);
    return { state: 'failed', refundId };
  }
  return { state: 'pending', refundId };
}

/**
 * A refund event from Stripe (refund.created / refund.updated / refund.failed, or charge.refunded). Ours lands or fails;
 * one started in the club's own Stripe dashboard is recorded the same way (origin 'stripe_dashboard') when it returns
 * the whole payment — a partial one, which 12a cannot record, raises "isn't in the team's record" so a person settles it.
 */
export async function applyRefundEvent(stripeAccountId: string, refund: Stripe.Refund): Promise<void> {
  const intent = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id ?? null;
  if (!intent) return;
  const { data: op } = await supabaseAdmin.from('online_payments')
    .select('id, org_id, status, total_amount, stripe_account_id, description, tournament_id')
    .eq('stripe_payment_intent_id', intent).maybeSingle();
  if (!op || op.stripe_account_id !== stripeAccountId) return;
  // Ours carries our refund's id in its metadata (set when we asked Stripe), or Stripe's id once recorded. A refund made
  // in the club's own Stripe dashboard has neither and is never taken for one of ours.
  const ourId = typeof refund.metadata?.refund_id === 'string' ? refund.metadata.refund_id : null;
  const { data: ours } = await supabaseAdmin.from('online_payment_refunds')
    .select('id, status').eq('online_payment_id', op.id as string)
    .or(ourId ? `id.eq.${ourId},stripe_refund_id.eq.${refund.id}` : `stripe_refund_id.eq.${refund.id}`)
    .limit(1).maybeSingle();
  if (ours) {
    if (ours.status === 'pending') {
      await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id }).eq('id', ours.id as string).is('stripe_refund_id', null);
      await applyStripeRefund(refund, ours.id as string, op.id as string);
    }
    return;
  }
  if (refund.status !== 'succeeded' || op.status !== 'paid') return;
  const full = Math.round(Number(op.total_amount) * 100);
  if (refund.amount < full) {
    const org = await orgById(op.org_id as string);
    if (org) {
      await raiseOnce({
        org, userIds: await refundPeople(org), eventType: 'online_payment_not_recorded',
        subjectKey: 'onlinePaymentId', subjectId: op.id as string,
        title: W.notRecordedTitle,
        body: W.partialInStripeBody(op.description as string, formatMoney(refund.amount / 100)),
        link: op.tournament_id ? `/${org.slug}/admin/tournaments/registrations?tournament=${op.tournament_id}` : `/${org.slug}/admin`,
      });
    }
    return;
  }
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: op.id, p_fee_included: true, p_reason: null, p_note: null, p_actor: null, p_origin: 'stripe_dashboard',
  });
  if (error) return; // a refund of ours opened in between: its own event lands it
  await supabaseAdmin.from('online_payment_refunds').update({ stripe_refund_id: refund.id }).eq('id', refundId as string);
  await landRefund(refundId as string, refund.id);
}

/**
 * The club sent the money back another way after a refund to the card was returned (the "card_refund_failed" item's way
 * out): the refund is recorded with no Stripe refund behind it, so the team's paid figure falls and the book reads
 * "Refunded another way". The same refund window's answers decide the fee (A2).
 */
export async function recordRefundAnotherWay(p: {
  onlinePaymentId: string; feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null; actorId: string;
}): Promise<RefundOutcome> {
  const { data: refundId, error } = await supabaseAdmin.rpc('online_payment_refund_open', {
    p_online_payment: p.onlinePaymentId, p_fee_included: p.feeIncluded, p_reason: p.reason, p_note: p.note, p_actor: p.actorId, p_origin: 'app',
  });
  if (error) throw new Error(error.message);
  await landRefund(refundId as string, null);
  return { state: 'succeeded', refundId: refundId as string };
}
