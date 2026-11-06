import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { STRIPE_FEE_WORDS as W } from '../../lib/online-payment-words.ts';
import { feeLineFor, owedInvoicesOf, type FeeInvoice, type FeeRow, type FeesRead } from '../../lib/fee-invoice-line.ts';
import { PLAN_BILLING_PROFILES, planCancellationImpact } from '../../lib/plan-billing-profile.ts';
import { PLAN_BILLING_WORDS as PW } from '../../lib/plan-billing-words.ts';
import type { BillingSnapshot, BillingRead } from '../../lib/plan-billing-data.ts';
import type { BillingBodyViewProps } from '../../components/billing/BillingBody.tsx';
import { readCode } from './_source-code.ts';

/**
 * FEE INVOICE ALERTS · PART 3 — the page line and the failed-payment button (FEE_INVOICE_ALERTS_PART3_BUILD_PROMPT.md).
 * Owner rulings 2026-11-05: Ask 4 (amber line while open, nothing on other pages), Ask 5 (overdue is red; the banner is Part 4),
 * Ask 6 (owner only), Ask 7 (the failed plan payment keeps today's sentence and gains the shipped door); the overdue line is
 * built now in both tones (answer A); words accepted as proposed by /marketing.
 */
const load = billingTestLoader();
const { BillingBodyView } = load('components/billing/BillingBody.tsx') as { BillingBodyView: ComponentType<BillingBodyViewProps> };
const { default: FeeInvoiceLine } = load('components/billing/FeeInvoiceLine.tsx') as { default: ComponentType<{ read: FeesRead | null }> };

const fee = (id: string, invoiceNo: string, state: FeeRow['state'] = 'own_open'): FeeRow => (
  { id, line: 'Extra fee', createdAt: '2026-10-27', amount: 1.25, credit: false, state, invoiceNo, invoiceDay: '2026-12-01', payUrl: 'https://invoice.stripe.com/i/x' });
const inv = (invoiceNo: string, o: Partial<FeeInvoice> = {}): FeeInvoice => (
  { invoiceNo, state: 'own_open', day: '2026-12-01', total: 4.24, taxLines: [], payUrl: 'https://invoice.stripe.com/i/x', ...o });
const read = (...invoices: FeeInvoice[]): FeesRead => ({
  planFree: false, invoices, fees: invoices.map((i, n) => fee(`f${n}`, i.invoiceNo, i.state)),
});

describe('the words (accepted as proposed)', () => {
  it('one invoice, open and overdue', () => {
    assert.equal(W.alertOpen('APFJ8XMY-0001', 'Dec 1'), 'Invoice APFJ8XMY-0001 for Stripe fees is due Dec 1.');
    assert.equal(W.alertAmountDue('$4.24'), 'Amount due $4.24.');
    assert.equal(W.alertOverdue('APFJ8XMY-0001'), 'Invoice APFJ8XMY-0001 for Stripe fees is overdue.');
    assert.equal(W.alertOverdueDetail('$4.24', 'Dec 1'), '$4.24 was due Dec 1.');
  });
  it('two or more, with the plural verbs', () => {
    assert.equal(W.alertOpenMany(2, 'Dec 1'), '2 invoices for Stripe fees to pay. The first is due Dec 1.');
    assert.equal(W.alertOpenMany(2, null), '2 invoices for Stripe fees to pay.');
    assert.equal(W.alertOverdueMany(1, 'Dec 1'), '1 invoice for Stripe fees is overdue. The earliest was due Dec 1.');
    assert.equal(W.alertOverdueMany(3, 'Dec 1'), '3 invoices for Stripe fees are overdue. The earliest was due Dec 1.');
  });
  it('never threaten a shut-off (fee invoices switch nothing off)', () => {
    const all = [W.alertOpen('N', 'Dec 1'), W.alertOpenNoDay('N'), W.alertOverdue('N'), W.alertOverdueDetail('a', 'Dec 1'),
      W.alertOpenMany(2, 'Dec 1'), W.alertOverdueMany(2, 'Dec 1'), W.alertSeeInvoices, W.alertSeeInvoicesAria].join(' ');
    assert.doesNotMatch(all, /suspend|shut|lock|disabled|lose|cancel|stop working|immediately|final/i);
  });
});

describe('which invoices are owed (the list and the line share this)', () => {
  it('open and overdue only, overdue first, then soonest due; paid and fee-less invoices are not owed', () => {
    const r = read(inv('B', { day: '2026-12-10' }), inv('C', { state: 'own_overdue', day: '2026-11-20' }), inv('A', { day: '2026-12-02' }), inv('P', { state: 'own_paid' }));
    assert.deepEqual(owedInvoicesOf(r).map(i => i.invoiceNo), ['C', 'A', 'B']);
    assert.deepEqual(owedInvoicesOf({ ...r, fees: r.fees.filter(f => f.invoiceNo !== 'A') }).map(i => i.invoiceNo), ['C', 'B']);
    assert.deepEqual(owedInvoicesOf(null), []);
    assert.deepEqual(owedInvoicesOf({ planFree: false, fees: [] }), []);
  });
});

describe('the line', () => {
  it('nothing owed: no line', () => {
    assert.equal(feeLineFor(null), null);
    assert.equal(feeLineFor(read(inv('P', { state: 'own_paid' }))), null);
  });
  it('one open invoice: amber, its day and its own total, Pay invoice to Stripe', () => {
    const line = feeLineFor(read(inv('APFJ8XMY-0001')))!;
    assert.equal(line.tone, 'amber');
    assert.equal(line.lead, 'Invoice APFJ8XMY-0001 for Stripe fees is due Dec 1.');
    assert.equal(line.detail, 'Amount due $4.24.');
    assert.deepEqual(line.action, { kind: 'pay', href: 'https://invoice.stripe.com/i/x', label: 'Pay invoice', aria: 'Pay invoice APFJ8XMY-0001 (opens in a new tab)' });
  });
  it('one overdue invoice: red, "was due"', () => {
    const line = feeLineFor(read(inv('A', { state: 'own_overdue', day: '2026-11-20' })))!;
    assert.equal(line.tone, 'red');
    assert.equal(line.lead, 'Invoice A for Stripe fees is overdue.');
    assert.equal(line.detail, '$4.24 was due Nov 20.');
    assert.equal(line.action.kind, 'pay');
  });
  it('one overdue plus others open names the overdue one (the pill says the same: 1 overdue)', () => {
    const line = feeLineFor(read(inv('OPEN'), inv('LATE', { state: 'own_overdue', day: '2026-11-20' })))!;
    assert.equal(line.tone, 'red');
    assert.match(line.lead, /Invoice LATE .* overdue/);
    assert.equal(line.action.kind, 'pay');
  });
  it('two open: amber, the count and the earliest day, pointing at the list (no combined total is ever made)', () => {
    const line = feeLineFor(read(inv('B', { day: '2026-12-10' }), inv('A', { day: '2026-12-02' })))!;
    assert.equal(line.tone, 'amber');
    assert.equal(line.lead, '2 invoices for Stripe fees to pay. The first is due Dec 2.');
    assert.equal(line.detail, null);
    assert.deepEqual(line.action, { kind: 'see', label: 'See invoices', aria: 'See the fee invoices below' });
  });
  it('two overdue: red plural', () => {
    const line = feeLineFor(read(inv('A', { state: 'own_overdue', day: '2026-11-20' }), inv('B', { state: 'own_overdue', day: '2026-11-25' }), inv('C')))!;
    assert.equal(line.tone, 'red');
    assert.equal(line.lead, '2 invoices for Stripe fees are overdue. The earliest was due Nov 20.');
  });
  it('missing facts stay true: no total, no day, no Stripe page, a non-https address', () => {
    const noTotal = feeLineFor(read(inv('A', { total: null })))!;
    assert.equal(noTotal.detail, null);
    const noDay = feeLineFor(read(inv('A', { day: null })))!;
    assert.equal(noDay.lead, 'Invoice A for Stripe fees is open.');
    assert.equal(feeLineFor(read(inv('A', { payUrl: null })))!.action.kind, 'see');
    assert.equal(feeLineFor(read(inv('A', { payUrl: 'javascript:alert(1)' })))!.action.kind, 'see');
    assert.equal(feeLineFor(read(inv('A', { payUrl: 'http://invoice.stripe.com/x' })))!.action.kind, 'see');
  });
});

describe('what is drawn', () => {
  it('amber edge while open, the red edge once overdue; Pay invoice opens a new tab safely', () => {
    const open = renderToStaticMarkup(createElement(FeeInvoiceLine, { read: read(inv('A')) }));
    assert.match(open, /waitCallout/); assert.doesNotMatch(open, /calloutDanger/);
    assert.match(open, /target="_blank"/); assert.match(open, /rel="noopener noreferrer"/); assert.match(open, /btn-lime/);
    const late = renderToStaticMarkup(createElement(FeeInvoiceLine, { read: read(inv('A', { state: 'own_overdue' })) }));
    assert.match(late, /calloutDanger/);
  });
  it('absent when nothing is owed, and for a read with no invoices (the coaches portal)', () => {
    assert.equal(renderToStaticMarkup(createElement(FeeInvoiceLine, { read: null })), '');
    assert.equal(renderToStaticMarkup(createElement(FeeInvoiceLine, { read: { fees: [], planFree: false } })), '');
  });
  it('two invoices draw a See invoices button, not a link', () => {
    const html = renderToStaticMarkup(createElement(FeeInvoiceLine, { read: read(inv('A'), inv('B')) }));
    assert.match(html, /<button type="button"[^>]*>See invoices<\/button>/);
    assert.doesNotMatch(html, /<a /);
  });
});

describe('the failed-payment line gains the shipped door', () => {
  const ready = <T>(data: T): BillingRead<T> => ({ status: 'ready', data });
  function props(status: string, busy: string | null = null): BillingBodyViewProps {
    const profile = PLAN_BILLING_PROFILES.club;
    const impact = planCancellationImpact(profile, ['module_public_site'], 9);
    const snapshot: BillingSnapshot = {
      org: { id: 'org-a', slug: 'club-a', name: 'Falcons', planId: 'club', ownPlanId: 'club', enabledAddons: ['module_public_site'], subscriptionStatus: status, subscriptionPeriod: 'monthly', currentPeriodEnd: '2027-03-01', teamLimit: 15, tournamentLimit: 1 } as BillingSnapshot['org'],
      canManageBilling: true, usage: ready({ teams: { count: 9, limit: 15 }, tournament_slots: { count: 1, limit: 1 }, staff_seats: { count: 2, limit: profile.config.seatLimit }, officials: 4 }),
      freeTime: ready({ freeTime: null, portal: null, foundingThrough: null, overLimitAfter: false }),
      founding: ready({ isFoundingSeason: false, compUntil: null }),
      gating: ready({ club: true }), cancellation: ready({ currentPlan: 'club', ...impact, activeTeams: 9, activeTournamentCount: 0, tournaments: [], cancelled: null }),
      move: ready({ live: false, scheduledMove: null }),
    };
    return { snapshot, profile, ownProfile: profile, actions: { busy, cycle: 'monthly', setCycle() {}, portal() {}, card() {}, reactivate() {}, keep() {}, keepPlan() {}, cancel() {}, change() {}, details() {}, choose() {}, retry() {} },
      feeLine: createElement('div', { id: 'fee-line-fixture' }, 'fee line fixture') };
  }
  const html = (p: BillingBodyViewProps) => renderToStaticMarkup(createElement(BillingBodyView, p)).replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
  it('today’s sentence stays word for word, red-edged, with Payment method & invoices beside it', () => {
    const rendered = html(props('past_due'));
    assert.ok(rendered.includes(PW.plan.pastDue));
    const callout = rendered.slice(rendered.lastIndexOf('<div', rendered.indexOf(PW.plan.pastDue)));
    assert.match(callout, /calloutDanger/);
    assert.ok(callout.includes(`>${PW.plan.payment}</button>`));
    assert.doesNotMatch(callout.slice(0, callout.indexOf('</button>')), /disabled/);
  });
  it('busy: the button reads Opening payment portal… and is disabled, like the plan card’s own', () => {
    const rendered = html(props('past_due', 'portal'));
    assert.ok(rendered.includes(PW.plan.openingPortal));
    const idx = rendered.indexOf(PW.plan.pastDue);
    assert.match(rendered.slice(idx, rendered.indexOf('</button>', idx)), /disabled/);
  });
  it('no failed payment, no line and no second door', () => {
    const rendered = html(props('active'));
    assert.ok(!rendered.includes(PW.plan.pastDue));
    assert.equal(rendered.split(PW.plan.payment).length - 1, 1, 'the plan card’s own button only');
  });
  it('the fee line sits above the plan card, and the failed-payment line below it', () => {
    const rendered = html(props('past_due'));
    assert.ok(rendered.indexOf('fee line fixture') < rendered.indexOf(PW.plan.pastDue));
    assert.ok(rendered.indexOf(PW.plan.pastDue) < rendered.indexOf('Your plan'));
  });
  it('a non-owner never gets the line', () => {
    const p = props('past_due'); p.snapshot.canManageBilling = false;
    const rendered = html(p);
    assert.doesNotMatch(rendered, /fee line fixture/); assert.ok(!rendered.includes(PW.plan.pastDue));
  });
});

describe('one read, a refresh on return, and the gates', () => {
  const body = readCode('components/billing/BillingBody.tsx');
  const hook = readCode('components/billing/useStripeFeesRead.ts');
  it('the page reads the fees once; neither the list nor the line fetches', () => {
    assert.equal((hook.match(/\/api\/billing\/stripe-fees/g) ?? []).length, 1);
    for (const f of ['components/billing/StripeFeesList.tsx', 'components/billing/FeeInvoiceLine.tsx']) assert.doesNotMatch(readCode(f), /fetch\(|\/api\/billing\/stripe-fees/, f);
    assert.equal((body.match(/useStripeFeesRead\(/g) ?? []).length, 1);
    assert.match(body, /<StripeFeesList read=\{feeRead\} \/>/); assert.match(body, /<FeeInvoiceLine read=\{feeRead\} overdue=\{org\.subscriptionStatus === 'canceled' \|\| !bannerCoversOverdue\} \/>/);
    // The neutral body never reads the club brief itself: the admin wrapper says whether the banner is up.
    assert.match(readCode('components/admin/kit/club/BillingKit.tsx'), /const bannerCoversOverdue = status === 'loading' \|\| overdueBannerFor\(brief\?\.feesOwed\) != null/);
  });
  it('coming back to the tab re-reads only while something is owed, and tells the brief only when it changed', () => {
    assert.match(hook, /visibilitychange/); assert.match(hook, /if \(!sig\) return/);
    assert.match(hook, /before != null && before !== sig/);
  });
  it('the club admin hands the brief’s reload in; the coaches portal hands in nothing', () => {
    const kit = readCode('components/admin/kit/club/BillingKit.tsx');
    assert.match(kit, /useClubBrief\(\)/); assert.match(kit, /onFeesMayHaveChanged=\{reload\}/);
    assert.doesNotMatch(readCode('app/[orgSlug]/coaches/billing/page.tsx'), /onFeesMayHaveChanged/);
  });
  it('the words live in the vocabulary, not in the components (no typed sentences, no dollar literals)', () => {
    for (const f of ['components/billing/FeeInvoiceLine.tsx', 'lib/fee-invoice-line.ts', 'components/billing/useStripeFeesRead.ts']) {
      assert.doesNotMatch(readCode(f), /for Stripe fees|Pay invoice['`"]|\$\s?\d/, f);
    }
  });
  it('the failed-payment button calls the plan card’s own portal action, not a second door', () => {
    assert.match(body, /onClick=\{a\.portal\} disabled=\{disabled\}><CreditCard size=\{14\} aria-hidden \/>\{a\.busy === 'portal' \? W\.plan\.openingPortal : W\.plan\.payment\}<\/button>\n    <\/div>\}/);
  });
});
