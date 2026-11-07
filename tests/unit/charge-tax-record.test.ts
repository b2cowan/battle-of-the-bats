/**
 * GST/HST Stage 3 Part 1: a charge's tax record (lib/charge-tax-record.ts). Fixtures are the shapes Stripe returned in test mode
 * (.probe/gst3/part0-reasons-run1.txt, part0-real-invoice-run1.txt, part0-credit-note-run1.txt), cut to what the builder reads.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildChargeTaxRecord,
  buildCreditNoteTaxRecord,
  cadValuation,
  chargeRecordState,
  chargeTaxKind,
  gstHstPosition,
  rateFromValet,
  amountsOf,
  invoiceIssuedAt,
  noteIssuedAt,
  storedTaxLines,
  valetSeries,
  type InvoiceLike,
  type RecordContext,
  type SaleEvidence,
  type TotalTaxLike,
} from '../../lib/charge-tax-record.ts';

const rate = (over: Record<string, unknown>) => ({
  id: 'txr_x', display_name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA', state: null,
  percentage: 13, effective_percentage: 13, ...over,
});
const HST_ON: TotalTaxLike = { amount: 2847, taxable_amount: 21900, taxability_reason: 'standard_rated', tax_behavior: 'exclusive', tax_rate_details: { tax_rate: rate({ id: 'txr_hst' }) } };
const GST: TotalTaxLike = { amount: 1095, taxable_amount: 21900, taxability_reason: 'standard_rated', tax_behavior: 'exclusive',
  tax_rate_details: { tax_rate: rate({ id: 'txr_gst', display_name: 'GST', tax_type: 'gst', percentage: 5, effective_percentage: 5 }) } };
const PST_BC: TotalTaxLike = { amount: 0, taxable_amount: 0, taxability_reason: 'not_collecting', tax_behavior: 'exclusive',
  tax_rate_details: { tax_rate: rate({ id: 'txr_pst', display_name: 'PST', tax_type: 'pst', jurisdiction: 'British Columbia', jurisdiction_level: 'state', state: 'BC', percentage: 7, effective_percentage: 0 }) } };
const NY: TotalTaxLike = { amount: 0, taxable_amount: 0, taxability_reason: 'not_collecting', tax_behavior: 'exclusive',
  tax_rate_details: { tax_rate: rate({ id: 'txr_ny', display_name: 'Sales Tax', tax_type: 'sales_tax', jurisdiction: 'New York', jurisdiction_level: 'multiple', country: 'US', state: 'NY', percentage: 8.875, effective_percentage: 0 }) } };
const CA_NOT_COLLECTING: TotalTaxLike = { amount: 0, taxable_amount: 0, taxability_reason: 'not_collecting', tax_behavior: 'exclusive',
  tax_rate_details: { tax_rate: rate({ id: 'txr_hst0', effective_percentage: 0 }) } };

const T0 = 1793997010;
const invoice = (over: Partial<InvoiceLike> = {}): InvoiceLike => ({
  id: 'in_1', livemode: false, status: 'paid', number: 'ABC-0001', customer: 'cus_1', customer_name: 'Riverdale Minor Ball',
  customer_address: { country: 'CA', state: 'ON', postal_code: 'M5H 2N2' }, currency: 'cad', total: 24747, total_excluding_tax: 21900,
  total_taxes: [HST_ON], automatic_tax: { enabled: true, status: 'complete' }, effective_at: T0, created: T0,
  status_transitions: { finalized_at: T0, paid_at: T0 + 1, voided_at: null, marked_uncollectible_at: null },
  parent: { subscription_details: { subscription: 'sub_1' } },
  payments: { data: [{ status: 'paid', payment: { payment_intent: 'pi_1' } }] },
  ...over,
});
const location = (over: Partial<NonNullable<SaleEvidence['location']>> = {}): NonNullable<SaleEvidence['location']> => ({
  country: 'CA', regionCode: 'ON', line1: '100 Queen St W', line2: null, city: 'Toronto', postalCode: 'M5H 2N2',
  confirmedAt: '2026-11-01T00:00:00.000Z', usDeclarationAt: null, usDeclarationVersion: null, ...over,
});
const evidence = (over: Partial<SaleEvidence> = {}): SaleEvidence => ({ location: location(), cardCountry: 'CA', payoutCountry: null, review: null, ...over });
const US_EVIDENCE = evidence({
  location: location({ country: 'US', regionCode: 'NY', line1: '350 5th Ave', city: 'New York', postalCode: '10118',
    usDeclarationAt: '2026-11-02T00:00:00.000Z', usDeclarationVersion: 'us-2026-11-v2' }),
  cardCountry: 'us',
});
const ctx = (over: Partial<RecordContext> = {}): RecordContext => ({
  kind: 'subscription', buyer: { kind: 'club', orgId: '00000000-0000-4000-8000-000000000001' }, evidence: evidence(), readAt: '2026-11-06T20:00:00.000Z',
  captured: 'event', fx: null, ...over,
});

describe('a sale in another currency is valued at the Bank of Canada rate on its issue date (Stage 4 Ask 4)', () => {
  const OBS = [
    { d: '2026-11-04', FXUSDCAD: { v: '1.3850' } },
    { d: '2026-11-05', FXUSDCAD: { v: '1.3912' } },
    { d: '2026-11-09', FXUSDCAD: { v: '1.4000' } },
  ];
  it('the day’s rate, else the business day before it (a weekend has none), never a later one', () => {
    assert.deepEqual(rateFromValet(OBS, 'FXUSDCAD', '2026-11-05'), { rate: 1.3912, date: '2026-11-05' });
    assert.deepEqual(rateFromValet(OBS, 'FXUSDCAD', '2026-11-08'), { rate: 1.3912, date: '2026-11-05' });
    assert.equal(rateFromValet(OBS, 'FXUSDCAD', '2026-11-01'), null);
    assert.equal(valetSeries('usd'), 'FXUSDCAD');
  });
  it('the invoice date is Ontario’s day, not UTC’s (a late evening in Eastern time is already tomorrow in UTC)', () => {
    assert.equal(cadValuation('cad', { beforeTax: 0, tax: 0, total: 0 }, '2026-11-06T03:30:00.000Z', null).fx_rate_date, '2026-11-05');
  });
  it('one rule for the issue date and the figures: finalized, else effective, else made; before tax = Stripe’s, else total less tax', () => {
    assert.equal(invoiceIssuedAt({ status_transitions: { finalized_at: 1_762_441_200 }, effective_at: 1, created: 1 }), '2025-11-06T15:00:00.000Z');
    assert.equal(invoiceIssuedAt({ status_transitions: null, effective_at: null, created: 1_762_441_200 }), '2025-11-06T15:00:00.000Z');
    assert.equal(invoiceIssuedAt({ status_transitions: null, effective_at: null, created: null }), null);
    assert.equal(noteIssuedAt({ effective_at: null, created: 1_762_441_200 }), '2025-11-06T15:00:00.000Z');
    assert.deepEqual(amountsOf({ total: 24747, total_excluding_tax: 21900, total_taxes: [{ amount: 2847 }] }), { beforeTax: 21900, tax: 2847, total: 24747 });
    assert.deepEqual(amountsOf({ total: 24747, total_taxes: [{ amount: 2000 }, { amount: 847 }] }), { beforeTax: 21900, tax: 2847, total: 24747 });
  });
  it('a CAD sale is itself; a USD sale carries the rate and each CAD figure; with no rate yet, none', () => {
    assert.deepEqual(cadValuation('cad', { beforeTax: 21900, tax: 2847, total: 24747 }, '2026-11-06T15:00:00.000Z', null), {
      fx_rate: 1, fx_rate_date: '2026-11-06', fx_source: 'same_currency', cad_amount_before_tax_cents: 21900, cad_tax_total_cents: 2847, cad_total_cents: 24747 });
    assert.deepEqual(cadValuation('usd', { beforeTax: 10000, tax: 0, total: 10000 }, '2026-11-06T15:00:00.000Z', { rate: 1.3912, date: '2026-11-05' }), {
      fx_rate: 1.3912, fx_rate_date: '2026-11-05', fx_source: 'bank_of_canada', cad_amount_before_tax_cents: 13912, cad_tax_total_cents: 0, cad_total_cents: 13912 });
    assert.equal(cadValuation('usd', { beforeTax: 10000, tax: 0, total: 10000 }, '2026-11-06T15:00:00.000Z', null).cad_total_cents, null);
  });
  it('a negative proration credit rounds like its positive', () => {
    const v = cadValuation('usd', { beforeTax: -1001, tax: 0, total: -1001 }, '2026-11-06T15:00:00.000Z', { rate: 1.5, date: '2026-11-05' });
    assert.equal(v.cad_amount_before_tax_cents, -1502);
  });
  it('a true half cent rounds up even where binary arithmetic lands a hair under it (100 × 1.005), and nothing is -0', () => {
    const v = cadValuation('usd', { beforeTax: 100, tax: -100, total: 0 }, '2026-11-06T15:00:00.000Z', { rate: 1.005, date: '2026-11-05' });
    assert.equal(v.cad_amount_before_tax_cents, 101);
    assert.equal(v.cad_tax_total_cents, -101);
    assert.ok(Object.is(cadValuation('usd', { beforeTax: -0.1, tax: 0, total: 0 }, '2026-11-06T15:00:00.000Z', { rate: 1, date: '2026-11-05' }).cad_amount_before_tax_cents, 0));
  });
  it('the record carries how it was captured and its CAD figures', () => {
    const row = buildChargeTaxRecord(invoice(), ctx({ captured: 'backfill' }))!;
    assert.equal(row.evidence_captured, 'backfill');
    assert.equal(row.cad_total_cents, 24747);
    assert.equal(row.fx_source, 'same_currency');
  });
});

describe('the tax lines are Stripe’s, verbatim', () => {
  it('names each line from its expanded rate, keeps the reason, and an unexpanded rate keeps its id', () => {
    const [hst] = storedTaxLines([HST_ON]);
    assert.deepEqual(hst, { source: 'stripe', name: 'HST', tax_type: 'hst', jurisdiction: 'Canada', jurisdiction_level: 'country', country: 'CA',
      region: null, rate: 13, effective_rate: 13, taxable_cents: 21900, cents: 2847, taxability_reason: 'standard_rated', tax_rate_id: 'txr_hst', tax_behavior: 'exclusive' });
    const [bare] = storedTaxLines([{ amount: 5, tax_rate_details: { tax_rate: 'txr_bare' } }]);
    assert.equal(bare.name, 'Tax');
    assert.equal(bare.tax_rate_id, 'txr_bare');
  });
});

describe('our GST/HST answer (Ask 2, revised)', () => {
  const lines = (...t: TotalTaxLike[]) => storedTaxLines(t);
  it('a rated Canadian line is taxed — Ontario HST, Alberta GST, and BC (GST taxed while BC PST is not collected)', () => {
    for (const l of [lines(HST_ON), lines(GST), lines(GST, PST_BC)]) {
      assert.deepEqual(gstHstPosition({ taxWorkedOut: true, placeCountry: 'CA', lines: l, evidence: evidence() }), { position: 'taxed', why: null });
    }
  });
  it('a $0 trial is still taxed (the rate applied to nothing)', () => {
    const trial = storedTaxLines([{ ...GST, amount: 0, taxable_amount: 0 }]);
    assert.equal(gstHstPosition({ taxWorkedOut: true, placeCountry: 'CA', lines: trial, evidence: evidence() }).position, 'taxed');
  });
  it('a Canadian buyer Stripe did not charge is MISSING (a live account with no registration answers not_collecting)', () => {
    assert.deepEqual(gstHstPosition({ taxWorkedOut: true, placeCountry: 'CA', lines: lines(CA_NOT_COLLECTING), evidence: evidence() }),
      { position: 'missing', why: 'canadian_buyer_not_charged' });
    assert.deepEqual(gstHstPosition({ taxWorkedOut: true, placeCountry: 'CA', lines: [], evidence: evidence() }),
      { position: 'missing', why: 'canadian_buyer_not_charged' });
  });
  it('a US buyer with a US address and the declaration is zero-rated — OUR call: Stripe shows only the US state', () => {
    assert.deepEqual(gstHstPosition({ taxWorkedOut: true, placeCountry: 'US', lines: lines(NY), evidence: US_EVIDENCE }), { position: 'zero_rated', why: null });
  });
  it('a buyer placed outside Canada without that evidence is MISSING', () => {
    const noDeclaration = evidence({ location: location({ country: 'US', regionCode: 'NY' }) });
    for (const ev of [null, evidence(), noDeclaration]) {
      assert.deepEqual(gstHstPosition({ taxWorkedOut: true, placeCountry: 'US', lines: lines(NY), evidence: ev }),
        { position: 'missing', why: 'no_evidence_for_zero_rating' });
    }
  });
  it('tax Stripe did not work out is MISSING, whatever the lines say', () => {
    assert.deepEqual(gstHstPosition({ taxWorkedOut: false, placeCountry: 'CA', lines: lines(HST_ON), evidence: evidence() }),
      { position: 'missing', why: 'stripe_did_not_work_out' });
  });
  it('Stripe’s own zero rate on a Canadian line is zero-rated; any other reason there is unexpected', () => {
    const zero = storedTaxLines([{ ...HST_ON, amount: 0, taxability_reason: 'zero_rated' }]);
    assert.equal(gstHstPosition({ taxWorkedOut: true, placeCountry: 'CA', lines: zero, evidence: evidence() }).position, 'zero_rated');
    const odd = storedTaxLines([{ ...HST_ON, amount: 0, taxability_reason: 'customer_exempt' }]);
    assert.deepEqual(gstHstPosition({ taxWorkedOut: true, placeCountry: 'CA', lines: odd, evidence: evidence() }), { position: 'missing', why: 'unexpected_reason' });
  });
});

describe('the record', () => {
  it('what Stripe’s dashboard can type never makes a row the table refuses: a long name is cut to 300, a blank number is none', () => {
    const row = buildChargeTaxRecord({ ...invoice(), customer_name: 'x'.repeat(400), number: '' }, ctx())!;
    assert.equal(row.buyer_name!.length, 300);
    assert.equal(row.invoice_number, null);
  });
  it('an Ontario plan: the tax by name, the place Stripe taxed, and the evidence COPIED as it stood', () => {
    const row = buildChargeTaxRecord(invoice(), ctx())!;
    assert.equal(row.stripe_invoice_id, 'in_1');
    assert.equal(row.issued_at, new Date(T0 * 1000).toISOString());
    assert.equal(row.amount_before_tax_cents, 21900);
    assert.equal(row.tax_total_cents, 2847);
    assert.equal(row.total_cents, 24747);
    assert.equal(row.gst_hst_position, 'taxed');
    assert.equal(row.taxed_region, 'ON');
    assert.equal(row.buyer_name, 'Riverdale Minor Ball');
    assert.equal(row.status, 'paid');
    assert.equal(row.stripe_payment_intent_id, 'pi_1');
    assert.equal(row.stripe_subscription_id, 'sub_1');
    assert.equal(row.evidence_missing, false);
    assert.equal(row.evidence_line1, '100 Queen St W');
    assert.equal(row.card_country, 'CA');
    assert.equal(row.org_id, '00000000-0000-4000-8000-000000000001');
    assert.equal(row.user_id, null);
  });
  it('a zero-rated US sale gets our 0% Canadian line beside Stripe’s US line, so the books can total it', () => {
    const row = buildChargeTaxRecord(invoice({ total: 21900, total_taxes: [NY], customer_address: { country: 'US', state: 'NY', postal_code: '10118' } }), ctx({ evidence: US_EVIDENCE }))!;
    assert.equal(row.gst_hst_position, 'zero_rated');
    assert.equal(row.tax_lines.length, 2);
    assert.deepEqual(row.tax_lines.map(l => [l.source, l.country, l.taxability_reason, l.cents]), [['stripe', 'US', 'not_collecting', 0], ['ours', 'CA', 'zero_rated', 0]]);
    assert.equal(row.tax_lines[1].taxable_cents, 21900);
    assert.equal(row.us_declaration_version, 'us-2026-11-v2');
    assert.equal(row.card_country, 'US');
  });
  it('a buyer we could not read keeps evidence_missing, and a Premium buyer is the person', () => {
    const row = buildChargeTaxRecord(invoice(), ctx({ kind: 'premium', evidence: null, buyer: { kind: 'person', userId: 'u1', orgId: 'o1' } }))!;
    assert.equal(row.evidence_missing, true);
    assert.equal(row.evidence_country, null);
    assert.equal(row.buyer_kind, 'person');
    assert.equal(row.user_id, 'u1');
    assert.equal(row.org_id, 'o1');
  });
  it('a flagged review AT THE TIME is copied with its sentence', () => {
    const row = buildChargeTaxRecord(invoice(), ctx({ evidence: evidence({ review: { reason: 'card_country_mismatch', note: 'The address is in Canada, but the card was issued in the United States.' } }) }))!;
    assert.equal(row.review_reason, 'card_country_mismatch');
    assert.match(row.review_note!, /card was issued/);
  });
  it('a draft is not recorded (not issued, nothing owed); automatic tax off records no Stripe status', () => {
    assert.equal(buildChargeTaxRecord(invoice({ status: 'draft' }), ctx()), null);
    const off = buildChargeTaxRecord(invoice({ automatic_tax: { enabled: false, status: null }, total_taxes: [] }), ctx())!;
    assert.equal(off.stripe_tax_status, null);
    assert.deepEqual([off.gst_hst_position, off.gst_hst_position_why], ['missing', 'stripe_did_not_work_out']);
  });
  it('the state carries each change’s own date (a write-off counts in its own period)', () => {
    const state = chargeRecordState(invoice({ status: 'uncollectible', payments: { data: [] },
      status_transitions: { finalized_at: T0, paid_at: null, voided_at: null, marked_uncollectible_at: T0 + 86_400 } }))!;
    assert.equal(state.status, 'uncollectible');
    assert.equal(state.uncollectible_at, new Date((T0 + 86_400) * 1000).toISOString());
    assert.equal(state.stripe_payment_intent_id, null);
  });
  it('the kind: the fee marker first, then a person = Premium, then whether it bills a plan', () => {
    assert.equal(chargeTaxKind({ feeInvoice: true, buyerKind: 'club', subscriptionId: null }), 'fee');
    assert.equal(chargeTaxKind({ feeInvoice: false, buyerKind: 'person', subscriptionId: 'sub_1' }), 'premium');
    assert.equal(chargeTaxKind({ feeInvoice: false, buyerKind: 'club', subscriptionId: 'sub_1' }), 'subscription');
    assert.equal(chargeTaxKind({ feeInvoice: false, buyerKind: 'unknown', subscriptionId: null }), 'one_off');
  });
});

describe('a credit note’s record (Ask 3)', () => {
  const NOTE = {
    id: 'cn_1', livemode: false, invoice: 'in_1', customer: 'cus_1', number: 'ABC-0001-CN-01', type: 'post_payment', reason: 'order_change',
    status: 'issued', currency: 'cad', total: 5650, total_excluding_tax: 5000,
    total_taxes: [{ ...HST_ON, amount: 650, taxable_amount: 5000 }], refunds: [{ amount_refunded: 5650 }], out_of_band_amount: null,
    effective_at: T0 + 100, created: T0 + 100, voided_at: null,
  };
  it('its own date, its tax by line, the part paid back; the owner copied from the invoice’s record', () => {
    const row = buildCreditNoteTaxRecord(NOTE, { kind: 'subscription', orgId: 'o1', userId: null })!;
    assert.equal(row.issued_at, new Date((T0 + 100) * 1000).toISOString());
    assert.equal(row.amount_before_tax_cents, 5000);
    assert.equal(row.tax_total_cents, 650);
    assert.equal(row.refund_cents, 5650);
    assert.equal(row.out_of_band_cents, 0);
    assert.equal(row.tax_lines[0].name, 'HST');
    assert.equal(row.org_id, 'o1');
    assert.equal(row.status, 'issued');
  });
  it('a void note carries its date', () => {
    const row = buildCreditNoteTaxRecord({ ...NOTE, status: 'void', voided_at: T0 + 200 }, { kind: null, orgId: null, userId: null })!;
    assert.equal(row.status, 'void');
    assert.equal(row.voided_at, new Date((T0 + 200) * 1000).toISOString());
  });
});
