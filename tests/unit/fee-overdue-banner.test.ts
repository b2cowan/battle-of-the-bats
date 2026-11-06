import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader } from './_billing-test-loader.ts';
import { feesOwedFrom } from '../../lib/fee-invoice-alert.ts';
import { feeLineFor, overdueBannerFor, type FeeInvoice, type FeeRow, type FeesRead } from '../../lib/fee-invoice-line.ts';
import { readCode } from './_source-code.ts';

/**
 * FEE INVOICE ALERTS · PART 4 — the overdue banner (FEE_INVOICE_ALERTS_PART4_BUILD_PROMPT.md).
 * Owner rulings 2026-11-05: asks 5 and 6 (overdue = a banner on every club admin page, no dismiss, scrolls with the page, owner only),
 * Q1 (top of the content column, beside the rail), Q4 (a cancelled club's own page draws the line instead of a shell banner),
 * Q5 (the fees read always includes every open invoice), Q6 (the brief carries the one overdue invoice so the banner can name and pay it).
 */
const NOW = new Date('2026-12-05T12:00:00Z');
const stripe = 'https://invoice.stripe.com/i/x';

describe('the brief names the one overdue invoice (Q6)', () => {
  const row = (no: string, due: string | null, extra: object = {}) => ({ due_at: due, invoice_number: no, total: 4.24, hosted_invoice_url: stripe, ...extra });
  it('exactly one overdue: its number, due day, total and https pay link ride along', () => {
    const owed = feesOwedFrom([row('A-1', '2026-12-01T11:15:11Z'), row('B-2', '2026-12-20T00:00:00Z')], NOW);
    assert.deepEqual(owed, {
      count: 2, overdue: 1, earliestOverdue: '2026-12-01T11:15:11Z',
      overdueInvoice: { invoiceNo: 'A-1', day: '2026-12-01T11:15:11Z', total: 4.24, payUrl: stripe },
    });
  });
  it('the total falls back to amount_due; a non-https address is dropped, never sent', () => {
    const owed = feesOwedFrom([{ due_at: '2026-12-01T00:00:00Z', invoice_number: 'A', total: null, amount_due: 7, hosted_invoice_url: 'http://x' }], NOW);
    assert.equal(owed.overdueInvoice?.total, 7); assert.equal(owed.overdueInvoice?.payUrl, null);
  });
  it('two or more overdue name none of them, only the count and the earliest day', () => {
    const owed = feesOwedFrom([row('B', '2026-12-03T00:00:00Z'), row('A', '2026-12-01T00:00:00Z')], NOW);
    assert.equal(owed.overdue, 2); assert.equal(owed.earliestOverdue, '2026-12-01T00:00:00Z'); assert.equal(owed.overdueInvoice, undefined);
  });
  it('nothing overdue adds nothing: the plain { count, overdue } stays plain', () => {
    assert.deepEqual(feesOwedFrom([row('A', '2026-12-20T00:00:00Z')], NOW), { count: 1, overdue: 0 });
  });
});

describe('the banner line (owner only, overdue only)', () => {
  it('nothing, or only open invoices: no banner (ask 4)', () => {
    assert.equal(overdueBannerFor(undefined), null);
    assert.equal(overdueBannerFor({ count: 0, overdue: 0 }), null);
    assert.equal(overdueBannerFor({ count: 3, overdue: 0 }), null);
  });
  it('one overdue invoice: red, the same sentences the page line wears, with Pay invoice', () => {
    const line = overdueBannerFor({ count: 1, overdue: 1, earliestOverdue: '2026-12-01T11:15:11Z',
      overdueInvoice: { invoiceNo: 'APFJ8XMY-0001', day: '2026-12-01T11:15:11Z', total: 4.24, payUrl: stripe } })!;
    assert.equal(line.tone, 'red');
    assert.equal(line.lead, 'Invoice APFJ8XMY-0001 for Stripe fees is overdue.');
    assert.match(line.detail ?? '', /^\$4\.24 was due Dec 1\.$/);
    assert.equal(line.action.kind, 'pay');
  });
  it('the banner and the page line say the same thing for the same invoice (one builder)', () => {
    const inv: FeeInvoice = { invoiceNo: 'A', state: 'own_overdue', day: '2026-12-01T11:15:11Z', total: 4.24, taxLines: [], payUrl: stripe };
    const fee: FeeRow = { id: 'f', line: 'x', createdAt: '2026-10-27', amount: 1, credit: false, state: 'own_overdue', invoiceNo: 'A', invoiceDay: inv.day, payUrl: stripe };
    const page = feeLineFor({ planFree: false, invoices: [inv], fees: [fee] })!;
    const banner = overdueBannerFor({ count: 1, overdue: 1, overdueInvoice: { invoiceNo: 'A', day: inv.day, total: 4.24, payUrl: stripe } })!;
    assert.deepEqual(banner, page);
  });
  it('two or more overdue: the count and the earliest day, pointing at Plan & billing; never a shut-off', () => {
    const line = overdueBannerFor({ count: 3, overdue: 2, earliestOverdue: '2026-11-20T15:00:00Z' })!;
    assert.equal(line.lead, '2 invoices for Stripe fees are overdue. The earliest was due Nov 20.');
    assert.equal(line.action.kind, 'see');
    assert.doesNotMatch(`${line.lead} ${line.detail}`, /suspend|switch|shut|cancel|lose/i);
  });
  it('one overdue the brief could not name (no number) still says so, in the singular', () => {
    const line = overdueBannerFor({ count: 1, overdue: 1, earliestOverdue: '2026-12-01T15:00:00Z' })!;
    assert.equal(line.lead, '1 invoice for Stripe fees is overdue. The earliest was due Dec 1.');
  });
  it('a pay link that is not https never becomes a button', () => {
    const line = overdueBannerFor({ count: 1, overdue: 1, overdueInvoice: { invoiceNo: 'A', day: '2026-12-01T00:00:00Z', total: 1, payUrl: 'javascript:alert(1)' } })!;
    assert.equal(line.action.kind, 'see');
  });
});

describe('Plan & billing: the banner replaces the red line', () => {
  const inv = (no: string, state: FeeInvoice['state'], day: string): FeeInvoice => ({ invoiceNo: no, state, day, total: 4.24, taxLines: [], payUrl: stripe });
  const read = (...invoices: FeeInvoice[]): FeesRead => ({
    planFree: false, invoices,
    fees: invoices.map((i, n) => ({ id: `f${n}`, line: 'x', createdAt: '2026-10-27', amount: 1, credit: false, state: i.state as FeeRow['state'], invoiceNo: i.invoiceNo, invoiceDay: i.day, payUrl: stripe })),
  });
  it('with the banner up the page line is amber only: an overdue invoice leaves it, an open one stays', () => {
    const r = read(inv('LATE', 'own_overdue', '2026-11-20'), inv('OPEN', 'own_open', '2026-12-20'));
    const line = feeLineFor(r, { overdue: false })!;
    assert.equal(line.tone, 'amber'); assert.match(line.lead, /Invoice OPEN .* due/);
    assert.equal(feeLineFor(read(inv('LATE', 'own_overdue', '2026-11-20')), { overdue: false }), null);
  });
  it('without the banner (a cancelled club) both tones draw, as before', () => {
    assert.equal(feeLineFor(read(inv('LATE', 'own_overdue', '2026-11-20')))!.tone, 'red');
    const load = billingTestLoader();
    const { default: Line } = load('components/billing/FeeInvoiceLine.tsx') as { default: ComponentType<{ read: FeesRead | null; overdue?: boolean }> };
    const r = read(inv('LATE', 'own_overdue', '2026-11-20'));
    assert.equal(renderToStaticMarkup(createElement(Line, { read: r, overdue: false })), '');
    assert.match(renderToStaticMarkup(createElement(Line, { read: r, overdue: true })), /calloutDanger/);
  });
  it('the cancelled and free-time-error layouts now carry the line too (the overdue flag itself is pinned in fee-invoice-line.test)', () => {
    const body = readCode('components/billing/BillingBody.tsx');
    assert.equal((body.match(/\{feeLine\}/g) ?? []).length, 3, 'the ordinary page, the cancelled card and the failed free-time read');
  });
});

describe('where the banner sits and who sees it', () => {
  const chrome = readCode('app/[orgSlug]/admin/AdminChrome.tsx');
  const banner = readCode('components/admin/kit/club/FeeOverdueBanner.tsx');
  const css = readCode('components/admin/kit/club/FeeOverdueBanner.module.css');
  it('is the first thing in the content column, above the header, and not in the cancelled shell (Q1, Q4)', () => {
    // `readCode` strips comments, so the JSX comment between the two is an empty `{ }`.
    assert.match(chrome, /\{!suspended && <FeeOverdueBanner \/>\}\s*\{\s*\}\s*<AdminEventHeader/);
    assert.match(chrome, /const FeeOverdueBanner = dynamic\(/);
  });
  it('is owner only (the pill\'s own test), reads the brief rather than fetching, and has no dismiss', () => {
    assert.match(banner, /billingLink \? overdueBannerFor\(brief\?\.feesOwed\) : null/);
    assert.doesNotMatch(banner, /useAdminKitNav/, 'the full nav hook fetches coach access on every admin page');
    assert.doesNotMatch(banner, /fetch\(|localStorage|sessionStorage|dismiss|onClose|snooze/i);
  });
  it('re-reads the brief when the tab returns, on every page and at most once per gap, with no timer', () => {
    assert.match(banner, /visibilitychange/); assert.match(banner, /reload\(\)/);
    assert.match(banner, /const watching = !!line;/);
    assert.match(banner, /Date\.now\(\) - lastRead\.current < RE_READ_GAP_MS/);
    assert.doesNotMatch(banner, /setInterval|setTimeout/);
  });
  it('tells a screen that measured the header (the chat) when the banner arrives or goes, and its button waits for the list', () => {
    assert.match(banner, /dispatchEvent\(new Event\('resize'\)\)/);
    assert.match(banner, /if \(onBilling\) \{ e\.preventDefault\(\); seeFeeInvoicesWhenReady\(\); \}/);
    assert.match(banner, /aria-label=\{onBilling \? action\.aria : undefined\}/);
    assert.match(readCode('components/billing/seeFeeInvoices.ts'), /MutationObserver/);
  });
  it('is a persistent status line, not an alert; scrolls away (no sticky); tokens only; 44 px button on a phone', () => {
    assert.match(banner, /role="status"/);
    assert.doesNotMatch(css, /sticky|fixed/);
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    assert.match(css, /border-left: 3px solid var\(--danger\)/);
    assert.match(css, /min-height: var\(--tap-min, 44px\)/);
  });
  it('the words are the vocabulary\'s, never typed here, and the brief widening stays owner-only', () => {
    assert.doesNotMatch(banner, /for Stripe fees|Pay invoice['`"]|\$\s?\d/);
    assert.match(readCode('app/api/admin/club-brief/route.ts'), /if \(canSeeFeesOwed\(ctx\.role, ctx\.capabilities\)\)/);
  });
});

describe('the fees read always includes every open invoice (Q5)', () => {
  const src = readCode('lib/platform-stripe-fees.ts');
  it('asks for this org\'s open invoices in this Stripe mode and fetches their fees beyond the newest-fifty window', () => {
    assert.match(src, /from\('platform_fee_invoices'\)\.select\('id'\)\s*\.eq\('org_id', orgId\)\.eq\('livemode', stripeKeyIsLive\(\)\)\.eq\('status', FEE_INVOICE_OWED_STATUS\)/);
    assert.match(src, /\.in\('fee_invoice_id', \[\.\.\.openIds\]\)/);
  });
  it('an open invoice is never "incomplete" because of the cap, so its tax line is still drawn', () => {
    assert.match(src, /openIds\.has\(inv\.id\) && !extraCapped && openIds\.size < OPEN_INVOICE_CAP/);
    assert.match(src, /\(openComplete \|\| windowFees\.length < limit\)/);
  });
});
