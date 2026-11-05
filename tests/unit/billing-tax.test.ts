import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AUTOMATIC_TAX, BILLING_REVIEW_HOLD, BILLING_TAX_WORDS, BUYER_NAME_META, RECOVERED_FEE_TAX, TAXED_CHECKOUT, buyerNameUpdate, decideBuyerTax,
  namedTaxLines, quoteTax, taxLineLabel, taxWasWorkedOut,
} from '../../lib/billing-tax.ts';
import {
  BILLING_ADDRESS_REQUIRED, BILLING_LOCATION_WORDS, CA_POSTAL_FIRST_LETTERS, countryInfo, type StoredBillingLocation,
} from '../../lib/billing-location.ts';

/**
 * GST/HST Stage 2 Part 1 (build prompt docs/projects/active/GST_HST_STAGE2_BUILD_PROMPT.md; owner rulings 2026-11-05): how a
 * buyer is taxed — by the address, a flagged US address held, nobody without an address reaching Stripe.
 */

const stamp = { confirmedAt: '2026-11-05T12:00:00Z', usDeclarationAt: null, usDeclarationVersion: null };
const guelph: StoredBillingLocation = { country: 'CA', regionCode: 'ON', line1: '120 Elm Street', line2: null, city: 'Guelph', postalCode: 'N1H 4H2', ...stamp };
const buffalo: StoredBillingLocation = {
  country: 'US', regionCode: 'NY', line1: '88 Delaware Avenue', line2: 'Suite 400', city: 'Buffalo', postalCode: '14202',
  confirmedAt: stamp.confirmedAt, usDeclarationAt: '2026-11-05T12:00:00Z', usDeclarationVersion: 'us-2026-11-v2',
};

describe('decideBuyerTax', () => {
  it('every province and territory is taxed by its own address', () => {
    for (const r of countryInfo('CA')!.regions) {
      const stored = { ...guelph, regionCode: r.code, postalCode: `${CA_POSTAL_FIRST_LETTERS[r.code][0]}1A 1A1` };
      const t = decideBuyerTax({ stored, review: null, usSalesOpen: false });
      if (!t.ok) assert.fail(r.code);
      assert.deepEqual(t.stripeAddress, { line1: '120 Elm Street', line2: '', city: 'Guelph', state: r.code, postal_code: stored.postalCode, country: 'CA' });
    }
  });
  it('a flagged Canadian address is still taxed by that address (Ask 1)', () => {
    for (const reason of ['card_country_mismatch', 'payout_country_mismatch', 'country_changed_after_paying', 'stripe_edit_invalid'] as const) {
      assert.equal(decideBuyerTax({ stored: guelph, review: { reason }, usSalesOpen: true }).ok, true, reason);
    }
  });
  it('a US buyer, with US sales open and nothing flagged, goes to Stripe (Stripe charges no Canadian tax)', () => {
    const t = decideBuyerTax({ stored: buffalo, review: null, usSalesOpen: true });
    if (!t.ok) assert.fail();
    assert.equal(t.stripeAddress.country, 'US');
    assert.equal(t.stripeAddress.state, 'NY');
  });
  it('a flagged US address is HELD with the plain sentence and its own code (Ask 1)', () => {
    for (const reason of ['card_country_mismatch', 'payout_country_mismatch', 'country_changed_after_paying'] as const) {
      assert.deepEqual(decideBuyerTax({ stored: buffalo, review: { reason }, usSalesOpen: true }),
        { ok: false, code: BILLING_REVIEW_HOLD, error: BILLING_TAX_WORDS.held }, reason);
    }
    assert.match(BILLING_TAX_WORDS.held, /^We need to look at your account before you can pay\./);
    assert.doesNotMatch(BILLING_TAX_WORDS.held, /we’ve told|let .* know|notified/i, 'nothing emails, so the sentence never claims anyone was told');
  });
  it('a US address while US sales are closed (production) never reaches Stripe', () => {
    assert.deepEqual(decideBuyerTax({ stored: buffalo, review: null, usSalesOpen: false }),
      { ok: false, code: BILLING_ADDRESS_REQUIRED, error: BILLING_LOCATION_WORDS.required });
  });
  it('no address, or one that no longer passes, asks for the address', () => {
    const asks = { ok: false, code: BILLING_ADDRESS_REQUIRED, error: BILLING_LOCATION_WORDS.required };
    assert.deepEqual(decideBuyerTax({ stored: null, review: null, usSalesOpen: true }), asks);
    // An Ontario row saved before Ask 4 with a BC postal code: refused now, so the buyer fixes it before tax is charged on it.
    assert.deepEqual(decideBuyerTax({ stored: { ...guelph, postalCode: 'V6C 1T2' }, review: null, usSalesOpen: false }), asks);
    // A US row without its declaration.
    assert.deepEqual(decideBuyerTax({ stored: { ...buffalo, usDeclarationAt: null }, review: null, usSalesOpen: true }), asks);
  });
});

describe('taxWasWorkedOut', () => {
  it('only a complete answer counts: a preview Stripe could not place is a silent $0 (verified in test mode 2026-11-05)', () => {
    assert.equal(taxWasWorkedOut({ enabled: true, status: 'complete' }), true);
    assert.equal(taxWasWorkedOut({ enabled: true, status: 'requires_location_inputs' }), false);
    assert.equal(taxWasWorkedOut({ enabled: true, status: 'failed' }), false);
    assert.equal(taxWasWorkedOut({ enabled: false, status: null }), false);
    assert.equal(taxWasWorkedOut(null), false);
    assert.equal(taxWasWorkedOut(undefined), false);
  });
  it('the one setting is automatic tax on, and the words are one spelling', () => {
    assert.deepEqual(AUTOMATIC_TAX, { enabled: true });
    assert.equal(BILLING_TAX_WORDS.plusTax, 'plus applicable taxes');
  });
});

describe('Part 2 · what a taxed Stripe call carries', () => {
  it('a subscription checkout taxes by the customer, takes a GST/HST number, and never lets Stripe change the address', () => {
    assert.deepEqual(TAXED_CHECKOUT, { automatic_tax: { enabled: true }, tax_id_collection: { enabled: true }, customer_update: { name: 'auto' } });
    assert.equal('address' in TAXED_CHECKOUT.customer_update, false);
  });

  it('a recovered fee is a general service, taxed on top (Ask 3), never the SaaS preset', () => {
    assert.deepEqual(RECOVERED_FEE_TAX, { tax_behavior: 'exclusive', tax_code: 'txcd_20030000' });
    assert.notEqual(RECOVERED_FEE_TAX.tax_code, 'txcd_10103001');
  });
});

describe('buyerNameUpdate · the buyer’s name on the Stripe customer', () => {
  const ours = (name: string) => ({ [BUYER_NAME_META]: name });
  it('names a nameless customer, and remembers it is ours', () => {
    assert.deepEqual(buyerNameUpdate({ name: null, metadata: {} }, 'Riverdale Minor Ball'), { name: 'Riverdale Minor Ball', metadata: ours('Riverdale Minor Ball') });
  });
  it('follows our records when the name is still the one we set (a Premium coach becoming a club)', () => {
    assert.deepEqual(buyerNameUpdate({ name: 'Sam Coach', metadata: ours('Sam Coach') }, 'Riverdale Minor Ball'), { name: 'Riverdale Minor Ball', metadata: ours('Riverdale Minor Ball') });
  });
  it('keeps a name the buyer typed on Stripe’s page (the business name with a GST/HST number)', () => {
    assert.equal(buyerNameUpdate({ name: 'Riverdale Minor Ball Assn. Inc.', metadata: ours('Riverdale Minor Ball') }, 'Riverdale Minor Ball'), null);
    assert.equal(buyerNameUpdate({ name: 'Someone Typed This', metadata: {} }, 'Riverdale Minor Ball'), null);
  });
  it('changes nothing when there is nothing to say, and only marks a matching name as ours', () => {
    assert.equal(buyerNameUpdate({ name: null }, '  '), null);
    assert.equal(buyerNameUpdate({ name: 'Riverdale', metadata: ours('Riverdale') }, 'Riverdale'), null);
    assert.deepEqual(buyerNameUpdate({ name: 'Riverdale', metadata: {} }, 'Riverdale'), { metadata: ours('Riverdale') });
  });
});

describe('the tax by name', () => {
  it('reads as a buyer does: "HST 13%"', () => {
    assert.equal(taxLineLabel({ display_name: 'HST', percentage: 13 }), 'HST 13%');
    assert.equal(taxLineLabel({ display_name: 'GST', percentage: 5, effective_percentage: 5 }), 'GST 5%');
    assert.equal(taxLineLabel({ display_name: 'QST', percentage: 9.975 }), 'QST 9.975%');
    assert.equal(taxLineLabel({ display_name: '', percentage: null }), 'Tax');
  });
  it('sums an invoice’s taxes per name, in Stripe’s order, and skips a zero', async () => {
    const rates: Record<string, { display_name: string; percentage: number }> = { a: { display_name: 'HST', percentage: 13 }, b: { display_name: 'GST', percentage: 5 } };
    const lines = await namedTaxLines([
      { amount: 195, tax_rate_details: { tax_rate: 'a' } },
      { amount: 0, tax_rate_details: { tax_rate: 'b' } },
      { amount: 182, tax_rate_details: { tax_rate: { id: 'a' } } },
    ], async id => rates[id]);
    assert.deepEqual(lines, [{ label: 'HST 13%', cents: 377 }]);
    assert.deepEqual(await namedTaxLines(null, async () => ({})), []);
  });
});

describe('Part 3 · a quote’s tax, as the paying windows draw it', () => {
  const complete = { enabled: true, status: 'complete' };
  const rate = async () => ({ display_name: 'HST', percentage: 13 });
  const preview = (over: Record<string, unknown> = {}) => ({
    amount_due: 1130, total_excluding_tax: 1000, starting_balance: 0, automatic_tax: complete,
    customer_address: { country: 'ca', state: 'on' },
    total_taxes: [{ amount: 130, tax_behavior: 'exclusive', tax_rate_details: { tax_rate: 'txr_1' } }], ...over,
  });

  it('names the tax, keeps the amount it sits on, and says where Stripe placed the buyer', async () => {
    assert.deepEqual(await quoteTax(preview(), rate), {
      status: 'taxed', lines: [{ label: 'HST 13%', cents: 130 }], beforeTax: 1000, taxedFor: { country: 'CA', region: 'ON' },
    });
  });

  it('a quote that does not add up keeps the tax and the total, never an amount before tax', async () => {
    for (const over of [{ starting_balance: -500, amount_due: 630 }, { amount_due: 1200 },
      { total_taxes: [{ amount: 130, tax_behavior: 'inclusive', tax_rate_details: { tax_rate: 'txr_1' } }] }]) {
      const q = await quoteTax(preview(over), rate);
      assert.equal(q.status === 'taxed' && q.beforeTax, null, JSON.stringify(over));
    }
  });

  it('a buyer Stripe could not place is never a figure: the sentence names no place (drawing tab 3, frame 5)', async () => {
    for (const status of ['requires_location_inputs', 'failed']) {
      assert.deepEqual(await quoteTax(preview({ automatic_tax: { enabled: true, status } }), rate), { status: 'not_worked_out', error: BILLING_TAX_WORDS.notWorkedOut });
    }
    assert.deepEqual(await quoteTax(preview({ automatic_tax: null }), rate), { status: 'not_worked_out', error: BILLING_TAX_WORDS.notWorkedOut });
    assert.doesNotMatch(BILLING_TAX_WORDS.notWorkedOut, /Plan & billing/);
  });

  it('a US buyer is placed with no Canadian tax: no tax row, the amount is the total', async () => {
    const q = await quoteTax(preview({ amount_due: 1000, total_taxes: [{ amount: 0, tax_behavior: 'exclusive' }], customer_address: { country: 'US', state: 'NY' } }), rate);
    assert.deepEqual(q, { status: 'taxed', lines: [], beforeTax: 1000, taxedFor: { country: 'US', region: 'NY' } });
  });

});
