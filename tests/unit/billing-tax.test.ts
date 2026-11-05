import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AUTOMATIC_TAX, BILLING_REVIEW_HOLD, BILLING_TAX_WORDS, decideBuyerTax, taxWasWorkedOut } from '../../lib/billing-tax.ts';
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
