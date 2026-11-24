import 'server-only';
/**
 * A SPONSOR PAYS BY CARD — OPENING THE PAGE (Board Ready Stage 6 Part 3b; round 2 tab 1; owner call (3), 2026-11-23). The
 * third flow on the online-payments rail (mig 530: flow 'sponsorship', one deal, card only). The landing and the refunds are
 * lib/online-payment-landing.ts's, as every flow's are; this file only reads whether the club takes card and opens (or
 * closes) the Checkout page.
 *
 *   · The card button is ABSENT, not broken, while the launch switch is off (`onlinePaymentsOn`) or the club's account
 *     doesn't take payments (`takesPayments`: connected, active, a refund policy) — everything else ships.
 *   · Before any invoice the business chooses card on its page: the fee follows the Payouts card's "Processing fee on
 *     sponsorships" row (mig 525, the club pays it by default), and the payment issues the invoice when it lands, at the
 *     figures the page showed (`sponsor_invoice`).
 *   · An invoice already issued: its link still lets them pay by card, at what is owing, and the CLUB pays the fee whatever
 *     that row says — an issued invoice never gains a fee line (owner call (3)).
 *   · One page open per deal (mig 530's index): a second press gets the same page back while it is young and for the same
 *     amount; otherwise the old one is closed first, and a Stripe read that fails is never taken for a closed page.
 */
import { randomUUID } from 'crypto';
import { supabaseAdmin } from './supabase-admin';
import { onlinePaymentsOn } from './online-payments-switch';
import { factsFromRow, PAYOUTS_ACCOUNT_COLUMNS, takesPayments, type PayoutsAccountFacts, type PayoutsAccountRow } from './online-payment-account';
import { canOpen, sponsorCardFee, toDollars, type SponsorCardFee, type SponsorFeePayer } from './online-payment-fee';
import { createCheckout, expireCheckout, retrieveCheckout } from './stripe-connect';
import { DEAL_WORDS } from './club-sponsorship-deal-words';

const C = DEAL_WORDS.card;
/** A Checkout Session lives 24 hours; an open one younger than this is offered again rather than a second one opened. */
const REUSE_MS = 23 * 60 * 60 * 1000;

export interface SponsorCardFacts {
  account: PayoutsAccountFacts;
  feePayer: SponsorFeePayer;
  refundPolicy: string | null;
}

/** Whether the club takes a sponsor's card payment now, and on what terms. null = no card button. */
export async function sponsorCardFacts(orgId: string): Promise<SponsorCardFacts | null> {
  if (!onlinePaymentsOn()) return null;
  const { data, error } = await supabaseAdmin.from('org_payment_accounts')
    .select(`${PAYOUTS_ACCOUNT_COLUMNS}, sponsor_fee_payer`).eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  const row = data as (PayoutsAccountRow & { sponsor_fee_payer: SponsorFeePayer | null }) | null;
  const account = factsFromRow(row);
  if (!account || !takesPayments(account)) return null;
  return { account, feePayer: row?.sponsor_fee_payer === 'sponsor' ? 'sponsor' : 'club', refundPolicy: account.refundPolicy };
}

/**
 * A card payment Stripe took that never landed on the deal (paid, with a reason it wasn't recorded). The business must never be
 * shown the plain form again (it paid twice, owner walk 2026-11-24), and the club must be told the money is in its Stripe account.
 * A later successful landing sets `landed_at`, which ends this.
 */
export async function unrecordedCardPayment(orgId: string, dealId: string): Promise<{ amount: number; reason: string | null } | null> {
  const { data, error } = await supabaseAdmin.from('online_payments')
    .select('total_amount, land_error')
    .eq('org_id', orgId).eq('flow', 'sponsorship').eq('sponsor_deal_id', dealId).eq('status', 'paid').is('landed_at', null)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { amount: Number(data.total_amount), reason: (data.land_error as string | null) ?? null } : null;
}

/** The invoice a card payment issues when it lands (mig 530 `sponsor_invoice`): the figures the page showed. */
export interface SponsorInvoicePlan {
  amount: number; taxKind: 'GST' | 'HST' | null; taxRate: number | null; tax: number; total: number; dueDays: number;
}

export type OpenResult = { ok: true; url: string } | { ok: false; error: string; status: number; code?: 'paid' };

/**
 * Open (or hand back) the deal's card page. `plan` set = before any invoice (the payment issues it); null = an invoice is
 * out and the card pays what is owing on it, the club paying the fee. The caller has checked the amount the page showed.
 */
export async function openSponsorCheckout(p: {
  origin: string; orgId: string; orgSlug: string; token: string; dealId: string; facts: SponsorCardFacts;
  fee: SponsorCardFee; plan: SponsorInvoicePlan | null; taxKind: 'GST' | 'HST' | null;
  lineName: string; email: string | null;
}): Promise<OpenResult> {
  if (!canOpen(p.fee)) return { ok: false, error: C.errOpen, status: 409 };
  // Money already taken for this deal and not recorded: a second page would only take it twice.
  if (await unrecordedCardPayment(p.orgId, p.dealId)) return { ok: false, error: C.errReceived, status: 409, code: 'paid' };
  const issues = p.plan !== null;
  const reuse = await openPageFor(p.dealId, p.fee.totalCents, issues);
  if (reuse) return reuse;

  const id = randomUUID();
  const back = `/${p.orgSlug}/sponsorship/${p.token}`;
  const sponsorPays = p.fee.feePayer === 'family';
  let session: Awaited<ReturnType<typeof createCheckout>>;
  try {
    session = await createCheckout({
      accountId: p.facts.account.stripeAccountId,
      currency: 'cad',
      rail: 'card',
      lines: [
        { name: p.lineName, amountCents: p.fee.owingCents },
        ...(sponsorPays ? [{ name: C.feeRow, amountCents: p.fee.feeCents }] : []),
        ...(sponsorPays && p.fee.feeTaxCents > 0 ? [{ name: `${p.taxKind ?? 'GST/HST'} on the processing fee`, amountCents: p.fee.feeTaxCents }] : []),
      ],
      applicationFeeCents: p.fee.applicationFeeCents,
      payerEmail: p.email,
      successUrl: `${p.origin}${back}?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${p.origin}${back}?left=1`,
      description: p.lineName,
      metadata: { online_payment_id: id, sponsor_deal_id: p.dealId, org_id: p.orgId },
      idempotencyKey: `checkout:${id}`,
    });
  } catch {
    return { ok: false, error: C.errOpen, status: 502 };
  }
  const { error } = await supabaseAdmin.from('online_payments').insert({
    id, org_id: p.orgId, stripe_account_id: p.facts.account.stripeAccountId, flow: 'sponsorship', sponsor_deal_id: p.dealId,
    scope: 'full', description: p.lineName, payer_email: p.email,
    base_amount: toDollars(p.fee.baseCents), fee_amount: toDollars(p.fee.feeCents),
    application_fee_amount: toDollars(p.fee.applicationFeeCents), total_amount: toDollars(p.fee.totalCents),
    fee_payer: p.fee.feePayer, fee_pct: p.fee.pctBps / 100, fee_flat: toDollars(p.fee.flatCents), rail: 'card',
    livemode: p.facts.account.livemode, stripe_checkout_session_id: session.id,
    sponsor_fee_tax: sponsorPays && p.fee.feeTaxCents > 0 ? toDollars(p.fee.feeTaxCents) : null,
    sponsor_invoice: p.plan,
  });
  if (error) {
    // Another press recorded its page first: close ours before anyone sees it, and offer theirs.
    await expireCheckout(p.facts.account.stripeAccountId, session.id);
    return (await openPageFor(p.dealId, p.fee.totalCents, issues)) ?? { ok: false, error: C.errOpen, status: 409 };
  }
  return session.url ? { ok: true, url: session.url } : { ok: false, error: C.errOpen, status: 502 };
}

/** The deal's open card page: the same page while young, for this amount and for the same purpose (`issues`: it issues the
 *  invoice, versus pays one already out — a page opened before an invoice, then an invoice issued another way, must not be
 *  handed to "Pay by card": its landing would refuse it); "paid" when it completed; null when there is none (or it is now
 *  closed and recorded so). A Stripe read that fails answers "try again", never closes on doubt. */
async function openPageFor(dealId: string, totalCents: number | null, issues: boolean | null): Promise<OpenResult | null> {
  const { data } = await supabaseAdmin.from('online_payments')
    .select('id, total_amount, stripe_checkout_session_id, created_at, stripe_account_id, sponsor_invoice')
    .eq('flow', 'sponsorship').eq('sponsor_deal_id', dealId).eq('status', 'open').maybeSingle();
  if (!data?.stripe_checkout_session_id) return null;
  const account = data.stripe_account_id as string;
  const sessionId = data.stripe_checkout_session_id as string;
  const session = await retrieveCheckout(account, sessionId).catch(() => null);
  if (!session) return { ok: false, error: C.errOpen, status: 503 };
  if (session.status === 'complete') return { ok: false, error: C.errOpen, status: 409, code: 'paid' };
  const young = Date.now() - Date.parse(data.created_at as string) < REUSE_MS;
  const samePurpose = issues !== null && (data.sponsor_invoice != null) === issues;
  if (totalCents != null && samePurpose && session.status === 'open' && young && Math.round(Number(data.total_amount) * 100) === totalCents && session.url) {
    return { ok: true, url: session.url };
  }
  if (session.status === 'open') {
    await expireCheckout(account, sessionId);
    const still = await retrieveCheckout(account, sessionId).catch(() => null);
    if (still?.status !== 'expired') return { ok: false, error: C.errOpen, status: 503 };
  }
  await supabaseAdmin.from('online_payments').update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', data.id as string).eq('status', 'open');
  return null;
}

/**
 * Close the deal's open card page before the club sends the invoice ("Send the invoice"): a page paid after the invoice is out
 * would pay it twice. 'paid' = it completed (the landing records it; the invoice must not go); 'busy' = Stripe couldn't be read.
 */
export async function closeSponsorCheckout(dealId: string): Promise<'closed' | 'paid' | 'busy'> {
  const r = await openPageFor(dealId, null, null);
  if (!r) return 'closed';
  if (!r.ok && r.code === 'paid') return 'paid';
  return 'busy';
}

/** The fee on what a deal owes by card: `plan` (before any invoice) follows the Payouts row; an issued invoice is the club's. */
export function sponsorFeeFor(owing: number, facts: SponsorCardFacts, taxRate: number | null, issued: boolean): SponsorCardFee {
  return sponsorCardFee(Math.round(owing * 100), facts.feePayer, taxRate, issued);
}
