/**
 * GST/HST Stage 6 step 6.4 Part A — "The details of your purchase", and every owner (build prompt
 * docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md §3; owner rulings 2026-11-13 Q1–Q4).
 *   1 · which paid invoice earns the email (each row of §3.2's table, on fixtures);
 *   2 · once only (§3.3): a replay, both paid events, the webhook and the daily job racing, a definite and an unknown failure;
 *   3 · the words (§6): the three Terms states, the tax rows, a trial's estimate, the fixed block, no receipt or upsell;
 *   4 · the wiring: after the tax record, the daily step, every purchase door stamps the buyer, every owner, welcome back folded in.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PURCHASE_WORDS, classifyPurchase, purchaseDetailsEmail, purchaseTermsSentences, recordTaxRows,
  runPurchaseEmail, type PurchaseEmailInput, type PurchaseFacts, type PurchaseRecord, type PurchaseRunDeps,
} from '../../lib/purchase-details.ts';
import { ownersSendOutcome } from '../../lib/owners-send-outcome.ts';
import { BUYER_USER_META, COMEBACK_META } from '../../lib/plan-growth.ts';
import { NEXT_SEASON_CHOICE_KIND, buildNextSeasonCheckoutParams } from '../../lib/next-season-choice.ts';
import { zeroRatedLine, type StoredTaxLine } from '../../lib/charge-tax-record.ts';

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// ── 1 · the classifier ────────────────────────────────────────────────────────────────────────────────────────────────
const base: PurchaseFacts = {
  billingReason: 'subscription_create', status: 'paid', kind: 'subscription', totalCents: 4407, feeInvoice: false,
  subscriptionId: 'sub_123', subscriptionStatus: 'active', meta: {}, hasRecipient: true,
};
const is = (over: Partial<PurchaseFacts>) => classifyPurchase({ ...base, ...over });

describe('1 · which paid invoice earns the email (§3.2)', () => {
  it('a first paid plan, and a comeback when the checkout stamped one', () => {
    assert.equal(is({}), 'first');
    assert.equal(is({ meta: { [COMEBACK_META]: '1' } }), 'comeback');
  });
  it('a $0 first invoice of a trialing subscription: a trial, or a next-season choice by its marker', () => {
    assert.equal(is({ totalCents: 0, subscriptionStatus: 'trialing' }), 'trial');
    assert.equal(is({ totalCents: 0, subscriptionStatus: 'trialing', meta: { choiceKind: NEXT_SEASON_CHOICE_KIND } }), 'next_season');
    assert.equal(is({ totalCents: 0, subscriptionStatus: 'active' }), null, 'a $0 purchase that is not a trial is not one of the five');
  });
  it('a move up\'s proration invoice, Premium → Club in place included (test mode 2026-11-13: both carry flhq_plan_move up)', () => {
    assert.equal(is({ billingReason: 'subscription_update', meta: { flhq_plan_move: 'up' } }), 'plan_change');
    assert.equal(is({ billingReason: 'subscription_update', meta: { flhq_plan_move: 'up', inPlaceClub: '1', checkoutKind: 'standalone_team' } }), 'plan_change');
    assert.equal(is({ billingReason: 'subscription_update', meta: {} }), null, 'any other update');
    assert.equal(is({ billingReason: 'subscription_update', meta: { flhq_plan_move: 'down' } }), null);
    assert.equal(is({ billingReason: 'subscription_update', totalCents: 0, meta: { flhq_plan_move: 'up' } }), null);
  });
  it('a move up during a trial: Stripe\'s $0 paid update invoice with the move marker (test mode 2026-11-16; 6.6 fixes ruling 2)', () => {
    const trialUp = { billingReason: 'subscription_update', totalCents: 0, subscriptionStatus: 'trialing', meta: { flhq_plan_move: 'up' } };
    assert.equal(is(trialUp), 'trial_change');
    assert.equal(is({ ...trialUp, meta: { flhq_plan_move: 'up', [BUYER_USER_META]: 'u1', inPlaceClub: '1' } }), 'trial_change', 'Premium → Club during a trial too');
    // The move metadata stays on the subscription after the move: the trialing guard is what keeps a later $0 update quiet.
    assert.equal(is({ ...trialUp, subscriptionStatus: 'active' }), null, 'a $0 update with the old marker, after the trial');
    assert.equal(is({ ...trialUp, subscriptionStatus: 'past_due' }), null);
    assert.equal(is({ ...trialUp, meta: {} }), null, 'a $0 dashboard update during a trial');
    assert.equal(is({ ...trialUp, meta: { flhq_plan_move: 'down' } }), null);
    assert.equal(is({ ...trialUp, status: 'open' }), null);
    assert.equal(is({ ...trialUp, subscriptionId: 'mock_sub_1' }), null, 'the dev mock path writes no invoice');
    assert.equal(is({ ...trialUp, billingReason: 'subscription_create' }), 'trial', 'a trial\'s own first invoice stays the trial email');
    // A next-season choice is trialing too, with no free trial: a guard (no move up reaches one today), so it sends nothing.
    assert.equal(is({ ...trialUp, meta: { flhq_plan_move: 'up', choiceKind: NEXT_SEASON_CHOICE_KIND } }), null);
  });
  it('a renewal is never one — a trial\'s or next-season choice\'s first real charge included', () => {
    assert.equal(is({ billingReason: 'subscription_cycle' }), null);
    assert.equal(is({ billingReason: 'subscription_cycle', meta: { choiceKind: NEXT_SEASON_CHOICE_KIND } }), null);
  });
  it('a manual or threshold invoice, a club\'s fee invoice (by kind or by its marker): none', () => {
    assert.equal(is({ billingReason: 'manual' }), null);
    assert.equal(is({ billingReason: 'subscription_threshold' }), null);
    assert.equal(is({ kind: 'fee' }), null);
    assert.equal(is({ feeInvoice: true }), null);
  });
  it('not paid, a mock_ subscription, no subscription, or nobody on the record: none', () => {
    assert.equal(is({ status: 'open' }), null);
    assert.equal(is({ subscriptionId: 'mock_sub_1' }), null);
    assert.equal(is({ subscriptionId: null }), null);
    assert.equal(is({ hasRecipient: false }), null);
  });
});

// ── 2 · once only ─────────────────────────────────────────────────────────────────────────────────────────────────────
const record = (over: Partial<PurchaseRecord> = {}): PurchaseRecord => ({
  stripe_invoice_id: 'in_1', livemode: false, kind: 'subscription', org_id: 'org-1', user_id: null, status: 'paid',
  billing_reason: 'subscription_create', purchase_email_at: null, currency: 'cad', amount_before_tax_cents: 3900,
  tax_lines: [], total_cents: 4407, invoice_number: 'ABC-0001', paid_at: '2026-11-13T15:00:00Z', issued_at: '2026-11-13T15:00:00Z',
  stripe_subscription_id: 'sub_123', ...over,
});

type Sent = { to: string; key: string };
function harness(opts: {
  row?: PurchaseRecord; stripe?: { feeInvoice?: boolean; meta?: Record<string, string>; subscriptionStatus?: string };
  owners?: Array<{ userId: string; email: string }>; answer?: (to: string) => { status: string; refused?: boolean } | 'throw';
  buildThrows?: boolean;
} = {}) {
  const store = { row: opts.row ?? record() };
  const sent: Sent[] = [];
  let tick = 0;
  const deps: PurchaseRunDeps<null> = {
    live: false,
    async readRecord() { await Promise.resolve(); return { ...store.row }; },
    async readStripe() {
      await Promise.resolve();
      return { feeInvoice: !!opts.stripe?.feeInvoice, meta: opts.stripe?.meta ?? {}, subscriptionStatus: opts.stripe?.subscriptionStatus ?? 'active', live: null };
    },
    async recipients() { return opts.owners ?? [{ userId: 'u1', email: 'owner@club.test' }]; },
    async claim(_id, at) { await Promise.resolve(); if (store.row.purchase_email_at) return false; store.row.purchase_email_at = at; return true; },
    async release(_id, at) { if (store.row.purchase_email_at === at) store.row.purchase_email_at = null; },
    async build() {
      if (opts.buildThrows) throw new Error('Stripe did not answer');
      return { email: purchaseDetailsEmail(input()), noTaxNumber: false, buyerUserId: 'u1' };
    },
    async send(to, _email, key) {
      const a = opts.answer?.(to.email) ?? { status: 'sent' };
      if (a === 'throw') throw new Error('no answer');
      if (a.status === 'sent') sent.push({ to: to.email, key });
      return a;
    },
    now: () => `2026-11-13T15:01:0${tick++}Z`,
    log: () => {},
  };
  return { deps, store, sent };
}

describe('2 · once only (§3.3)', () => {
  it('a replayed event sends nothing and claims nothing', async () => {
    const h = harness();
    assert.equal((await runPurchaseEmail('in_1', h.deps, { replay: true })).outcome, 'replay');
    assert.equal(h.sent.length, 0);
    assert.equal(h.store.row.purchase_email_at, null);
  });
  it('invoice.paid then invoice.payment_succeeded for one invoice send ONE email', async () => {
    const h = harness();
    const first = await runPurchaseEmail('in_1', h.deps);
    const second = await runPurchaseEmail('in_1', h.deps);
    assert.deepEqual([first.outcome, second.outcome], ['sent', 'already']);
    assert.equal(h.sent.length, 1);
  });
  it('the webhook and the daily catch-up racing send ONE email (the claim is one conditional update)', async () => {
    const h = harness();
    const both = await Promise.all([runPurchaseEmail('in_1', h.deps), runPurchaseEmail('in_1', h.deps)]);
    assert.deepEqual(both.map(r => r.outcome).sort(), ['already', 'sent']);
    assert.equal(h.sent.length, 1);
  });
  it('a fee invoice, a renewal, a mock_ subscription and a backfilled row send nothing', async () => {
    for (const h of [
      harness({ stripe: { feeInvoice: true } }),
      harness({ row: record({ billing_reason: 'subscription_cycle' }) }),
      harness({ row: record({ stripe_subscription_id: 'mock_sub_1' }) }),
      harness({ row: record({ billing_reason: null }) }),
      harness({ row: record({ livemode: true }) }),
    ]) {
      assert.equal((await runPurchaseEmail('in_1', h.deps)).outcome, 'none');
      assert.equal(h.sent.length, 0);
      assert.equal(h.store.row.purchase_email_at, null);
    }
  });
  it('no owner to tell (a demo address is never one: orgOwnerEmails leaves it out) sends nothing', async () => {
    const h = harness({ owners: [] });
    assert.equal((await runPurchaseEmail('in_1', h.deps)).outcome, 'no_recipient');
    const src = read('lib/notify-recipients.ts');
    assert.match(src.slice(src.indexOf('export async function orgOwnerEmails')), /!isDemoOrganizerEmail\(email\)/);
  });
  it('a two-owner club: both addresses, each with its own once-only key, one claim', async () => {
    const h = harness({ owners: [{ userId: 'u1', email: 'a@club.test' }, { userId: 'u2', email: 'b@club.test' }] });
    assert.equal((await runPurchaseEmail('in_1', h.deps)).outcome, 'sent');
    assert.deepEqual(h.sent, [{ to: 'a@club.test', key: 'purchase-details:in_1:u1' }, { to: 'b@club.test', key: 'purchase-details:in_1:u2' }]);
  });
  it('a definite refusal gives the claim back (the next run sends); an unknown answer keeps it (never twice)', async () => {
    let refuse = true;
    const h = harness({ answer: () => (refuse ? { status: 'provider_error', refused: true } : { status: 'sent' }) });
    assert.equal((await runPurchaseEmail('in_1', h.deps)).outcome, 'not_sent');
    assert.equal(h.store.row.purchase_email_at, null);
    refuse = false;
    assert.equal((await runPurchaseEmail('in_1', h.deps)).outcome, 'sent');

    const u = harness({ answer: () => 'throw' });
    assert.equal((await runPurchaseEmail('in_1', u.deps)).outcome, 'unknown');
    assert.notEqual(u.store.row.purchase_email_at, null);
    assert.equal((await runPurchaseEmail('in_1', u.deps)).outcome, 'already');
  });
  it('a failure building the email (nothing went) gives the claim back and throws', async () => {
    const h = harness({ buildThrows: true });
    await assert.rejects(runPurchaseEmail('in_1', h.deps));
    assert.equal(h.store.row.purchase_email_at, null);
  });
  it('the shared outcome: any sent = sent; every one definitely not = not_sent; else unknown', () => {
    assert.equal(ownersSendOutcome([{ status: 'sent' }, null]), 'sent');
    assert.equal(ownersSendOutcome([{ status: 'skipped' }, { status: 'provider_error', refused: true }]), 'not_sent');
    assert.equal(ownersSendOutcome([{ status: 'provider_error', refused: false }]), 'unknown');
    assert.equal(ownersSendOutcome([{ status: 'skipped' }], { skippedIsSent: true }), 'sent', 'the plan-ending emails keep their rule');
  });
});

// ── 3 · the words ─────────────────────────────────────────────────────────────────────────────────────────────────────
const ON_HST: StoredTaxLine = {
  source: 'stripe', name: 'HST (ON)', tax_type: 'hst', jurisdiction: 'Ontario', jurisdiction_level: 'state', country: 'CA', region: 'ON',
  rate: 13, effective_rate: 13, taxable_cents: 3900, cents: 507, taxability_reason: 'standard_rated', tax_rate_id: 'txr_1', tax_behavior: 'exclusive',
};
function input(over: Partial<PurchaseEmailInput> = {}): PurchaseEmailInput {
  return {
    case: 'first', orgName: 'Riverside Club', planLabel: 'League', cycle: 'yearly',
    boughtBy: { who: 'Sam Rivers', onIso: '2026-11-13T15:00:00Z' }, currency: 'cad', beforeTaxCents: 3900,
    taxLines: recordTaxRows([ON_HST]), totalCents: 4407, invoiceNumber: 'ABC-0001',
    invoiceUrl: 'https://invoice.stripe.com/i/abc', billingUrl: 'https://fieldlogichq.ca/riverside/admin/billing',
    startedIso: '2026-11-13T15:00:00Z', nextIso: '2027-11-13T15:00:00Z', nextPriceCents: 3900, estimate: null,
    taxNumber: '123456789RT0001', contactEmail: 'hello@fieldlogichq.ca', sellerPhone: '', sellerMailingAddress: '',
    terms: { mode: 'off' }, ...over,
  };
}
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&middot;/g, '·').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ');
const termsOf = (html: string) => html.split('\n').filter(l => /Terms of Service/.test(l));
const withoutTerms = (html: string) => html.split('\n').filter(l => !/Terms of Service/.test(l)).join('\n');

describe('3 · the words (§6)', () => {
  it('the subject, heading and five openings are §6 as reviewed (the sixth, a move up during a trial, below)', () => {
    assert.equal(PURCHASE_WORDS.subject('League'), 'The details of your purchase: League');
    assert.equal(PURCHASE_WORDS.opening('first', 'League', 'Riverside Club'), 'Thanks for choosing League for Riverside Club. Here are the details of your purchase.');
    assert.equal(PURCHASE_WORDS.opening('comeback', 'League', 'Riverside Club'), 'Welcome back to League, Riverside Club. Here are the details of your purchase.');
    assert.equal(PURCHASE_WORDS.opening('plan_change', 'Club', 'Riverside Club'), 'Riverside Club is now on Club. Here are the details of the change.');
    assert.equal(PURCHASE_WORDS.opening('trial', 'League', 'Riverside Club'), 'Your free trial of League for Riverside Club has started. Nothing has been charged today.');
    assert.equal(PURCHASE_WORDS.opening('next_season', 'Club', 'Riverside Club'), 'You chose Club for Riverside Club’s next season. Nothing has been charged today.');
    assert.equal(PURCHASE_WORDS.opening('next_season', 'Club', 'The Hawks'), 'You chose Club for The Hawks’ next season. Nothing has been charged today.');
  });
  it('the Terms line, in the three switch states — and everything else is the same in each (ruled Q1)', () => {
    const off = purchaseDetailsEmail(input()).html;
    const preview = purchaseDetailsEmail(input({ terms: { mode: 'preview', href: 'https://fieldlogichq.ca/legal/terms' } })).html;
    const published = purchaseDetailsEmail(input({ terms: { mode: 'published', version: '2026-11-13', href: 'https://fieldlogichq.ca/legal/terms/2026-11-13' } })).html;
    assert.equal(termsOf(off).length, 0, 'pages off: no line');
    assert.match(text(termsOf(preview).join(' ')), /The Terms of Service for this purchase: the draft/);
    assert.match(termsOf(preview).join(' '), /href="https:\/\/fieldlogichq\.ca\/legal\/terms"/);
    assert.match(text(termsOf(published).join(' ')), /The Terms of Service for this purchase: version November 13, 2026/);
    assert.match(termsOf(published).join(' '), /legal\/terms\/2026-11-13/);
    // Every owner gets this email and only the buyer ticked, so the line never says "you accepted" (/legal, 6.6).
    assert.doesNotMatch(text(preview + published), /you accepted/i);
    assert.equal(withoutTerms(preview), withoutTerms(off));
    assert.equal(withoutTerms(published), withoutTerms(off));
  });
  it('the figures: the record\'s own labels, a zero-rated sale reads "GST/HST 0%", no tax line reads "Tax $0.00"', () => {
    const t = text(purchaseDetailsEmail(input()).html);
    assert.match(t, /HST \(ON\) 13% \$5\.07/);
    assert.match(t, /Total \$44\.07 CAD/);
    assert.match(t, /Plan League, billed yearly, in advance, to the card on file/);
    assert.match(t, /Bought by Sam Rivers, on November 13, 2026/);
    assert.match(t, /Invoice number ABC-0001/);
    assert.deepEqual(recordTaxRows([zeroRatedLine(3900)]), [{ label: 'GST/HST 0%', cents: 0 }]);
    assert.deepEqual(recordTaxRows([]), [{ label: 'Tax', cents: 0 }]);
    assert.match(text(purchaseDetailsEmail(input({ taxLines: [] })).html), /Tax \$0\.00/);
  });
  it('a plan change prices the rest of the period; the renewal line promises 30 days\' notice of a price change', () => {
    assert.match(text(purchaseDetailsEmail(input({ case: 'plan_change' })).html), /Price before tax, for the rest of this period \$39\.00/);
    const { dates, cancel } = purchaseTermsSentences(input());
    assert.deepEqual(dates, ['Started on November 13, 2026.',
      'Renews on November 13, 2027 at $39.00 plus applicable taxes, until you cancel. If the price changes, we’ll email you at least 30 days before.']);
    assert.deepEqual(cancel, [
      'You can cancel any time from your billing page. Your plan stays active until the end of the period you’ve paid for, and you won’t be charged again.',
      'We don’t refund the unused part of a period. This doesn’t affect any refund right you have under the law.']);
  });
  it('a trial: charged today $0.00, the first payment, its estimate labelled as one — and the estimate never holds the email', () => {
    const est = { taxLines: [{ label: 'HST (ON) 13%', cents: 6240 }], totalCents: 54240 };
    const t = text(purchaseDetailsEmail(input({ case: 'trial', beforeTaxCents: 0, totalCents: 0, taxLines: [], nextPriceCents: 48000, estimate: est })).html);
    assert.match(t, /Charged today \$0\.00/);
    assert.match(t, /Your first payment: \$480\.00 plus applicable taxes, on November 13, 2027\. Estimated tax, based on your billing address today: HST \(ON\) 13% \$62\.40, for a total of \$542\.40 CAD\. The tax is worked out when the payment is taken, so it can change if your address or the tax rate does\./);
    assert.match(t, /Cancel from your billing page before November 13, 2027 and you won’t be charged\./);
    const noEstimate = text(purchaseDetailsEmail(input({ case: 'trial', nextPriceCents: 48000, estimate: null })).html);
    assert.match(noEstimate, /Your first payment: \$480\.00 plus applicable taxes, on November 13, 2027\./);
    assert.doesNotMatch(noEstimate, /Estimated tax/);
  });
  it('a move up during a trial: the trial continues, nothing charged, the NEW plan\'s first payment and its estimate (6.6 fixes)', () => {
    assert.equal(PURCHASE_WORDS.opening('trial_change', 'Club · Association', 'Riverside Club'),
      'Riverside Club is now on Club · Association. Your free trial continues, and nothing has been charged today.');
    // The probe's figures (test mode 2026-11-16): Club → Club · Association monthly, $379.00 before tax, HST (ON) 13% $49.27.
    const est = { taxLines: [{ label: 'HST (ON) 13%', cents: 4927 }], totalCents: 42827 };
    const e = purchaseDetailsEmail(input({ case: 'trial_change', planLabel: 'Club · Association', cycle: 'monthly', beforeTaxCents: 0,
      totalCents: 0, taxLines: [], nextPriceCents: 37900, nextIso: '2026-12-17T02:12:25Z', estimate: est }));
    assert.equal(e.subject, 'The details of your purchase: Club · Association');
    const t = text(e.html);
    assert.match(t, /Riverside Club is now on Club · Association\. Your free trial continues, and nothing has been charged today\./);
    assert.match(t, /Price before tax \$0\.00/, 'not "for the rest of this period": nothing is prorated in a trial');
    assert.match(t, /Charged today \$0\.00/);
    assert.match(t, /Your first payment: \$379\.00 plus applicable taxes, on December 16, 2026\. Estimated tax, based on your billing address today: HST \(ON\) 13% \$49\.27, for a total of \$428\.27 CAD\./);
    assert.match(t, /Cancel from your billing page before December 16, 2026 and you won’t be charged\./);
    assert.doesNotMatch(t, /Renews on|Here are the details of the change/);
    assert.doesNotMatch(e.html, /receipt|payment received|upgrade/i);
  });
  it('drops what it does not have: the invoice link, the GST/HST number, the buyer, the blank seller lines', () => {
    const html = purchaseDetailsEmail(input({ invoiceUrl: null, taxNumber: null, boughtBy: null })).html;
    assert.doesNotMatch(html, /View your invoice/);
    assert.match(text(html), /Sold by FieldLogicHQ Questions\?/);
    assert.doesNotMatch(html, /registration number/);
    assert.doesNotMatch(html, /Bought by/);
    assert.match(text(purchaseDetailsEmail(input()).html), /Sold by FieldLogicHQ · GST\/HST registration number 123456789RT0001/);
    assert.match(text(purchaseDetailsEmail(input({ sellerPhone: '1-800-555-0100' })).html), /1-800-555-0100/);
  });
  it('no receipt, no "payment received", and the only links are the invoice, the billing page and the Terms (CASL)', () => {
    const html = purchaseDetailsEmail(input({ terms: { mode: 'preview', href: 'https://fieldlogichq.ca/legal/terms' } })).html;
    assert.doesNotMatch(html, /receipt|payment received/i);
    // "paid" appears only in the reviewed cancel sentence ("the period you've paid for").
    assert.deepEqual(text(html).match(/\bpaid\b[^.]*/gi), ['paid for, and you won’t be charged again']);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(hrefs, ['https://invoice.stripe.com/i/abc', 'https://fieldlogichq.ca/riverside/admin/billing', 'https://fieldlogichq.ca/legal/terms']);
  });
  it('the template\'s editable words are only the opening and the closing; the fixed block rides outside them', () => {
    const mig = read('supabase/migrations/478_a_purchase_is_told_its_details.sql');
    assert.ok(mig.includes(`{{opening}}\n\n${PURCHASE_WORDS.closing}`));
    assert.ok(mig.includes('$k$The details of your purchase: {{planLabel}}$k$'));
    assert.doesNotMatch(mig.slice(mig.indexOf('purchase_details'), mig.indexOf('yearly_renewal_reminder')), /refund|cancel any time/i);
    const email = purchaseDetailsEmail(input());
    assert.ok(email.html.includes(email.fixedHtml));
    assert.match(email.fixedHtml, /We don’t refund/);
    const tpl = read('lib/platform-email-templates.ts');
    assert.match(tpl, /fixedHtml: opts\.fixedHtml/);
    assert.match(read('lib/purchase-details-server.ts'), /fixedHtml: email\.fixedHtml/);
  });
});

// ── 4 · the wiring ────────────────────────────────────────────────────────────────────────────────────────────────────
describe('4 · the wiring', () => {
  it('the webhook sends it AFTER the tax record, for the paid events only, through the replay gate', () => {
    const src = read('lib/billing-webhook-handler.ts');
    const seam = src.slice(src.indexOf('export async function runVerifiedBillingEvent'), src.indexOf('async function runPlanWork'));
    assert.ok(seam.indexOf('recordInvoiceTax(invoiceId)') < seam.indexOf('sendPurchaseEmailOrReport(invoiceId, opts)'));
    assert.match(src, /const PURCHASE_EMAIL_EVENTS = \['invoice\.paid', 'invoice\.payment_succeeded'\] as const;/);
    assert.match(read('lib/purchase-details-server.ts'), /customerSenders\(\{ email: sendTransactionalEmail, notify \}, opts\)/);
  });
  it('the daily job catches up after the tax records, with the same send', () => {
    const src = read('app/api/platform-admin/stripe-fees-daily/route.ts');
    assert.ok(src.indexOf("run('tax_records'") < src.indexOf("run('purchase_emails', () => catchUpPurchaseEmails(now))"));
    const server = read('lib/purchase-details-server.ts');
    const catchUp = server.slice(server.indexOf('export async function catchUpPurchaseEmails'));
    assert.match(catchUp, /sendPurchaseEmail\(id\)/);
    assert.match(catchUp, /\.in\('billing_reason', \['subscription_create', 'subscription_update'\]\)/);
    assert.match(server, /const CATCH_UP_DAYS = 3;/);
  });
  it('a backfilled record keeps no billing reason (history is never emailed)', () => {
    assert.match(read('lib/charge-tax-record.ts'), /billing_reason: ctx\.captured === 'backfill' \? null : /);
  });
  it('every purchase door stamps the person who bought', () => {
    assert.match(read('app/api/billing/create-checkout/route.ts'), /\[BUYER_USER_META\]: auth\.user\.id/);
    assert.match(read('app/api/billing/create-team-checkout/route.ts'), /\[BUYER_USER_META\]: user\.id/);
    assert.match(read('app/api/billing/choose-next-season/route.ts'), /buyerUserId: auth\.user\.id/);
    assert.match(read('app/api/billing/move/route.ts'), /buyerUserId: authorized\.user\.id/);
    const params = buildNextSeasonCheckoutParams({
      customerId: 'cus_1', priceId: 'price_1', orgId: 'org-1', planKey: 'club', billingCycle: 'annual',
      successUrl: 'https://x/s', cancelUrl: 'https://x/c', buyerUserId: 'user-9', now: 0,
    });
    assert.equal((params.subscription_data?.metadata as Record<string, string>)[BUYER_USER_META], 'user-9');
    assert.match(read('lib/plan-move.ts'), /direction === 'up' && opts\.buyerUserId \? \{ \[BUYER_USER_META\]: opts\.buyerUserId \}/);
  });
  it('a checkout that comes back is stamped, so its one email opens "Welcome back"', () => {
    assert.match(read('app/api/billing/create-checkout/route.ts'), /\.\.\.\(returning \? \{ \[COMEBACK_META\]: '1' \} : \{\}\)/);
    assert.match(read('app/api/billing/create-team-checkout/route.ts'), /\.\.\.\(returning \? \{ \[COMEBACK_META\]: '1' \} : \{\}\)/);
  });
  it('a paid comeback gets no separate "Welcome back": both webhook sends wait for a comeback with no invoice (ruling Q3)', () => {
    const src = read('lib/billing-webhook-handler.ts');
    const sends = [...src.matchAll(/key: 'welcome_back'/g)].length;
    assert.equal(sends, 2);
    assert.equal([...src.matchAll(/!comesWithInvoice\(sub\)/g)].length, 2);
  });
  it('every owner: the billing emails read every active owner, not one (ruling Q4)', () => {
    for (const f of ['lib/billing-webhook-handler.ts', 'lib/plan-ending-server.ts', 'lib/billing-retention.ts']) {
      const src = read(f);
      assert.doesNotMatch(src, /getOrgOwnerEmail/, `${f} still reads one owner`);
      assert.match(src, /orgOwnerEmails\(/, `${f} reads every owner`);
    }
    const ending = read('lib/plan-ending-server.ts');
    assert.match(ending, /idempotencyKey: `intent:\$\{email\.intent\.id\}:\$\{email\.kind\}_email:\$\{userId\}`/, 'one key per owner');
    assert.match(read('lib/online-payment-owner-notices.ts'), /orgOwnerEmails\(orgId\)/);
    // The one-address reader no longer fails on a second owner.
    const admin = read('lib/supabase-admin.ts');
    assert.match(admin, /\.limit\(1\)\n\s*\.maybeSingle\(\);/);
    assert.match(admin, /\.eq\('status', 'active'\)/);
  });
});
