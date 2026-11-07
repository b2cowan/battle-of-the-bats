import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { consoleDate, consoleDay } from '../../lib/console-dates.ts';
import { findPatterns, type MoneyCharge, type MoneyInvoice } from '../../lib/console-money.ts';
import {
  addressChangedSince, beforeRegistration, creditNoteTaxWords, evidenceLines, gstAnswerWords, isUnpaidSale, isVoidSale, joinSales,
  keptWords, recordMoneyBand, saleCardCell, saleCents, saleFlag, saleRecordSays, saleStripeSays, saleTaxCell, saleWhatWords,
  saleWindowBand, taxLineWords, taxReasonWords, taxedForWords, SALES_WORDS,
  type SaleNoteRecord, type SaleRecord, type SaleRow,
} from '../../lib/console-money-sales.ts';
import type { StoredTaxLine } from '../../lib/charge-tax-record.ts';
import { readCode } from './_source-code.ts';

/**
 * GST/HST Stage 3 Part 2 (owner 2026-11-06, all eight Asks A; drawings GST_HST_STAGE3_PART2_DRAWINGS.html): the Money tab is one
 * row per SALE from our kept record, Stripe's payments joined in, with a Tax column and a sale window. These pin the join and
 * every word it says, one case per row kind drawn on tab 2, plus Stripe unreachable and our records failing (tab 4).
 */

const REG = '2026-09-26'; // the registration effective date as the Stage 4a setting holds it today (never hard-coded in the screen)

const line = (over: Partial<StoredTaxLine> = {}): StoredTaxLine => ({
  source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', region: null,
  rate: 13, effective_rate: 13, taxable_cents: 8850, cents: 1151, taxability_reason: 'standard_rated', tax_rate_id: 'txr_1', tax_behavior: 'exclusive',
  ...over,
});

function rec(id: string, over: Partial<SaleRecord> = {}): SaleRecord {
  return {
    stripe_invoice_id: id, livemode: false, kind: 'subscription', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
    stripe_payment_intent_id: `pi_${id}`, invoice_number: '7C1E-0002', issued_at: '2026-11-01T10:02:00.000Z', currency: 'cad',
    amount_before_tax_cents: 8850, tax_total_cents: 1151, total_cents: 10001, refunded_cents: 0, tax_lines: [line()],
    gst_hst_position: 'taxed', gst_hst_position_why: null, status: 'paid', paid_at: '2026-11-01T10:02:00.000Z', voided_at: null, uncollectible_at: null,
    taxed_country: 'CA', taxed_region: 'ON', taxed_postal_code: 'N1H 4H2', evidence_missing: false, evidence_country: 'CA', evidence_region: 'ON',
    evidence_line1: '120 Elm Street', evidence_line2: null, evidence_city: 'Guelph', evidence_postal_code: 'N1H 4H2',
    us_declaration_version: null, us_declaration_at: null, card_country: 'CA', payout_country: 'CA', review_reason: null, review_note: null,
    evidence_read_at: '2026-11-01T10:02:00.000Z', evidence_captured: 'event',
    fx_rate: null, fx_rate_date: null, cad_amount_before_tax_cents: 8850, cad_tax_total_cents: 1151, cad_total_cents: 10001,
    ...over,
  } as SaleRecord;
}

function inv(id: string, over: Partial<MoneyInvoice> = {}): MoneyInvoice {
  return {
    id, number: '7C1E-0002', billingReason: 'subscription_cycle', subscriptionId: 'sub_1', periodStart: '2026-11-01T10:00:00.000Z',
    periodEnd: '2026-12-01T10:00:00.000Z', planId: 'club', cycle: 'monthly', fromPlanId: null, description: null, feeInvoice: false, taxCents: 1151,
    status: 'paid', issuedAt: '2026-11-01T10:02:00.000Z', currency: 'cad', totalCents: 10001, amountDueCents: 10001, amountRemainingCents: 0,
    dueDate: null, markedUncollectibleAt: null, ...over,
  };
}

function charge(id: string, invoice: MoneyInvoice | null, over: Partial<MoneyCharge> = {}): MoneyCharge {
  return {
    id, createdAt: '2026-11-01T10:02:30.000Z', amountCents: invoice?.totalCents ?? 2500, currency: 'cad', status: 'succeeded', refundedCents: 0,
    disputed: false, failureCode: null, card: { brand: 'visa', last4: '4242' }, refunds: [], invoice, paymentIntentId: invoice ? `pi_${invoice.id}` : 'pi_bare',
    ...over,
  };
}

const one = (rows: SaleRow[], key: string) => {
  const r = rows.find(x => x.key === key);
  assert.ok(r, `a row for ${key}`);
  return r!;
};

describe('the join: one row per sale', () => {
  it('a paid sale joins its record, Stripe’s invoice and its charge into ONE row, and the row names HST 13% · $11.51 · Ontario', () => {
    const i = inv('in_a');
    const rows = joinSales({ records: [rec('in_a')], notes: [], charges: [charge('ch_a', i)], invoices: [i], shownFrom: null });
    assert.equal(rows.length, 1);
    const r = one(rows, 'in_a');
    assert.equal(r.paid?.id, 'ch_a');
    assert.deepEqual(saleTaxCell(r, REG), { tone: 'plain', main: 'HST 13%', sub: '$11.51 · Ontario' });
    assert.deepEqual(saleWhatWords(r), { main: 'Club, monthly', period: 'Nov 1 to Dec 1, 2026' }, 'the tax phrase leaves the period line (Ask 3)');
    assert.equal(saleStripeSays(r).text, 'Paid');
    assert.equal(saleCardCell(r, true).text, 'Visa 4242');
  });

  it('a charge Stripe did not tie to an invoice still joins its sale by its payment (the record keeps it)', () => {
    const rows = joinSales({ records: [rec('in_p')], notes: [], charges: [charge('ch_p', null, { paymentIntentId: 'pi_in_p' })], invoices: [], shownFrom: null });
    assert.equal(rows.length, 1);
    assert.equal(one(rows, 'in_p').paid?.id, 'ch_p');
  });

  it('BC: GST 5% charged, PST not collected — the row names only what was charged; the window lists both lines', () => {
    const r = rec('in_bc', { taxed_region: 'BC', tax_total_cents: 443, tax_lines: [
      line({ name: 'GST', tax_type: 'gst', rate: 5, cents: 443 }),
      line({ name: 'PST', tax_type: 'pst', jurisdiction: 'British Columbia', rate: 7, cents: 0, taxability_reason: 'not_collecting' }),
    ] });
    const row = one(joinSales({ records: [r], notes: [], charges: null, invoices: [], shownFrom: null }), 'in_bc');
    assert.deepEqual(saleTaxCell(row, REG), { tone: 'plain', main: 'GST 5%', sub: '$4.43 · British Columbia' });
    assert.deepEqual(r.tax_lines.map(l => taxLineWords(l, 'cad')), [
      'GST 5% · Canada · $4.43 · charged',
      'PST 7% · British Columbia · $0.00 · not collected: we are not registered there',
    ]);
    assert.equal(gstAnswerWords(r, REG).text, 'Stripe charged GST to a buyer in British Columbia.');
  });

  it('zero-rated: our answer, our 0% line marked "our line", Stripe’s New York line shown as Stripe said it, the CAD band notes', () => {
    const r = rec('in_us', { kind: 'premium', currency: 'usd', taxed_country: 'US', taxed_region: 'NY', taxed_postal_code: '14202', gst_hst_position: 'zero_rated',
      amount_before_tax_cents: 9900, tax_total_cents: 0, total_cents: 9900, cad_amount_before_tax_cents: 13773, cad_total_cents: 13773, fx_rate: 1.3912, fx_rate_date: '2026-10-12',
      tax_lines: [
        line({ name: 'Sales Tax', tax_type: 'sales_tax', jurisdiction: 'New York', country: 'US', region: 'NY', rate: 8.875, cents: 0, taxability_reason: 'not_collecting' }),
        line({ source: 'ours', name: 'GST/HST', tax_type: 'gst', rate: 0, cents: 0, taxability_reason: 'zero_rated' }),
      ] });
    const row = one(joinSales({ records: [r], notes: [], charges: null, invoices: [], shownFrom: null }), 'in_us');
    assert.deepEqual(saleTaxCell(row, REG), { tone: 'plain', main: 'Zero-rated', sub: 'United States' });
    assert.deepEqual(r.tax_lines.map(l => taxLineWords(l, 'usd')), [
      'Sales Tax 8.875% · New York · US$0.00 · not collected: we are not registered there',
      'GST/HST 0% · Canada · US$0.00 · zero-rated (our line)',
    ]);
    assert.equal(gstAnswerWords(r, REG).lead, 'Zero-rated.');
    assert.deepEqual(saleWindowBand(r, []), [
      { label: 'Before tax', value: 'US$99.00', note: '$137.73 in Canadian dollars' },
      { label: 'Tax', value: 'US$0.00', note: 'zero-rated' },
      { label: 'Total', value: 'US$99.00', note: '$137.73 in Canadian dollars' },
    ]);
    assert.equal(taxedForWords(r), 'New York, United States · 14202');
  });

  it('tax missing after registration: the amber chip with the province; before registration: quiet "Before we registered"', () => {
    const missing = rec('in_m', { taxed_region: 'AB', gst_hst_position: 'missing', gst_hst_position_why: 'canadian_buyer_not_charged', tax_total_cents: 0, total_cents: 8850,
      issued_at: '2026-10-01T10:00:00.000Z', tax_lines: [line({ name: 'GST', tax_type: 'gst', rate: 5, cents: 0, taxability_reason: 'not_collecting' })] });
    const row = one(joinSales({ records: [missing], notes: [], charges: null, invoices: [], shownFrom: null }), 'in_m');
    assert.deepEqual(saleTaxCell(row, REG), { tone: 'missing', main: 'Tax missing', sub: 'Alberta' });
    assert.deepEqual(gstAnswerWords(missing, REG), { lead: 'Missing.', text: 'A Canadian buyer was not charged GST/HST.', tone: 'warn' });
    assert.equal(taxLineWords(missing.tax_lines[0], 'cad'), 'GST 5% · Canada · $0.00 · not collected: Stripe had no registration for it');
    assert.deepEqual(saleWindowBand(missing, [])[1], { label: 'Tax', value: '$0.00', note: 'none charged' });

    const before = { ...missing, stripe_invoice_id: 'in_b', issued_at: '2026-09-01T10:00:00.000Z' };
    const brow = one(joinSales({ records: [before], notes: [], charges: null, invoices: [], shownFrom: null }), 'in_b');
    assert.deepEqual(saleTaxCell(brow, REG), { tone: 'quiet', main: 'Before we registered', sub: 'no GST/HST owed' });
    assert.equal(gstAnswerWords(before, REG).text, `Issued before our GST/HST registration took effect on ${consoleDate(REG)}, so no GST/HST was owed.`);
    // The day is the Toronto day: 11:30 p.m. Sept 25 in Toronto is before Sept 26, 03:30 UTC Sept 26 or not.
    assert.equal(beforeRegistration('2026-09-26T03:30:00.000Z', REG), true);
    assert.equal(beforeRegistration('2026-09-26T04:30:00.000Z', REG), false);
    // A moved registration date (CRA approving May 1) moves the answer with it; nothing is written into the screen.
    assert.equal(saleTaxCell(brow, '2026-05-01').tone, 'missing');
  });

  it('the registration date unreadable: an untaxed sale is never "Tax missing", only quiet "Not taxed", and the caption says why', () => {
    const missing = rec('in_m', { gst_hst_position: 'missing', gst_hst_position_why: 'canadian_buyer_not_charged', issued_at: '2026-10-01T10:00:00.000Z' });
    const row = one(joinSales({ records: [missing], notes: [], charges: null, invoices: [], shownFrom: null }), 'in_m');
    assert.deepEqual(saleTaxCell(row, null), { tone: 'quiet', main: 'Not taxed', sub: null });
    assert.equal(SALES_WORDS.registrationUnread, 'The GST/HST registration date could not be read, so sales without tax are not sorted.');
    // Before the records began is before either registration date, so it still reads as before.
    assert.equal(saleTaxCell({ ...row, record: { ...missing, issued_at: '2026-04-20T10:00:00.000Z' } }, null).main, 'Before we registered');
  });

  it('open after a failed try: the try folds into its sale, which says what is owed and why; the card is the one that failed', () => {
    const i = inv('in_o', { status: 'open', planId: 'club', cycle: 'annual', totalCents: 107237, amountRemainingCents: 107237 });
    const failed = charge('ch_f', i, { status: 'failed', failureCode: 'card_declined', amountCents: 107237, card: { brand: 'visa', last4: '0341' } });
    const rows = joinSales({ records: [rec('in_o', { status: 'open', paid_at: null, total_cents: 107237 })], notes: [], charges: [failed], invoices: [i], shownFrom: null });
    assert.equal(rows.length, 1, 'no second row for the failed try');
    const r = rows[0];
    assert.deepEqual(saleStripeSays(r), { text: `Owes $1,072.37 · card declined ${consoleDay(failed.createdAt)}`, tone: 'bad', sub: null, void: false });
    assert.equal(saleCardCell(r, true).text, 'Visa 0341');
    assert.equal(isUnpaidSale(r), true);
  });

  it('paid after a failed try: "after 1 failed try, {day}" under Paid, and the shipped "tried again" flag line is not repeated', () => {
    const i = inv('in_r');
    const failed = charge('ch_r1', i, { status: 'failed', failureCode: 'card_declined', createdAt: '2026-11-01T10:02:30.000Z' });
    const paid = charge('ch_r2', i, { createdAt: '2026-11-03T10:00:00.000Z' });
    const rows = joinSales({ records: [rec('in_r')], notes: [], charges: [paid, failed], invoices: [i], shownFrom: null });
    const r = one(rows, 'in_r');
    assert.equal(saleStripeSays(r).sub, `after 1 failed try, ${consoleDay(failed.createdAt)}`);
    const patterns = findPatterns({ charges: [paid, failed], subscriptions: [] }, 'sub_1');
    assert.equal(patterns.flags.get('ch_r2')?.kind, 'retry_paid');
    assert.equal(saleFlag(r, patterns), null);
  });

  it('a sale charged twice keeps the shipped "Charged twice" line, on the later charge', () => {
    const i1 = inv('in_d1'); const i2 = inv('in_d2', { issuedAt: '2026-11-01T10:05:00.000Z' });
    const c1 = charge('ch_d1', i1); const c2 = charge('ch_d2', i2, { createdAt: '2026-11-01T10:05:30.000Z' });
    const rows = joinSales({ records: [rec('in_d1'), rec('in_d2', { issued_at: '2026-11-01T10:05:00.000Z' })], notes: [], charges: [c1, c2], invoices: [i1, i2], shownFrom: null });
    const flag = saleFlag(one(rows, 'in_d2'), findPatterns({ charges: [c1, c2], subscriptions: [] }, 'sub_1'));
    assert.equal(flag?.flag.kind, 'duplicate');
    assert.equal(flag?.chargeId, 'ch_d2');
  });

  it('written off, void, $0 trial, paid outside Stripe and paid from credit each say so', () => {
    const wo = rec('in_w', { status: 'uncollectible', paid_at: null, uncollectible_at: '2026-11-03T15:00:00.000Z' });
    const woRow = one(joinSales({ records: [wo], notes: [], charges: [], invoices: [inv('in_w', { status: 'uncollectible' })], shownFrom: null }), 'in_w');
    assert.equal(saleStripeSays(woRow).text, `Written off ${consoleDay(wo.uncollectible_at)}`);
    assert.equal(saleCardCell(woRow, true).text, '—');
    assert.equal(isUnpaidSale(woRow), true, 'not paid = open or written off (gap 5)');

    const v = one(joinSales({ records: [rec('in_v', { status: 'void', paid_at: null })], notes: [], charges: [], invoices: [inv('in_v', { status: 'void' })], shownFrom: null }), 'in_v');
    assert.equal(isVoidSale(v), true);
    assert.equal(saleStripeSays(v).void, true);
    assert.equal(saleTaxCell(v, REG).main, '—');
    assert.equal(isUnpaidSale(v), false, 'a void sale is never "not paid"');

    const trial = one(joinSales({ records: [rec('in_t', { amount_before_tax_cents: 0, tax_total_cents: 0, total_cents: 0, tax_lines: [line({ cents: 0, taxable_cents: 0 })] })],
      notes: [], charges: [], invoices: [inv('in_t', { totalCents: 0, amountDueCents: 0 })], shownFrom: null }), 'in_t');
    assert.equal(saleStripeSays(trial).text, 'Nothing to pay');
    assert.deepEqual(saleTaxCell(trial, REG), { tone: 'plain', main: 'HST 13%', sub: '$0.00 · Ontario' }, '$0.00 tax is the true figure');

    const outside = one(joinSales({ records: [rec('in_x', { kind: 'one_off', stripe_subscription_id: null })], notes: [], charges: [],
      invoices: [inv('in_x', { subscriptionId: null, description: 'Setup help' })], shownFrom: null }), 'in_x');
    assert.equal(saleStripeSays(outside).text, 'Paid outside Stripe');
    assert.deepEqual(saleWhatWords(outside), { main: 'Invoice made in Stripe “Setup help”', period: 'Not the subscription’s' });

    const credit = one(joinSales({ records: [rec('in_c')], notes: [], charges: [], invoices: [inv('in_c', { amountDueCents: 0 })], shownFrom: null }), 'in_c');
    assert.equal(saleStripeSays(credit).text, 'Paid from credit');
  });

  it('a sale older than the oldest charge Stripe reached (a capped read) is flagged charge-unread, never "outside Stripe"', () => {
    const base = { notes: [], invoices: [] as MoneyInvoice[], shownFrom: null };
    const old = rec('in_old', { issued_at: '2026-06-01T10:00:00+00:00' }); // the database's own shape
    const flagged = one(joinSales({ ...base, records: [old], charges: [], chargesFrom: '2026-08-01T00:00:00.000Z' }), 'in_old');
    assert.equal(flagged.chargeUnread, true, 'older than where the charges are complete, with no charge');
    // Not flagged: newer than the floor, no floor known, Stripe not read, or a charge was found.
    assert.equal(one(joinSales({ ...base, records: [old], charges: [], chargesFrom: '2026-05-01T00:00:00.000Z' }), 'in_old').chargeUnread, false);
    assert.equal(one(joinSales({ ...base, records: [old], charges: [] }), 'in_old').chargeUnread, false);
    assert.equal(one(joinSales({ ...base, records: [old], charges: null, chargesFrom: '2026-08-01T00:00:00.000Z' }), 'in_old').chargeUnread, false);
    const i = inv('in_old');
    const withCharge = one(joinSales({ ...base, records: [old], charges: [charge('ch_old', i)], invoices: [i], chargesFrom: '2026-08-01T00:00:00.000Z' }), 'in_old');
    assert.equal(withCharge.chargeUnread, false);
  });

  it('a fee invoice owed and not charged yet: issued and due under its name, "Not charged yet", "Owes … · due …"', () => {
    const fee = inv('in_fee', { feeInvoice: true, subscriptionId: null, number: '7C1E-0003', status: 'open', totalCents: 2644, amountRemainingCents: 2644,
      dueDate: '2026-12-02T15:00:00.000Z', issuedAt: '2026-11-02T14:00:00.000Z' });
    const r = one(joinSales({ records: [rec('in_fee', { kind: 'fee', status: 'open', paid_at: null, issued_at: '2026-11-02T14:00:00.000Z', total_cents: 2644, tax_total_cents: 304 })],
      notes: [], charges: [], invoices: [fee], shownFrom: null }), 'in_fee');
    assert.deepEqual(saleWhatWords(r), { main: 'Stripe fees on online payments · invoice 7C1E-0003', period: `Issued ${consoleDay(r.at)} · due ${consoleDay(fee.dueDate!)}` });
    assert.equal(saleCardCell(r, true).text, 'Not charged yet');
    assert.equal(saleStripeSays(r).text, `Owes $26.44 · due ${consoleDay(fee.dueDate!)}`);
  });

  it('a bare charge (no invoice) shows from Stripe as "No tax record · not an invoice", whatever its date', () => {
    const rows = joinSales({ records: [], notes: [], charges: [charge('ch_bare', null, { createdAt: '2026-06-20T17:30:00.000Z' })], invoices: [], shownFrom: null });
    const r = one(rows, 'ch_bare');
    assert.equal(r.bare, true);
    assert.deepEqual(saleTaxCell(r, REG), { tone: 'quiet', main: 'No tax record', sub: 'not an invoice' });
    assert.equal(saleWhatWords(r).main, 'A charge made in Stripe, not by an invoice');
  });

  it('a record not written yet shows from Stripe ("not written yet"); one issued before the records began reads "Before we registered"', () => {
    const fresh = inv('in_new', { issuedAt: '2026-11-06T14:00:00.000Z', status: 'open', amountRemainingCents: 10001 });
    const rows = joinSales({ records: [], notes: [], charges: [], invoices: [fresh], shownFrom: '2025-11-06T00:00:00.000Z' });
    assert.deepEqual(saleTaxCell(one(rows, 'in_new'), REG), { tone: 'quiet', main: 'No tax record', sub: 'not written yet' });

    const old = inv('in_old', { issuedAt: '2026-03-01T14:00:00.000Z' });
    const oldRows = joinSales({ records: [], notes: [], charges: [charge('ch_old', old, { createdAt: '2026-03-01T14:00:30.000Z' })], invoices: [old], shownFrom: '2025-11-06T00:00:00.000Z' });
    assert.deepEqual(saleTaxCell(one(oldRows, 'in_old'), REG), { tone: 'quiet', main: 'Before we registered', sub: 'no GST/HST owed' });
    // A Stripe invoice with neither a record nor a charge, from before the records began, is not a row (the list is Stripe's charges there).
    const preFloor = inv('in_pre', { issuedAt: '2026-03-01T14:00:00.000Z', totalCents: 0 });
    assert.equal(joinSales({ records: [], notes: [], charges: [], invoices: [preFloor], shownFrom: '2025-11-06T00:00:00.000Z' }).length, 0);
  });

  it('Stripe unreachable: rows from our record alone; Card "Not read"; "Our record says"; the band from our record; refunds wait', () => {
    const rows = joinSales({ records: [
      rec('in_1'), rec('in_2', { issued_at: '2026-10-01T10:01:00.000Z', paid_at: '2026-10-01T10:01:00.000Z', refunded_cents: 5000 }),
      rec('in_3', { status: 'open', paid_at: null, issued_at: '2026-11-02T14:00:00.000Z' }), rec('in_4', { status: 'void', paid_at: null }),
    ], notes: [], charges: null, invoices: [inv('in_1')], shownFrom: null });
    assert.equal(rows.length, 4);
    assert.ok(rows.every(r => r.invoice === null && r.charges.length === 0), 'nothing of Stripe’s is used when Stripe was not read');
    assert.equal(saleCardCell(one(rows, 'in_1'), false).text, 'Not read');
    assert.equal(saleRecordSays(one(rows, 'in_2')).text, `Paid ${consoleDay('2026-10-01T10:01:00.000Z')} · $50.00 refunded`);
    assert.equal(saleRecordSays(one(rows, 'in_3')).text, 'Open');
    assert.equal(saleWhatWords(one(rows, 'in_1')).main, 'The subscription · invoice 7C1E-0002', 'what the record knows (gap 1)');
    const band = recordMoneyBand(rows, '2025-11-06T00:00:00.000Z');
    assert.equal(band[0].value, '$200.02');
    assert.match(band[0].note, /^2 paid sales since .* · our record$/);
    assert.deepEqual([band[1].value, band[1].note], ['$50.00', '1 sale refunded · our record']);
    assert.deepEqual([band[2].value, band[2].tone], ['Not read', 'warn']);
    assert.equal(SALES_WORDS.refundsWait, 'Refunds wait until Stripe answers.');
  });

  it('our records failing: Stripe’s charges still list (as sales from Stripe), the Tax column reads "Not read"', () => {
    const i = inv('in_a');
    const rows = joinSales({ records: [], notes: [], charges: [charge('ch_a', i)], invoices: [i], shownFrom: null });
    assert.equal(rows.length, 1);
    assert.deepEqual(saleTaxCell(rows[0], REG, false), { tone: 'quiet', main: 'Not read', sub: null });
  });

  it('a credit note nets each figure of the window’s band, and its line names the GST/HST it took back', () => {
    const r = rec('in_cn');
    const note: SaleNoteRecord = { stripe_credit_note_id: 'cn_1', stripe_invoice_id: 'in_cn', note_number: 'CN-0001', issued_at: '2026-11-04T19:10:00.000Z', currency: 'cad',
      amount_before_tax_cents: 4425, tax_total_cents: 575, total_cents: 5000, tax_lines: [line({ cents: 575, taxable_cents: 4425 })], status: 'issued' };
    const row = one(joinSales({ records: [r], notes: [note, { ...note, stripe_credit_note_id: 'cn_void', status: 'void' }], charges: null, invoices: [], shownFrom: null }), 'in_cn');
    assert.equal(row.notes.length, 1, 'a void note nets nothing');
    assert.deepEqual(saleWindowBand(r, row.notes), [
      { label: 'Before tax', value: '$88.50', note: '$44.25 credited · $44.25 left' },
      { label: 'HST 13%', value: '$11.51', note: '$5.75 credited · $5.76 left' },
      { label: 'Total', value: '$100.01', note: '$50.00 credited · $50.01 left' },
    ]);
    assert.equal(creditNoteTaxWords({ id: 'cn_1' }, row.notes), ', of it $5.75 HST');
    assert.equal(creditNoteTaxWords({ id: 'cn_unknown' }, row.notes), '');
  });
});

describe('the window’s words', () => {
  it('"Kept" in the three wordings; only "at the sale" is plain', () => {
    assert.deepEqual(keptWords(rec('a')), { text: 'At the sale, when the invoice was issued', warn: false });
    const back = keptWords(rec('a', { evidence_captured: 'backfill', evidence_read_at: '2026-11-06T15:00:00.000Z' }));
    assert.equal(back.warn, true);
    assert.equal(back.text, `Copied from Stripe on ${consoleDate('2026-11-06T15:00:00.000Z')}, when the tax records began. The address and card are as they stood that day, not on the day of the sale.`);
    assert.match(keptWords(rec('a', { evidence_captured: 'catch_up' })).text, /^Caught up by the daily job on .*: the address and card are as they stood that day, not at the sale\.$/);
  });

  it('the evidence as it stood: address, US declaration, card and payout countries, the review at the time', () => {
    assert.deepEqual(evidenceLines(rec('a')), ['120 Elm Street, Guelph, Ontario N1H 4H2', 'Card from Canada · payouts to Canada', 'No review open']);
    const us = rec('a', { evidence_country: 'US', evidence_region: 'NY', evidence_line1: '88 Delaware Avenue', evidence_line2: 'Suite 400', evidence_city: 'Buffalo',
      evidence_postal_code: '14202', us_declaration_version: 'us-2026-11-v2', us_declaration_at: '2026-10-03T14:00:00.000Z', card_country: 'US', payout_country: null });
    assert.deepEqual(evidenceLines(us), [
      '88 Delaware Avenue, Suite 400, Buffalo, New York 14202',
      `US declaration ticked ${consoleDate('2026-10-03T14:00:00.000Z')} (wording us-2026-11-v2)`,
      'Card from the United States',
      'No review open',
    ]);
    assert.equal(evidenceLines(rec('a', { evidence_missing: true, evidence_country: null }))[0], 'No billing address could be read');
  });

  it('the billing address changed since the sale: one line (and a door to today’s block)', () => {
    const today = { country: 'CA' as const, regionCode: 'ON', line1: '120 Elm Street', line2: null, city: 'Guelph', postalCode: 'N1H4H2', confirmedAt: '', usDeclarationAt: null, usDeclarationVersion: null };
    assert.equal(addressChangedSince(rec('a'), today), false, 'the same address, spaced differently');
    assert.equal(addressChangedSince(rec('a'), { ...today, line1: '9 Oak Road' }), true);
    assert.equal(addressChangedSince(rec('a', { evidence_missing: true }), today), false);
  });

  it('every GST/HST answer has words; a Stripe reason we have no words for shows Stripe’s own code', () => {
    for (const why of ['stripe_did_not_work_out', 'canadian_buyer_not_charged', 'no_evidence_for_zero_rating', 'unexpected_reason'] as const) {
      const w = gstAnswerWords(rec('a', { gst_hst_position: 'missing', gst_hst_position_why: why, issued_at: '2026-10-10T12:00:00.000Z' }), REG);
      assert.equal(w.lead, 'Missing.');
      assert.ok(w.text.length > 10 && w.text !== 'No reason was kept.', why);
    }
    assert.equal(taxReasonWords(line({ taxability_reason: 'some_new_reason' })), 'some_new_reason');
    assert.equal(taxReasonWords(line({ taxability_reason: 'reverse_charge' })), 'reverse charge');
    assert.equal(saleCents(9900, 'usd'), 'US$99.00');
    assert.equal(saleCents(10001, 'cad'), '$100.01');
  });
});

describe('wiring (Ask 7: the Stripe-reading roles only; no migration; read-only)', () => {
  it('the money route reads our records in every state and the registration date from the Stage 4a setting, never a typed date', () => {
    const route = readCode('app/api/platform-admin/orgs/[id]/money/route.ts');
    assert.ok(route.indexOf("requirePlatformPower('find_stripe')") < route.indexOf('readSaleRecords('));
    assert.match(route, /state: 'unreachable', readAt: readAt\.toISOString\(\), records: recordsRead, registrationDate/);
    assert.match(readCode('lib/console-money-sales-store.ts'), /gstRegistrationDate\(\)/);
    assert.doesNotMatch(readCode('lib/console-money-sales.ts') + readCode('app/platform-admin/orgs/[id]/MoneyTab.tsx'), /2026-09-26|Sep(t)? 26/);
  });
  it('the record store only reads (the records are Part 1’s; nothing here writes them)', () => {
    const store = readCode('lib/console-money-sales-store.ts');
    assert.doesNotMatch(store, /\.(upsert|update|delete)\(/);
    // Part 3b: the one write is a mark, into its own table beside the records (never into them).
    assert.equal((store.match(/\.insert\(/g) ?? []).length, 1);
    assert.match(store, /supabaseAdmin\.from\(LOOKS\)\.insert\(row\)/);
  });
});
