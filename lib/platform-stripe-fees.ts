import 'server-only';
import type Stripe from 'stripe';
import { supabaseAdmin, getOrgOwnerEmail } from './supabase-admin';
import { stripe } from './stripe';
import { foreignCardFeeCents } from './online-payment-fee';
import { ensureStripeCustomer } from './billing-setup';
import { retrieveCheckout } from './stripe-connect';
import { sendEmail, escapeHtml } from './email';
import { stripeKeyIsLive } from './stripe-mode';
import { FEE_INVOICE_OWED_STATUS, httpsOnly } from './fee-invoice-alert';
import { warmEmailButton, warmEmailDocument, warmEmailParagraph, warmEmailSmall } from './email-envelope-warm';
import { emailFactsPanel } from './online-refund-block';
import {
  FEE_INVOICE_META, ONLINE_EMAIL_WORDS as E, PLATFORM_CONTACT_EMAIL, STRIPE_FEE_WORDS as W, isFeeCredit, money, type StripeFeeKind,
} from './online-payment-words';
import { addCalendarMonths, formatStoredDate, orgMonthKey, zonedWallClockToUtc } from './timezone';
import { AUTOMATIC_TAX, RECOVERED_FEE_TAX, namedTaxLines } from './billing-tax';
import { readBillingLocation, usSalesOpen } from './billing-location-server';
import { recordCreditNoteTax, recordTaxOrReport } from './charge-tax-record-server';
import { storedLocationStillValid, type BillingLocation } from './billing-location';

/**
 * EVERY STRIPE FEE A CLUB'S ONLINE PAYMENTS CAUSE, RECOVERED FROM THE CLUB (Club Tier Stage 12c Part 6, as the returned-
 * debit fee; widened by 12d-1 Part 4). Owner rulings: a comp covers the subscription and nothing else, so every club pays,
 * comped and free included (2026-10-26); "bill only what Stripe charged us" (12d-1 ruling 5); a club with no subscription
 * invoice to ride on gets ONE invoice of its own a month, sent on the 1st, in our email (2026-10-27).
 *
 * One path for every kind (`platform_stripe_fees`, mig 390):
 *   - recorded once per payment, kind (and dispute), at Stripe's own figure where Stripe gives one (a returned or reversed
 *     debit, a dispute: nothing when Stripe charged nothing), else at the published rate held in `lib/plan-config.ts`
 *     (`amount_source = 'rate'`: the foreign-card extra, which Stripe gives no figure for);
 *   - billed at once as a line on a live, undiscounted, CAD subscription's next invoice; otherwise left for the club's own
 *     monthly invoice (`sendMonthlyFeeInvoices`, the daily job);
 *   - `test_mode` is the one exemption left (a test payment never reaches a live invoice).
 * A credit (a returned answering fee) goes back against the invoice that carried its answering fee (owner ruling 7): a
 * negative line beside it while that invoice is still to come, else a Stripe credit note on it. Never throws into a money path:
 * a failure is stored on the row (`bill_error`) and retried by the daily job and from platform admin.
 *
 * GST/HST Stage 2 (Ask 3, owner 2026-11-05; docs/agents/accounting/RECOVERED_STRIPE_FEES_TAX.md): a recovered fee is our own
 * supply, so it is TAXED ON TOP at the club's province rate. Every fee line carries `RECOVERED_FEE_TAX` (lib/billing-tax.ts); on a
 * subscription invoice it is taxed with the subscription, and the club's own invoice turns automatic tax on, so it waits for an
 * address Stripe can place. The base is Stripe's fee before any tax Stripe charged us (we claim that back). A credit goes against
 * the fee's own line, so Stripe reverses its tax with it.
 */

/** Ours, not Stripe's: how long a club has to pay its own invoice. Printed from Stripe's due date, never typed. */
const FEE_INVOICE_DAYS_DUE = 30;
const LIVE_SUBSCRIPTION = new Set(['active', 'trialing', 'past_due']);

type FeeRow = {
  id: string; org_id: string; online_payment_id: string; kind: StripeFeeKind; amount: number; livemode: boolean;
  exempt_reason: string | null; billed_at: string | null; billed_on: string | null; fee_invoice_id: string | null;
  bill_error: string | null; bill_attempts: number; created_at: string; dispute_id: string | null; amount_source: 'stripe' | 'rate';
  stripe_invoice_item_id: string | null; stripe_credit_note_id: string | null;
};
const FEE_COLUMNS = 'id, org_id, online_payment_id, kind, amount, livemode, exempt_reason, billed_at, billed_on, fee_invoice_id, bill_error, bill_attempts, created_at, dispute_id, amount_source, stripe_invoice_item_id, stripe_credit_note_id';

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);
const signedCents = (f: Pick<FeeRow, 'kind' | 'amount'>) => Math.round(Number(f.amount) * 100) * (isFeeCredit(f.kind) ? -1 : 1);

// ── Recording ───────────────────────────────────────────────────────────────────────────────────

/** Record one fee and bill it. A replay (the row's key exists) writes nothing. Never throws. */
export async function recordStripeFee(p: {
  orgId: string; onlinePaymentId: string; kind: StripeFeeKind; amountCents: number; source: 'stripe' | 'rate';
  livemode: boolean; disputeId?: string | null;
}): Promise<void> {
  if (!(p.amountCents > 0)) return;
  try {
    const { data: row, error } = await supabaseAdmin.from('platform_stripe_fees')
      .insert({
        org_id: p.orgId, online_payment_id: p.onlinePaymentId, kind: p.kind, amount: p.amountCents / 100, livemode: p.livemode,
        amount_source: p.source, dispute_id: p.disputeId ?? null,
      })
      .select('id').maybeSingle();
    if (error) {
      if (error.code === '23505') return; // recorded already (a replayed event)
      throw error;
    }
    if (row) await billFee(row.id as string);
  } catch (err) {
    console.error('[platform-stripe-fees] not recorded:', p.kind, p.onlinePaymentId, errText(err));
  }
}

/** A Stripe fee in a balance transaction (a charge, or a refund of one), the way the platform's balance reports it. */
// `tax_fee` is Stripe's tax on its own fee: FieldLogicHQ claims it back, so it is never billed on (we tax the fee ourselves).
const isStripeFee = (t: Stripe.BalanceTransaction) => t.type !== 'tax_fee' && (t.reporting_category === 'fee' || t.type === 'stripe_fee');

/**
 * Stripe's fee for a RETURNED bank debit (failed before it settled), at what Stripe charged FieldLogicHQ: the platform's
 * balance transactions on the debit's charge, read as a reversed debit's are on its dispute (owner ruling 3, 2026-10-27).
 * Nothing when Stripe charged nothing (the sandbox showed no fee on a failed debit); the published CA$5 never decides a
 * bill. Read when the debit comes back and again by the daily job, so a fee Stripe posts later is found; written once.
 */
export async function recordReturnedDebitFee(onlinePaymentId: string): Promise<void> {
  try {
    const { data: op } = await supabaseAdmin.from('online_payments')
      .select('id, org_id, rail, status, livemode, stripe_account_id, stripe_checkout_session_id').eq('id', onlinePaymentId).maybeSingle();
    if (!op || op.rail !== 'bank_debit' || op.status !== 'returned' || !op.stripe_account_id || !op.stripe_checkout_session_id) return;
    // A returned debit never lands, so its charge is never stored: Stripe's session names it.
    const session = await retrieveCheckout(op.stripe_account_id as string, op.stripe_checkout_session_id as string);
    const pi = typeof session.payment_intent === 'object' ? session.payment_intent : null;
    const chargeId = typeof pi?.latest_charge === 'string' ? pi.latest_charge : pi?.latest_charge?.id;
    if (!chargeId) return;
    const page = await stripe.balanceTransactions.list({ source: chargeId, limit: 100 });
    const charged = page.data.filter(isStripeFee).reduce((s, t) => s - t.amount, 0);
    await recordStripeFee({
      orgId: op.org_id as string, onlinePaymentId: op.id as string, kind: 'returned', amountCents: charged, source: 'stripe', livemode: !!op.livemode,
    });
  } catch (err) {
    console.error('[platform-stripe-fees] the returned debit’s fee wasn’t read:', onlinePaymentId, errText(err));
  }
}

/**
 * What Stripe charged FieldLogicHQ for a dispute: the PLATFORM's balance transactions whose source is the dispute (the
 * sandbox showed a bank debit's CA$5 there, "Dispute fee"; a card dispute's fee came off the club's own balance instead and
 * is never billed, ruling 5). An answering ("countered") fee is told apart by its description; a positive amount is a fee
 * Stripe gave back (the answering fee, on a win). Cents.
 */
export async function platformDisputeFees(stripeDisputeId: string): Promise<{ dispute: number; answer: number; returned: number }> {
  const out = { dispute: 0, answer: 0, returned: 0 };
  const page = await stripe.balanceTransactions.list({ source: stripeDisputeId, limit: 100 });
  for (const t of page.data) {
    if (!isStripeFee(t)) continue;
    if (t.amount > 0) out.returned += t.amount;
    else if (/counter|answer|response/i.test(t.description ?? '')) out.answer += -t.amount;
    else out.dispute += -t.amount;
  }
  return out;
}

/**
 * Record a dispute's fees that Stripe charged FieldLogicHQ, at Stripe's figures. A card dispute's go on its dispute row's
 * kinds; a bank debit's dispute is the reversed debit's fee (`reversed`, 12c's kind). Read on every dispute event and by
 * the daily job, so a fee Stripe posts later is still found; each kind is written once.
 */
export async function recordDisputeFees(p: {
  orgId: string; onlinePaymentId: string; rail: 'card' | 'bank_debit'; stripeDisputeId: string; disputeId: string | null;
  livemode: boolean; fees?: { dispute: number; answer: number; returned: number };
}): Promise<void> {
  try {
    const fees = p.fees ?? await platformDisputeFees(p.stripeDisputeId);
    const base = { orgId: p.orgId, onlinePaymentId: p.onlinePaymentId, livemode: p.livemode, source: 'stripe' as const };
    if (p.rail === 'bank_debit') {
      await recordStripeFee({ ...base, kind: 'reversed', amountCents: fees.dispute });
      return;
    }
    if (!p.disputeId) return;
    await recordStripeFee({ ...base, kind: 'dispute', amountCents: fees.dispute, disputeId: p.disputeId });
    await recordStripeFee({ ...base, kind: 'dispute_answer', amountCents: fees.answer, disputeId: p.disputeId });
    await recordStripeFee({ ...base, kind: 'dispute_answer_returned', amountCents: fees.returned, disputeId: p.disputeId });
  } catch (err) {
    console.error('[platform-stripe-fees] the dispute’s fees weren’t read:', p.stripeDisputeId, errText(err));
  }
}

/**
 * Stripe's extra cost on a card issued outside the club's country (owner 2026-10-27): the card's country against the
 * club's connected account's country, never a typed "CA". Stripe gives no per-charge figure, so it is the published rate
 * (`FOREIGN_CARD_EXTRA_BPS`) on what the card was charged. Called once Stripe says the card is paid (both flows, and their
 * replays), whether or not the payment could be recorded; a refund leaves it billed (held ruling). The family's total
 * never changes.
 */
export async function recordForeignCardFee(onlinePaymentId: string): Promise<void> {
  try {
    const { data: op } = await supabaseAdmin.from('online_payments')
      .select('id, org_id, rail, card_country, total_amount, livemode')
      .eq('id', onlinePaymentId).maybeSingle();
    if (!op || op.rail !== 'card' || !op.card_country) return;
    const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('country').eq('org_id', op.org_id).maybeSingle();
    const home = ((acct?.country as string | null) ?? '').toUpperCase();
    if (!home || home === String(op.card_country).toUpperCase()) return;
    await recordStripeFee({
      orgId: op.org_id as string, onlinePaymentId: op.id as string, kind: 'foreign_card', source: 'rate',
      amountCents: foreignCardFeeCents(Math.round(Number(op.total_amount) * 100)), livemode: !!op.livemode,
    });
  } catch (err) {
    console.error('[platform-stripe-fees] the foreign-card fee wasn’t recorded:', onlinePaymentId, errText(err));
  }
}


// ── Billing one fee ─────────────────────────────────────────────────────────────────────────────

export type BillOutcome = 'billed' | 'own_invoice' | 'test_mode' | 'error' | 'done';

/** Where a fee goes, decided from Stripe's own answer at billing time (a comp is never a Stripe object, plan §0). */
async function subscriptionToRide(orgId: string): Promise<{ customer: string; subscription: string } | null> {
  const { data: org } = await supabaseAdmin.from('organizations').select('stripe_customer_id, stripe_subscription_id').eq('id', orgId).maybeSingle();
  if (!org?.stripe_customer_id || !org.stripe_subscription_id) return null;
  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id as string);
  } catch (err) {
    // A subscription Stripe no longer has is no subscription (/review 4b: it failed the fee for good); anything else retries.
    if ((err as { code?: string }).code === 'resource_missing') return null;
    throw err;
  }
  if (!LIVE_SUBSCRIPTION.has(sub.status) || sub.cancel_at_period_end) return null;
  // A discount applies to every line on its invoice, the fee included: such a club gets its own invoice (build prompt).
  if ((sub.discounts?.length ?? 0) > 0) return null;
  // FieldLogicHQ bills fees in Canadian dollars: a subscription in another currency can't carry one, so the club's own
  // invoice does (/review 4b: it was an error retried five times, then never billed).
  if (sub.currency !== 'cad') return null;
  // A fee line is taxed only on an invoice that works tax out (Ask 3). A subscription made before GST/HST Stage 2, and never moved
  // since, has tax off, and every line on its invoice would go out untaxed: such a club gets its own fee invoice, which is always
  // taxed (/review 2026-11-05; tests/unit/billing-location-every-path-guard.test.ts pins it).
  if (!sub.automatic_tax?.enabled) return null;
  return { customer: org.stripe_customer_id as string, subscription: sub.id };
}

async function lineFor(f: Pick<FeeRow, 'online_payment_id' | 'kind' | 'created_at'>): Promise<string> {
  const { data: op } = await supabaseAdmin.from('online_payments').select('receipt_no').eq('id', f.online_payment_id).maybeSingle();
  const receipt = op?.receipt_no != null ? String(op.receipt_no) : null;
  return W.line(f.kind, receipt, formatStoredDate(f.created_at, { withYear: false }));
}

/**
 * Bill one recorded fee: a line on the subscription's next invoice, or left for the club's own monthly invoice. Idempotent
 * (Stripe's key is the fee's id, and a billed or exempt row is never billed again). Platform admin's Retry calls this.
 */
export async function billFee(feeId: string): Promise<BillOutcome> {
  const { data } = await supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS).eq('id', feeId).maybeSingle();
  const f = data as FeeRow | null;
  if (!f || f.billed_at || f.exempt_reason || f.fee_invoice_id) return 'done';
  if (f.livemode !== stripeKeyIsLive()) {
    await supabaseAdmin.from('platform_stripe_fees').update({ exempt_reason: 'test_mode', bill_error: null }).eq('id', f.id).is('billed_at', null);
    return 'test_mode';
  }
  try {
    if (isFeeCredit(f.kind)) return await billCredit(f);
    const ride = await subscriptionToRide(f.org_id);
    if (!ride) {
      await supabaseAdmin.from('platform_stripe_fees').update({ bill_error: null }).eq('id', f.id);
      return 'own_invoice';
    }
    await subscriptionLine(f, ride);
    return 'billed';
  } catch (err) {
    // A runner that lost a race to one that billed it writes nothing on the billed row (/review of Part 5b).
    await supabaseAdmin.from('platform_stripe_fees')
      .update({ bill_error: errText(err), bill_attempts: (f.bill_attempts ?? 0) + 1 }).eq('id', f.id).is('billed_at', null);
    return 'error';
  }
}

/**
 * A fee's line on the subscription it rides, read back first (Stripe's key lasts 24 hours, and the next try may be the
 * monthly run weeks later, /review 4b), then stamped billed; a refused stamp throws, so it is never read as billed while
 * the row says otherwise. Keyed by the subscription too: a fee released from one it could no longer ride (ruling 6) and
 * put on a new one within Stripe's 24 hours is never handed the deleted line back. A credit's line rides here too.
 */
async function subscriptionLine(f: FeeRow, ride: { customer: string; subscription: string }): Promise<void> {
  const since = Math.floor(new Date(f.created_at).getTime() / 1000) - 3600;
  const already = (await stripe.invoiceItems.list({ customer: ride.customer, created: { gte: since }, limit: 100 }).autoPagingToArray({ limit: 1000 }))
    .find(i => i.metadata?.platform_stripe_fee_id === f.id);
  const item = already ?? await stripe.invoiceItems.create({
    customer: ride.customer, subscription: ride.subscription, amount: signedCents(f), currency: 'cad', ...RECOVERED_FEE_TAX,
    description: await lineFor(f), metadata: { platform_stripe_fee_id: f.id, org_id: f.org_id },
  }, { idempotencyKey: `stripe-fee:${f.id}:${ride.subscription}` });
  await stampSubscriptionLine(f.id, item.id);
}

/**
 * A RETURNED ANSWERING FEE goes back against the invoice that carried the answering fee (owner ruling 7, 2026-10-27):
 *   - the answering fee not on a finished invoice yet (waiting for the club's own, or a line still pending on the
 *     subscription it rides): the credit joins it and they net on that invoice, as before;
 *   - on a finished invoice: a Stripe credit note on THAT invoice (`creditAgainst`).
 * A credit never waits for a later fee. Throws to `billFee`, which keeps the error on the row for the daily retry.
 */
async function billCredit(f: FeeRow): Promise<BillOutcome> {
  const { data } = await supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS)
    .eq('dispute_id', f.dispute_id ?? '').eq('kind', 'dispute_answer').maybeSingle();
  const answer = data as FeeRow | null;
  const waitWithIt = async () => {
    await supabaseAdmin.from('platform_stripe_fees').update({ bill_error: null }).eq('id', f.id);
    return 'own_invoice' as const;
  };
  if (!answer || answer.exempt_reason) {
    // No answering fee of ours to return it against (a fee Stripe gave back that our reading didn't name as the answering
    // fee): billed as a credit was before ruling 7, a negative line on the next invoice, never left in an error (/review).
    const ride = await subscriptionToRide(f.org_id);
    if (!ride) return waitWithIt();
    await subscriptionLine(f, ride);
    return 'billed';
  }
  if (!answer.billed_at || !answer.stripe_invoice_item_id) return waitWithIt();
  if (answer.billed_on === 'own_invoice') {
    const { data: inv } = await supabaseAdmin.from('platform_fee_invoices').select('stripe_invoice_id').eq('id', answer.fee_invoice_id ?? '').maybeSingle();
    if (!inv?.stripe_invoice_id) throw new Error('The invoice that carried the answering fee wasn’t found.');
    return creditAgainst(f, answer, inv.stripe_invoice_id as string);
  }
  // On a subscription: its line says where it is.
  const line = await readInvoiceItem(answer.stripe_invoice_item_id);
  // Gone, or pending on a subscription the club no longer rides: the daily job returns the answering fee to unbilled
  // (ruling 6) and the two net on the club's own invoice.
  if (!line) return waitWithIt();
  if (!line.invoice) {
    const ride = await subscriptionToRide(f.org_id);
    if (!ride || line.parent?.subscription_details?.subscription !== ride.subscription) return waitWithIt();
    await subscriptionLine(f, ride);
    return 'billed';
  }
  return creditAgainst(f, answer, typeof line.invoice === 'string' ? line.invoice : line.invoice.id!);
}

async function stampSubscriptionLine(feeId: string, itemId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('platform_stripe_fees')
    .update({ stripe_invoice_item_id: itemId, billed_at: new Date().toISOString(), billed_on: 'subscription', bill_error: null })
    .eq('id', feeId).is('billed_at', null);
  if (error) throw error;
}

/**
 * The credit on the invoice that carried the answering fee. Still a draft (a subscription's next invoice, minutes before
 * it is finalized): a negative line on it. Finished: a Stripe credit note, which first lowers what is still owed and
 * leaves the rest to be refunded, credited or marked paid outside Stripe (Stripe, Create a credit note: the
 * `post_payment_amount`) — refunded to the card it was paid with, or to the club's Stripe customer balance past what the
 * card paid. Stripe's own credit-note email is off: the Plan & billing list says it. Once only: read back by its metadata,
 * then stored on the credit's row (unique, mig 399).
 */
async function creditAgainst(f: FeeRow, answer: FeeRow, invoiceId: string): Promise<BillOutcome> {
  const inv = await stripe.invoices.retrieve(invoiceId);
  const cents = -signedCents(f);
  const customer = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? '';
  if (inv.status === 'draft') {
    const already = (await stripe.invoiceItems.list({ invoice: invoiceId, limit: 100 }).autoPagingToArray({ limit: 1000 }))
      .find(i => i.metadata?.platform_stripe_fee_id === f.id);
    const item = already ?? await stripe.invoiceItems.create({
      customer, invoice: invoiceId, amount: signedCents(f), currency: 'cad', ...RECOVERED_FEE_TAX,
      description: await lineFor(f), metadata: { platform_stripe_fee_id: f.id, org_id: f.org_id },
    }, { idempotencyKey: `stripe-fee:${f.id}:${invoiceId}` });
    await stampSubscriptionLine(f.id, item.id);
    return 'billed';
  }
  if (inv.status === 'void') throw new Error('The invoice that carried the answering fee was voided.');
  const { data: now } = await supabaseAdmin.from('platform_stripe_fees').select('billed_at, fee_invoice_id').eq('id', f.id).maybeSingle();
  if (!now || now.billed_at || now.fee_invoice_id) return 'done'; // billed or claimed meanwhile by another runner
  const notes = await stripe.creditNotes.list({ invoice: invoiceId, limit: 100 }).autoPagingToArray({ limit: 1000 });
  let note = notes.find(n => n.metadata?.platform_stripe_fee_id === f.id) ?? null;
  if (!note) {
    // Against the answering fee's own line where Stripe shows it (Stripe recommends it), else as a line of its own — but never
    // on a taxed invoice: Stripe refuses a custom line there, and only the fee's own line reverses its tax (verified 2026-11-05).
    const lines = await stripe.invoices.listLineItems(invoiceId, { limit: 100 }).autoPagingToArray({ limit: 1000 });
    const carried = lines.find(l => l.parent?.invoice_item_details?.invoice_item === answer.stripe_invoice_item_id);
    if (!carried && inv.automatic_tax?.enabled) throw new Error('The answering fee’s line wasn’t found on its taxed invoice, so its tax can’t be credited.');
    const params: Stripe.CreditNoteCreateParams = {
      invoice: invoiceId,
      lines: [carried
        ? { type: 'invoice_line_item', invoice_line_item: carried.id, amount: cents }
        : { type: 'custom_line_item', description: await lineFor(f), quantity: 1, unit_amount: cents }],
      email_type: 'none',
      metadata: { platform_stripe_fee_id: f.id, org_id: f.org_id },
    };
    // The note's total is the credit plus the tax Stripe reverses with it (a line's `amount` is before tax), so it is asked
    // of Stripe, never worked out here. What still is owed takes it first; the rest goes back to the card, as far as the
    // card paid, and anything past that to the club's Stripe balance.
    const total = inv.automatic_tax?.enabled ? (await stripe.creditNotes.preview(params)).total : cents;
    const owed = inv.status === 'paid' ? 0 : Math.max(0, inv.amount_remaining);
    const after = Math.max(0, total - owed);
    const refund = Math.min(after, Math.max(0, inv.amount_paid));
    if (refund > 0) params.refund_amount = refund;
    if (after - refund > 0) params.credit_amount = after - refund;
    note = await stripe.creditNotes.create(params, { idempotencyKey: `fee-credit:${f.id}` });
  }
  // GST/HST Stage 3: the note's tax record now (the credit-note event writes the same row, keyed by the note). Never throws.
  const madeNote = note;
  await recordTaxOrReport({ kind: 'credit_note', id: madeNote.id }, () => recordCreditNoteTax(madeNote.id));
  const { error } = await supabaseAdmin.from('platform_stripe_fees')
    .update({ stripe_credit_note_id: note.id, billed_at: new Date().toISOString(), billed_on: 'credit_note', bill_error: null })
    .eq('id', f.id).is('billed_at', null).is('fee_invoice_id', null);
  if (error) throw error;
  // The club's own invoice reads its new amount owed (or paid) at once, not at the next re-read.
  const ownRow = inv.metadata?.[FEE_INVOICE_META];
  if (ownRow) await writeInvoiceState(ownRow, await stripe.invoices.retrieve(invoiceId));
  return 'billed';
}

// ── The club's own monthly invoice ──────────────────────────────────────────────────────────────

type InvoiceRow = {
  id: string; org_id: string; livemode: boolean; period_start: string; stripe_customer_id: string; stripe_invoice_id: string | null;
  invoice_number: string | null; status: string; amount_due: number | null; hosted_invoice_url: string | null; due_at: string | null;
  finalized_at: string | null; emailed_at: string | null; reminded_at: string | null; paid_at: string | null;
  /** Migration 444: Stripe's invoice total (tax included) and its named tax lines [{ label, cents }]; null until first synced after it. */
  total: number | null; tax_lines: Array<{ label: string; cents: number }> | null;
};
const INVOICE_COLUMNS = 'id, org_id, livemode, period_start, stripe_customer_id, stripe_invoice_id, invoice_number, status, amount_due, hosted_invoice_url, due_at, finalized_at, emailed_at, reminded_at, paid_at, total, tax_lines';

/** The 1st this month (org zone) as an instant, and the month the invoice sent on it bills. */
export function feeInvoicePeriod(now: Date = new Date()): { cutoff: string; periodStart: string; firstOfThis: string } {
  const firstOfThis = `${orgMonthKey(now.toISOString())}-01`;
  return { cutoff: zonedWallClockToUtc(firstOfThis, '00:00')!, periodStart: addCalendarMonths(firstOfThis, -1), firstOfThis };
}

/**
 * THE MONTHLY INVOICE (owner 2026-10-27: one a month, sent on the 1st). Every fee recorded before this month's 1st that no
 * subscription invoice took is gathered on one invoice per club, finalized with Stripe's own email off, and emailed by us.
 * Decided from the rows on every run, so a run that stopped part-way finishes on the next one and nothing is billed twice
 * (one invoice per club and month; one line per fee, read back from Stripe before adding). A month whose credit cancels its
 * answering fee is finalized at nothing owed and sends no email.
 */
export async function sendMonthlyFeeInvoices(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
  const live = stripeKeyIsLive();
  const { cutoff, periodStart } = feeInvoicePeriod(now);
  const { data } = await supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS)
    .is('billed_at', null).is('exempt_reason', null).eq('livemode', live).lt('created_at', cutoff)
    .order('created_at').limit(1000);
  const byOrg = new Map<string, FeeRow[]>();
  for (const f of (data ?? []) as FeeRow[]) byOrg.set(f.org_id, [...(byOrg.get(f.org_id) ?? []), f]);
  let sent = 0; let failed = 0;
  for (const [orgId, fees] of byOrg) {
    try {
      if (await invoiceOneClub(orgId, fees, periodStart, live)) sent += 1;
    } catch (err) {
      failed += 1;
      console.error('[platform-stripe-fees] the monthly invoice failed:', orgId, errText(err));
      await supabaseAdmin.from('platform_fee_invoices').update({ send_error: errText(err), updated_at: new Date().toISOString() })
        .eq('org_id', orgId).eq('livemode', live).eq('period_start', periodStart).neq('status', 'paid');
    }
  }
  // An invoice that went out but whose email failed is emailed by the next run, whether or not its club has a new fee
  // (/review 4b: only a club with an unbilled fee was visited, and the reminder waits on the first email).
  const { data: unsent } = await supabaseAdmin.from('platform_fee_invoices').select('id')
    .eq('status', 'open').eq('livemode', live).is('emailed_at', null).limit(200);
  for (const r of (unsent ?? []) as Array<{ id: string }>) await emailFeeInvoice(r.id);
  return { sent, failed };
}

async function invoiceOneClub(orgId: string, candidates: FeeRow[], periodStart: string, live: boolean): Promise<boolean> {
  // A fee not yet on any invoice may ride a subscription the club has since started; the rest gather here. A fee already
  // claimed by this month's draft (a run that stopped part-way) is finished with it.
  const fees: FeeRow[] = [];
  for (const f of candidates) {
    if (f.fee_invoice_id) { fees.push(f); continue; }
    const outcome = await billFee(f.id);
    if (outcome === 'own_invoice') fees.push(f);
  }
  let row = await invoiceRow(orgId, live, periodStart);
  // A fee claimed by an EARLIER month's invoice that a run left unfinished is finished with that invoice, never moved.
  for (const id of new Set(fees.map(f => f.fee_invoice_id).filter((x): x is string => !!x && x !== row?.id))) {
    const { data: earlier } = await supabaseAdmin.from('platform_fee_invoices').select(INVOICE_COLUMNS).eq('id', id).maybeSingle();
    if (earlier) await completeInvoice(earlier as InvoiceRow, fees.filter(f => f.fee_invoice_id === id), false);
  }
  if (row && row.status !== 'draft') {
    // This month's invoice already went: its own lines are finished with it (stamped, emailed); anything new waits.
    await completeInvoice(row, fees.filter(f => f.fee_invoice_id === row!.id), false);
    return false;
  }
  const ours = fees.filter(f => !f.fee_invoice_id || f.fee_invoice_id === row?.id);
  // A credit is here only beside the answering fee it returns (ruling 7), so the two net; when they cancel out, the
  // invoice is finalized at nothing owed (Stripe marks it paid, and no email goes), never left waiting for a later fee.
  if (!ours.length || ours.reduce((s, f) => s + signedCents(f), 0) < 0) return false;

  const { data: org } = await supabaseAdmin.from('organizations').select('id, name, stripe_customer_id, account_kind').eq('id', orgId).maybeSingle();
  if (!org) return false;
  // The invoice is taxed by the club's address, so the customer carries the one on our records (and the club's name); Stripe
  // refuses to finalize a taxed invoice it cannot place. A club with no address anywhere (a comped or free club that never
  // bought) waits: its fees stay unbilled with a plain reason platform admin shows, and go out on the first run after it has one.
  const location = await clubBillingLocation(orgId, org.name as string);
  const existingCustomer = (org.stripe_customer_id as string | null) ?? null;
  if (!(await placeable(location, existingCustomer))) {
    await supabaseAdmin.from('platform_stripe_fees').update({ bill_error: NO_ADDRESS })
      .in('id', ours.map(f => f.id)).is('billed_at', null);
    return false;
  }
  const customer = await ensureStripeCustomer(
    { id: orgId, stripeCustomerId: existingCustomer, accountKind: (org.account_kind as string | null) ?? null },
    await getOrgOwnerEmail(orgId), location, org.name as string,
  );
  if (!row) {
    const { error } = await supabaseAdmin.from('platform_fee_invoices')
      .insert({ org_id: orgId, livemode: live, period_start: periodStart, stripe_customer_id: customer });
    if (error && error.code !== '23505') throw error;
    row = await invoiceRow(orgId, live, periodStart);
    if (!row) throw new Error('The invoice row wasn’t written.');
  }

  if (!row.stripe_invoice_id) {
    // A run that created the invoice but stopped before storing it finds it by our metadata (Stripe's key lasts 24 hours).
    const found = (await stripe.invoices.list({ customer: row.stripe_customer_id, status: 'draft', limit: 100 }))
      .data.find(i => i.metadata?.[FEE_INVOICE_META] === row!.id);
    const inv = found ?? await stripe.invoices.create({
      customer: row.stripe_customer_id, collection_method: 'send_invoice', days_until_due: FEE_INVOICE_DAYS_DUE, auto_advance: false,
      pending_invoice_items_behavior: 'exclude', currency: 'cad', automatic_tax: AUTOMATIC_TAX,
      description: W.memo(org.name as string), footer: W.footer(PLATFORM_CONTACT_EMAIL),
      metadata: { [FEE_INVOICE_META]: row.id, org_id: orgId },
    }, { idempotencyKey: `fee-invoice:${row.id}` });
    await supabaseAdmin.from('platform_fee_invoices').update({ stripe_invoice_id: inv.id!, updated_at: new Date().toISOString() }).eq('id', row.id);
    row = { ...row, stripe_invoice_id: inv.id! };
  }
  return completeInvoice(row, ours, true);
}

/** Platform admin's reason on a fee that waits for the club's address (operator words; the club is not emailed). */
// Part 2b (owner, 2026-11-05): only the Payouts card is named. Plan & billing shows its Billing address button once an address
// is on file, so a club with none cannot add one there; every club this holds is connected, and its Payouts card asks.
const NO_ADDRESS = 'The club has no billing address on file, so the tax on its invoice can’t be worked out. Its fees go out on the first monthly invoice after it adds one on its Payouts card.';

async function clubBillingLocation(orgId: string, name: string): Promise<BillingLocation | null> {
  const stored = await readBillingLocation({ kind: 'org', orgId, name });
  return stored ? storedLocationStillValid(stored, usSalesOpen()) : null;
}

/** THE test the fee invoice waits on: an address on our records, or (failing that) one on the club's Stripe customer. */
async function placeable(location: BillingLocation | null, customerId: string | null): Promise<boolean> {
  return !!location || (!!customerId && await customerHasAddress(customerId));
}

/**
 * GST/HST Stage 2 Part 2b (owner ruling A): whether this club's fee invoice could be made today, by the same test
 * `invoiceOneClub` waits on, so the Payouts card's "add your billing address" line shows exactly while the fees would wait.
 */
export async function clubFeeInvoicePlaceable(org: { id: string; name: string; stripeCustomerId?: string | null }): Promise<boolean> {
  return placeable(await clubBillingLocation(org.id, org.name), org.stripeCustomerId ?? null);
}

async function customerHasAddress(customerId: string): Promise<boolean> {
  if (customerId.startsWith('mock_')) return false;
  const c = await stripe.customers.retrieve(customerId);
  return !('deleted' in c && c.deleted) && !!(c as Stripe.Customer).address?.country;
}

/**
 * Finish one invoice from Stripe's own state, so a run that stopped at any step finishes on the next (/review 4b: a fee
 * was stamped billed as its line went on, so a run that stopped before the finalize or the email left the club out of
 * every later run). A draft takes its lines (one per fee, read back first; `mayAdd` lets it claim a fee no invoice has),
 * is finalized with Stripe's own email off, and only then are its fees stamped billed; an invoice already finalized takes
 * no new line and is never finalized twice. Then our email, once. True when this call finalized it.
 */
async function completeInvoice(row: InvoiceRow, fees: FeeRow[], mayAdd: boolean): Promise<boolean> {
  const invoiceId = row.stripe_invoice_id;
  if (!invoiceId) return false;
  let inv = await stripe.invoices.retrieve(invoiceId);
  const draft = inv.status === 'draft';
  const existing = await stripe.invoiceItems.list({ invoice: invoiceId, limit: 100 }).autoPagingToArray({ limit: 10000 });
  const onInvoice = new Map(existing.map(i => [i.metadata?.platform_stripe_fee_id ?? '', i.id]));
  // The line each fee rides, stamped with it once the invoice is finalized: the table holds a line id only on a billed
  // fee (`platform_stripe_fees_billed_chk`), so storing it earlier was refused and no own-invoice fee was ever stamped.
  const lineOf = new Map<string, string>();
  for (const f of fees) {
    if (f.fee_invoice_id !== row.id) {
      if (!draft || !mayAdd) continue;
      // The claim is what keeps `billFee` off this fee; a fee another runner took meanwhile is left to it.
      const { data: claimed, error: claimError } = await supabaseAdmin.from('platform_stripe_fees').update({ fee_invoice_id: row.id })
        .eq('id', f.id).is('billed_at', null).is('fee_invoice_id', null).select('id');
      if (claimError) throw claimError;
      if (!claimed?.length) continue;
    }
    let itemId = onInvoice.get(f.id) ?? null;
    if (!itemId && !draft) {
      // Claimed but never put on an invoice that has since gone: released to next month's.
      await supabaseAdmin.from('platform_stripe_fees').update({ fee_invoice_id: null }).eq('id', f.id).is('billed_at', null).eq('fee_invoice_id', row.id);
      continue;
    }
    if (!itemId) {
      itemId = (await stripe.invoiceItems.create({
        customer: row.stripe_customer_id, invoice: invoiceId, amount: signedCents(f), currency: 'cad', ...RECOVERED_FEE_TAX,
        description: await lineFor(f), metadata: { platform_stripe_fee_id: f.id, org_id: row.org_id },
      }, { idempotencyKey: `stripe-fee:${f.id}:${invoiceId}` })).id;
    }
    lineOf.set(f.id, itemId);
  }
  if (draft && !lineOf.size) return false;

  // Finalized with Stripe's own email off (auto_advance false, never sendInvoice): the email is ours.
  if (draft) inv = await stripe.invoices.finalizeInvoice(invoiceId, { auto_advance: false });
  await writeInvoiceState(row.id, inv);
  const billedAt = new Date().toISOString();
  for (const [feeId, itemId] of lineOf) {
    const { error: stampError } = await supabaseAdmin.from('platform_stripe_fees')
      .update({ stripe_invoice_item_id: itemId, billed_at: billedAt, billed_on: 'own_invoice', bill_error: null })
      .eq('id', feeId).eq('fee_invoice_id', row.id).is('billed_at', null);
    if (stampError) throw stampError;
  }
  await emailFeeInvoice(row.id);
  return draft;
}

async function invoiceRow(orgId: string, live: boolean, periodStart: string): Promise<InvoiceRow | null> {
  const { data } = await supabaseAdmin.from('platform_fee_invoices').select(INVOICE_COLUMNS)
    .eq('org_id', orgId).eq('livemode', live).eq('period_start', periodStart).maybeSingle();
  return data as InvoiceRow | null;
}

const STRIPE_STATUS: Record<string, InvoiceRow['status']> = { draft: 'draft', open: 'open', paid: 'paid', void: 'void', uncollectible: 'uncollectible' };
const iso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null);

/** Stripe's invoice, as our row holds it (the finalize, the billing webhook and the daily job's re-read all write here). */
async function writeInvoiceState(rowId: string, inv: Stripe.Invoice): Promise<void> {
  const status = STRIPE_STATUS[inv.status ?? ''] ?? 'open';
  const paidAt = status === 'paid' ? (iso(inv.status_transitions?.paid_at) ?? new Date().toISOString()) : null;
  // The named tax lines for Plan & billing's invoice row (migration 444). A failed name lookup leaves the stored lines as they were:
  // the state write below must never fail over a label.
  let taxLines: Array<{ label: string; cents: number }> | null = null;
  try { taxLines = await namedTaxLines(inv.total_taxes, id => stripe.taxRates.retrieve(id)); } catch (err) { console.error('[platform-stripe-fees] the tax names failed:', rowId, errText(err)); }
  await supabaseAdmin.from('platform_fee_invoices').update({
    status, invoice_number: inv.number ?? null, amount_due: (inv.amount_due ?? 0) / 100, hosted_invoice_url: inv.hosted_invoice_url ?? null,
    total: (inv.total ?? 0) / 100, ...(taxLines ? { tax_lines: taxLines } : {}),
    due_at: iso(inv.due_date), finalized_at: iso(inv.status_transitions?.finalized_at) ?? (status === 'draft' ? null : new Date().toISOString()),
    paid_at: paidAt, send_error: null, updated_at: new Date().toISOString(),
  }).eq('id', rowId);
}

/** The billing webhook's door: a fee invoice's event (recognised by its metadata) is written here and nowhere else, so
 *  it never touches the club's subscription status. Returns whether the invoice was a fee invoice. */
export async function syncFeeInvoiceFromEvent(inv: Stripe.Invoice): Promise<boolean> {
  const rowId = inv.metadata?.[FEE_INVOICE_META];
  if (!rowId) return false;
  // The event's copy may be older than Stripe's; re-read it.
  const fresh = inv.id ? await stripe.invoices.retrieve(inv.id) : inv;
  await writeInvoiceState(rowId, fresh);
  return true;
}

/** The daily job's re-read of every invoice still open, so a missed event never leaves one unpaid on our side. */
export async function syncOpenFeeInvoices(): Promise<void> {
  const { data } = await supabaseAdmin.from('platform_fee_invoices').select('id, stripe_invoice_id')
    .eq('status', 'open').eq('livemode', stripeKeyIsLive()).not('stripe_invoice_id', 'is', null).limit(500);
  for (const r of (data ?? []) as Array<{ id: string; stripe_invoice_id: string }>) {
    try { await writeInvoiceState(r.id, await stripe.invoices.retrieve(r.stripe_invoice_id)); }
    catch (err) { console.error('[platform-stripe-fees] couldn’t re-read the invoice:', r.id, errText(err)); }
  }
}

async function invoiceLines(rowId: string): Promise<Array<{ kind: StripeFeeKind; line: string; cents: number }>> {
  const { data } = await supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS).eq('fee_invoice_id', rowId).order('created_at');
  const fees = (data ?? []) as FeeRow[];
  return Promise.all(fees.map(async f => ({ kind: f.kind, line: await lineFor(f), cents: signedCents(f) })));
}

/** Our email for the invoice (words §1.7), once: sent under a once-only key, then stamped. */
async function emailFeeInvoice(rowId: string): Promise<void> {
  const { data } = await supabaseAdmin.from('platform_fee_invoices').select(INVOICE_COLUMNS).eq('id', rowId).maybeSingle();
  const row = data as InvoiceRow | null;
  if (!row || row.emailed_at || row.status !== 'open' || !row.hosted_invoice_url) return;
  try {
    const [to, { data: org }, lines, inv] = await Promise.all([
      getOrgOwnerEmail(row.org_id),
      supabaseAdmin.from('organizations').select('name').eq('id', row.org_id).maybeSingle(),
      invoiceLines(row.id),
      row.stripe_invoice_id ? stripe.invoices.retrieve(row.stripe_invoice_id) : Promise.resolve(null),
    ]);
    if (!to) throw new Error('The club has no owner email.');
    const club = (org?.name as string | null) ?? '';
    const amount = money(Number(row.amount_due ?? 0));
    // Stage 2: what Stripe charged us is the invoice BEFORE tax; the tax is ours, by name, between the lines and the total.
    const taxes = inv ? await namedTaxLines(inv.total_taxes, id => stripe.taxRates.retrieve(id)) : [];
    const fee = inv ? money(inv.subtotal / 100) : amount;
    const dueFull = formatStoredDate(row.due_at, { withYear: true });
    const test = !row.livemode;
    const subject = `${test ? E.testPrefix : ''}${W.emailSubject(row.invoice_number ?? '', club)}`;
    const html = warmEmailDocument([
      `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(W.emailPreheader(fee, dueFull))}</div>`,
      warmEmailParagraph(escapeHtml(W.emailLead(fee, club, lines.length === 1))),
      emailFactsPanel([
        ...lines.map(l => [l.line, l.cents < 0 ? W.credit(money(-l.cents / 100)) : money(l.cents / 100)] as const),
        ...taxes.map(t => [t.label, money(t.cents / 100)] as const),
        [W.total, amount] as const,
        [W.due, dueFull] as const,
      ]),
      warmEmailParagraph(escapeHtml(W.emailWhy([...new Set(lines.map(l => l.kind))]))),
      warmEmailButton(W.emailButton, row.hosted_invoice_url),
      warmEmailSmall(escapeHtml(W.emailSecure)),
      warmEmailSmall(escapeHtml(W.emailQuestions(PLATFORM_CONTACT_EMAIL))),
      test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
    ].filter(Boolean).join('\n'));
    const sent = await sendEmail(to, subject, html, { kind: 'stripe_fee_invoice', orgId: row.org_id, idempotencyKey: `fee-invoice-email:${row.id}` });
    if (sent.status !== 'sent') throw new Error(`The email was ${sent.status}.`);
    await supabaseAdmin.from('platform_fee_invoices').update({ emailed_at: new Date().toISOString(), send_error: null }).eq('id', row.id).is('emailed_at', null);
  } catch (err) {
    await supabaseAdmin.from('platform_fee_invoices').update({ send_error: errText(err) }).eq('id', row.id);
  }
}

/** The one reminder on an unpaid invoice past its due date (§7 ruling 3). Nothing switches off; nothing says it will. */
export async function remindUnpaidFeeInvoices(now: Date = new Date()): Promise<number> {
  const { data } = await supabaseAdmin.from('platform_fee_invoices').select(INVOICE_COLUMNS)
    .eq('status', 'open').eq('livemode', stripeKeyIsLive()).is('reminded_at', null).not('emailed_at', 'is', null)
    .lt('due_at', now.toISOString()).limit(200);
  let n = 0;
  for (const row of (data ?? []) as InvoiceRow[]) {
    if (!row.hosted_invoice_url) continue;
    try {
      const to = await getOrgOwnerEmail(row.org_id);
      if (!to) continue;
      const amount = money(Number(row.amount_due ?? 0));
      const test = !row.livemode;
      const html = warmEmailDocument([
        warmEmailParagraph(escapeHtml(W.reminderLead(row.invoice_number ?? '', amount, formatStoredDate(row.due_at, { withYear: true })))),
        warmEmailButton(W.emailButton, row.hosted_invoice_url),
        warmEmailSmall(escapeHtml(W.emailQuestions(PLATFORM_CONTACT_EMAIL))),
        test ? warmEmailSmall(escapeHtml(E.testNote)) : '',
      ].filter(Boolean).join('\n'));
      const sent = await sendEmail(to, `${test ? E.testPrefix : ''}${W.reminderSubject(row.invoice_number ?? '')}`, html,
        { kind: 'stripe_fee_invoice_reminder', orgId: row.org_id, idempotencyKey: `fee-invoice-reminder:${row.id}` });
      if (sent.status !== 'sent') continue;
      await supabaseAdmin.from('platform_fee_invoices').update({ reminded_at: new Date().toISOString() }).eq('id', row.id).is('reminded_at', null);
      n += 1;
    } catch (err) {
      console.error('[platform-stripe-fees] the reminder failed:', row.id, errText(err));
    }
  }
  return n;
}

/**
 * The daily job's re-read of recent disputes for a fee Stripe charged FieldLogicHQ after the events stopped (an answering
 * fee, or its return on a win, can post days later): card disputes opened or closed in the last 60 days whose fee wasn't
 * the club's, bank debits reversed in that time, and bank debits returned in the last two weeks with no fee yet (ruling
 * 3: usually Stripe charges nothing, so each is read at most fourteen times). Each
 * kind is written once, so a rerun records nothing twice.
 */
export async function sweepDisputeFees(now: Date = new Date()): Promise<void> {
  const since = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const live = stripeKeyIsLive();
  const twoWeeks = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [{ data: disputes }, { data: debits }, { data: returned }] = await Promise.all([
    supabaseAdmin.from('online_payment_disputes')
      .select('id, org_id, online_payment_id, stripe_dispute_id, fee_paid_from, livemode, closed_at')
      .eq('livemode', live).gte('opened_at', new Date(now.getTime() - 240 * 86_400_000).toISOString())
      .or('fee_paid_from.is.null,fee_paid_from.eq.platform').order('opened_at', { ascending: false }).limit(500),
    supabaseAdmin.from('online_payments').select('id, org_id, stripe_dispute_id, livemode')
      .eq('rail', 'bank_debit').eq('status', 'reversed').eq('livemode', live).gte('reversed_at', since)
      .not('stripe_dispute_id', 'is', null).limit(500),
    supabaseAdmin.from('online_payments').select('id')
      .eq('rail', 'bank_debit').eq('status', 'returned').eq('livemode', live).gte('returned_at', twoWeeks).limit(500),
  ]);
  for (const d of (disputes ?? []) as Array<{ id: string; org_id: string; online_payment_id: string; stripe_dispute_id: string; livemode: boolean; closed_at: string | null }>) {
    if (d.closed_at && d.closed_at < since) continue;
    await recordDisputeFees({ orgId: d.org_id, onlinePaymentId: d.online_payment_id, rail: 'card', stripeDisputeId: d.stripe_dispute_id, disputeId: d.id, livemode: d.livemode });
  }
  for (const o of (debits ?? []) as Array<{ id: string; org_id: string; stripe_dispute_id: string; livemode: boolean }>) {
    await recordDisputeFees({ orgId: o.org_id, onlinePaymentId: o.id, rail: 'bank_debit', stripeDisputeId: o.stripe_dispute_id, disputeId: null, livemode: o.livemode });
  }
  // A returned debit whose fee is recorded has nothing more to read.
  const returnedIds = ((returned ?? []) as Array<{ id: string }>).map(o => o.id);
  if (!returnedIds.length) return;
  const { data: feeRows } = await supabaseAdmin.from('platform_stripe_fees').select('online_payment_id').eq('kind', 'returned').in('online_payment_id', returnedIds);
  const recorded = new Set(((feeRows ?? []) as Array<{ online_payment_id: string }>).map(r => r.online_payment_id));
  for (const id of returnedIds) if (!recorded.has(id)) await recordReturnedDebitFee(id);
}

/** Stripe's invoice item, or null once Stripe no longer has it (deleted). */
async function readInvoiceItem(id: string): Promise<Stripe.InvoiceItem | null> {
  try {
    const item = await stripe.invoiceItems.retrieve(id);
    return (item as { deleted?: boolean }).deleted ? null : item;
  } catch (err) {
    if ((err as { code?: string }).code === 'resource_missing') return null;
    throw err;
  }
}

/**
 * A fee left on a subscription that can no longer carry it (owner ruling 6, 2026-10-27; the /review of 12d-1's Low): put
 * on a subscription that was then cancelled, discounted, moved off Canadian dollars or replaced before its invoice, the
 * line stays pending in Stripe and no invoice takes it (ours exclude pending lines). The daily job reads each such line,
 * deletes it while it is still pending, reads it again, and only then returns the fee to unbilled, so the club's own
 * monthly invoice bills it once, never twice. A line already on an invoice is that invoice's and is left alone. Runs
 * before the monthly invoice. A yearly plan's line can wait up to a year, so a year and a month are read.
 */
export async function releaseStrandedSubscriptionFees(now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 400 * 86_400_000).toISOString();
  const { data } = await supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS)
    .eq('billed_on', 'subscription').eq('livemode', stripeKeyIsLive()).gte('billed_at', since)
    .order('billed_at', { ascending: true }).limit(1000);
  const rides = new Map<string, Promise<{ customer: string; subscription: string } | null>>();
  let released = 0;
  for (const f of (data ?? []) as FeeRow[]) {
    const itemId = f.stripe_invoice_item_id;
    if (!itemId) continue;
    try {
      const before = await readInvoiceItem(itemId);
      if (before?.invoice) continue; // on an invoice: billed there
      if (before) {
        if (!rides.has(f.org_id)) rides.set(f.org_id, subscriptionToRide(f.org_id));
        const ride = await rides.get(f.org_id)!;
        const on = before.parent?.subscription_details?.subscription ?? null;
        if (ride && (!on || on === ride.subscription)) continue; // still rides (or Stripe didn't say: left alone)
        await stripe.invoiceItems.del(itemId);
        // Read again: a line Stripe put on an invoice in the meantime stays billed there.
        if (await readInvoiceItem(itemId)) continue;
      }
      const { error } = await supabaseAdmin.from('platform_stripe_fees')
        .update({ stripe_invoice_item_id: null, billed_at: null, billed_on: null, bill_error: null })
        .eq('id', f.id).eq('billed_on', 'subscription').eq('stripe_invoice_item_id', itemId);
      if (error) throw error;
      released += 1;
    } catch (err) {
      console.error('[platform-stripe-fees] a pending subscription line wasn’t released:', f.id, errText(err));
    }
  }
  return released;
}

/** The daily job's retry of every fee whose billing failed (a passing Stripe error), a few times before a person looks. */
export async function retryFailedFees(): Promise<number> {
  const { data } = await supabaseAdmin.from('platform_stripe_fees').select('id')
    .is('billed_at', null).is('exempt_reason', null).is('fee_invoice_id', null).not('bill_error', 'is', null)
    .lt('bill_attempts', 5).limit(200);
  // A credit is tried again every day, error or not (ruling 7: it never waits for a later fee): one whose answering fee
  // was still being billed when it was recorded is credited the next day, not on the next 1st.
  const { data: credits } = await supabaseAdmin.from('platform_stripe_fees').select('id')
    .eq('kind', 'dispute_answer_returned').is('billed_at', null).is('exempt_reason', null).is('fee_invoice_id', null)
    .is('bill_error', null).limit(200);
  let n = 0;
  for (const r of [...(data ?? []), ...(credits ?? [])] as Array<{ id: string }>) if ((await billFee(r.id)) === 'billed') n += 1;
  return n;
}

// ── Reading ─────────────────────────────────────────────────────────────────────────────────────

export type ClubFeeView = {
  id: string; kind: StripeFeeKind; line: string; createdAt: string; amount: number; credit: boolean; source: 'stripe' | 'rate';
  /** How it is billed, as the reader's sentence's key. */
  state: 'next' | 'waiting' | 'own_open' | 'own_paid' | 'own_overdue' | 'credit' | 'returned' | 'test' | 'error' | 'legacy_exempt';
  invoiceNo: string | null; invoiceDay: string | null; payUrl: string | null; billError: string | null; billedAt: string | null;
};

/**
 * A club's Stripe fees, newest first, for Settings › Plan & billing (the owner) and platform admin's panel. Starts from
 * the small table (the club's own fees) and reads the newest `limit`, plus every fee under a still-open invoice however old (Fee
 * invoice alerts Part 4), so the list can run past `limit`; a failure reads as an empty list on the screen's side.
 */
export async function readClubFees(orgId: string, opts: { limit?: number; now?: Date } = {}): Promise<ClubFeeView[]> {
  return (await readClubFeesAndInvoices(orgId, opts)).fees;
}

/** One of the club's own fee invoices as Plan & billing's invoice row draws it (owner drawings 2026-11-05). `total` is Stripe's, tax
 *  included; `taxLines` are Stripe's own names in dollars, so the fee lines plus these add up to `total`. */
export type ClubFeeInvoiceView = {
  invoiceNo: string; state: 'own_open' | 'own_overdue' | 'own_paid'; day: string | null;
  total: number | null; taxLines: Array<{ label: string; amount: number }>; payUrl: string | null;
};

const cents = (dollars: number) => Math.round(dollars * 100);

/** The most open invoices, and the most fees under them, the read will fetch beyond its window (a club has a handful at most). */
const OPEN_INVOICE_CAP = 200;
const OPEN_FEE_CAP = 500;

/** The fees and, beside them, the invoices they sit on. Never a total on a fee line: several fees share one invoice. */
export async function readClubFeesAndInvoices(
  orgId: string, opts: { limit?: number; now?: Date } = {},
): Promise<{ fees: ClubFeeView[]; invoices: ClubFeeInvoiceView[] }> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 50;
  const [{ data, error }, { data: openData, error: openError }] = await Promise.all([
    supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS)
      .eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit),
    // Fee invoice alerts Part 4 (Q5, owner 2026-11-05): every invoice the club still owes is in the answer, however old its fees are —
    // the pinned banner and the door's count read the invoices table, so the page the banner points at must show what they count.
    supabaseAdmin.from('platform_fee_invoices').select('id')
      .eq('org_id', orgId).eq('livemode', stripeKeyIsLive()).eq('status', FEE_INVOICE_OWED_STATUS).limit(OPEN_INVOICE_CAP),
  ]);
  if (error) throw error;
  if (openError) throw openError;
  const windowFees = (data ?? []) as FeeRow[];
  const openIds = new Set(((openData ?? []) as Array<{ id: string }>).map(i => i.id));
  // The window may have cut an open invoice's fees off (it can only have when it came back full): fetch every fee under those invoices.
  let fees = windowFees;
  let extraCapped = false;
  if (openIds.size && windowFees.length >= limit) {
    const { data: extra, error: extraError } = await supabaseAdmin.from('platform_stripe_fees').select(FEE_COLUMNS)
      .eq('org_id', orgId).in('fee_invoice_id', [...openIds]).order('created_at', { ascending: false }).limit(OPEN_FEE_CAP);
    if (extraError) throw extraError;
    extraCapped = (extra?.length ?? 0) >= OPEN_FEE_CAP;
    const byId = new Map([...windowFees, ...((extra ?? []) as FeeRow[])].map(f => [f.id, f] as const));
    fees = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  if (!fees.length) return { fees: [], invoices: [] };
  const invIds = [...new Set(fees.map(f => f.fee_invoice_id).filter((x): x is string => !!x))];
  const opIds = [...new Set(fees.map(f => f.online_payment_id))];
  const [{ data: invData }, { data: opData }] = await Promise.all([
    invIds.length ? supabaseAdmin.from('platform_fee_invoices').select(INVOICE_COLUMNS).eq('org_id', orgId).in('id', invIds) : Promise.resolve({ data: [] }),
    supabaseAdmin.from('online_payments').select('id, receipt_no').in('id', opIds),
  ]);
  const invs = new Map(((invData ?? []) as InvoiceRow[]).map(i => [i.id, i]));
  // A fee still waiting goes on the invoice sent on the next 1st.
  const nextFirst = addCalendarMonths(feeInvoicePeriod(now).firstOfThis, 1);
  const receipts = new Map(((opData ?? []) as Array<{ id: string; receipt_no: number | null }>).map(o => [o.id, o.receipt_no]));
  const views = fees.map(f => {
    const inv = f.fee_invoice_id ? invs.get(f.fee_invoice_id) : undefined;
    const receipt = receipts.get(f.online_payment_id);
    let state: ClubFeeView['state'];
    if (f.exempt_reason === 'test_mode') state = 'test';
    else if (f.exempt_reason) state = 'legacy_exempt';
    else if (f.bill_error && !f.billed_at) state = 'error';
    // Ruling 7: a credit note returned it against the answering fee's invoice, on its day (never "next 1st").
    else if (f.billed_on === 'credit_note') state = 'returned';
    else if (inv && inv.status === 'paid') state = 'own_paid';
    else if (inv && inv.status === 'open') state = inv.due_at && inv.due_at < now.toISOString() ? 'own_overdue' : 'own_open';
    else if (f.billed_on === 'subscription') state = isFeeCredit(f.kind) ? 'credit' : 'next';
    else state = 'waiting';
    return {
      id: f.id, kind: f.kind, line: W.line(f.kind, receipt != null ? String(receipt) : null, formatStoredDate(f.created_at, { withYear: false })),
      createdAt: f.created_at, amount: Number(f.amount), credit: isFeeCredit(f.kind), source: f.amount_source, state,
      invoiceNo: inv?.invoice_number ?? null,
      invoiceDay: state === 'returned' ? f.billed_at : inv ? (inv.status === 'paid' ? inv.paid_at : inv.due_at) : state === 'waiting' ? nextFirst : null,
      payUrl: inv && inv.status === FEE_INVOICE_OWED_STATUS ? httpsOnly(inv.hosted_invoice_url) : null,
      billError: f.bill_error, billedAt: f.billed_at,
    } satisfies ClubFeeView;
  });

  // One summary per own invoice that carries a fee in the list. A row from before migration 444 has no total of its own: it reads
  // amount_due, and a missing tax line is the plain difference between that total and its fees (named "Tax"), until the daily
  // re-read writes Stripe's names. Signed: a credit lowers the invoice.
  const invoices: ClubFeeInvoiceView[] = [];
  for (const inv of invs.values()) {
    if (!inv.invoice_number || (inv.status !== 'open' && inv.status !== 'paid')) continue;
    const mine = views.filter(v => v.invoiceNo === inv.invoice_number && (v.state === 'own_open' || v.state === 'own_overdue' || v.state === 'own_paid'));
    if (!mine.length) continue;
    const total = inv.total ?? inv.amount_due;
    let taxLines = Array.isArray(inv.tax_lines) ? inv.tax_lines.map(t => ({ label: t.label, amount: t.cents / 100 })) : null;
    if (!taxLines) {
      // The plain difference is only honest when EVERY fee on the invoice is in hand: the read is capped, and a returned fee sits
      // outside `mine`. Either way the gap would be labelled "Tax" with other money in it, so draw no tax line instead (review 2026-11-05).
      // An open invoice's fees were all fetched on purpose (above) unless one of the two caps was reached; any other invoice is read through the window.
      const openComplete = openIds.has(inv.id) && !extraCapped && openIds.size < OPEN_INVOICE_CAP;
      const complete = (openComplete || windowFees.length < limit) && !views.some(v => v.invoiceNo === inv.invoice_number && !mine.includes(v));
      const feeCents = mine.reduce((sum, v) => sum + (v.credit ? -cents(v.amount) : cents(v.amount)), 0);
      const gap = total == null ? 0 : cents(total) - feeCents;
      taxLines = complete && gap > 0 ? [{ label: W.taxFallback, amount: gap / 100 }] : [];
    }
    invoices.push({
      invoiceNo: inv.invoice_number, state: mine[0].state as ClubFeeInvoiceView['state'], day: mine[0].invoiceDay,
      total: total ?? null, taxLines,
      payUrl: inv.status === FEE_INVOICE_OWED_STATUS ? httpsOnly(inv.hosted_invoice_url) : null,
    });
  }
  return { fees: views, invoices };
}

/** `{invoiceWhere}` for one club, from Stripe's answer: its next subscription invoice, or one of its own. */
export async function invoiceWhere(orgId: string): Promise<'next' | 'own'> {
  try { return (await subscriptionToRide(orgId)) ? 'next' : 'own'; } catch { return 'own'; }
}
