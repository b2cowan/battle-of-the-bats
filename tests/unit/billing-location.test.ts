import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  BILLING_COUNTRIES, BILLING_LOCATION_WORDS as W, CA_POSTAL_FIRST_LETTERS, REVIEW_REASONS, US_DECLARATION_TEXTS, US_DECLARATION_VERSION,
  checkBillingLocation, countryChangeReview, countryInfo, evidenceReview, formatBilledTo, formatBillingAddress,
  currentReview, isPoBoxOnly, normalizeCanadianPostalCode, normalizeZipCode, regionName, reviewSentence,
  toStripeAddress, usDeclarationText,
} from '../../lib/billing-location.ts';

/**
 * GST/HST Stage 1 Part 1 (build prompt docs/projects/active/GST_HST_STAGE1_BUILD_PROMPT.md; owner rulings 2026-11-03):
 * the one check of what a billing address is. Behaviour for every branch, plus the migration's CHECKs held to the same
 * codes so a row the check passes always stores.
 */

const open = { usSalesOpen: true };
const closed = { usSalesOpen: false };
const guelph = { country: 'CA', regionCode: 'ON', line1: '120 Elm Street', city: 'Guelph', postalCode: 'N1H 4H2' };
const buffalo = { country: 'US', regionCode: 'NY', line1: '88 Delaware Avenue', line2: 'Suite 400', city: 'Buffalo', postalCode: '14202', usDeclared: true };

describe('the lists', () => {
  it('Canada first, then the United States, and nothing else (T1)', () => {
    assert.deepEqual(BILLING_COUNTRIES.map((c) => c.code), ['CA', 'US']);
    assert.equal(countryInfo('GB'), null);
  });
  it('all 13 provinces and territories', () => {
    const ca = countryInfo('CA')!;
    assert.deepEqual(ca.regions.map((r) => r.code), ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);
    assert.equal(ca.regionLabel, 'Province or territory');
    assert.equal(ca.postalLabel, 'Postal code');
  });
  it('50 states and the District of Columbia, no territories', () => {
    const us = countryInfo('US')!;
    assert.equal(us.regions.length, 51);
    assert.equal(new Set(us.regions.map((r) => r.code)).size, 51);
    assert.ok(us.regions.some((r) => r.code === 'DC'));
    for (const t of ['PR', 'GU', 'VI', 'AS', 'MP']) assert.ok(!us.regions.some((r) => r.code === t), t);
    assert.equal(us.regionLabel, 'State');
    assert.equal(us.postalLabel, 'ZIP code');
  });
  it('every province and state passes the check with a valid address', () => {
    // A postal code from each province's own letter (Stage 2 Ask 4), so every province passes with a code of its own.
    for (const r of countryInfo('CA')!.regions) {
      const postalCode = `${CA_POSTAL_FIRST_LETTERS[r.code][0]}1A 1A1`;
      assert.equal(checkBillingLocation({ ...guelph, regionCode: r.code, postalCode }, closed).ok, true, r.code);
    }
    for (const r of countryInfo('US')!.regions) assert.equal(checkBillingLocation({ ...buffalo, regionCode: r.code }, open).ok, true, r.code);
  });
  it('region names', () => {
    assert.equal(regionName('CA', 'QC'), 'Quebec');
    assert.equal(regionName('US', 'NY'), 'New York');
    assert.equal(regionName('US', 'ON'), null);
  });
});

describe('the check', () => {
  it('a valid Canadian address is tidied', () => {
    const r = checkBillingLocation({ country: 'ca', regionCode: 'on', line1: '  120  Elm Street ', line2: '  ', city: 'Guelph', postalCode: 'n1h4h2' }, closed);
    assert.deepEqual(r, { ok: true, value: { country: 'CA', regionCode: 'ON', line1: '120 Elm Street', line2: null, city: 'Guelph', postalCode: 'N1H 4H2' } });
  });
  it('no country', () => {
    assert.deepEqual(checkBillingLocation({ ...guelph, country: '' }, open), { ok: false, errors: { country: W.country }, usClosed: false });
    assert.deepEqual(checkBillingLocation({ ...guelph, country: 'MX' }, open), { ok: false, errors: { country: W.country }, usClosed: false });
  });
  it('a US address while US sales are closed is refused and says so', () => {
    const r = checkBillingLocation(buffalo, closed);
    assert.deepEqual(r, { ok: false, errors: { country: 'We’re not selling in the United States yet.' }, usClosed: true });
  });
  it('a valid US address with its declaration, once US sales are open', () => {
    const r = checkBillingLocation({ ...buffalo, postalCode: '14202 1234' }, open);
    assert.deepEqual(r, { ok: true, value: { country: 'US', regionCode: 'NY', line1: '88 Delaware Avenue', line2: 'Suite 400', city: 'Buffalo', postalCode: '14202-1234' } });
  });
  it('a US address without the tick is refused under the box', () => {
    const r = checkBillingLocation({ ...buffalo, usDeclared: false }, open);
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors, { usDeclared: W.usDeclaration });
  });
  it('every US address needs the tick: nothing reads an address back from Stripe (Part 3, owner 2026-11-04)', () => {
    assert.equal(checkBillingLocation({ ...buffalo, usDeclared: undefined }, open).ok, false);
  });
  it('Canada ignores the tick', () => {
    assert.equal(checkBillingLocation({ ...guelph, usDeclared: false }, closed).ok, true);
  });
  it('a province must belong to the country', () => {
    const r = checkBillingLocation({ ...guelph, regionCode: 'NY' }, closed);
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors, { regionCode: 'Choose a province or territory.' });
    const u = checkBillingLocation({ ...buffalo, regionCode: 'ON' }, open);
    if (!u.ok) assert.deepEqual(u.errors, { regionCode: 'Choose a state.' });
    else assert.fail('ON is not a state');
  });
  it('every missing field is named at once', () => {
    const r = checkBillingLocation({ country: 'CA' }, closed);
    assert.equal(r.ok, false);
    if (!r.ok) assert.deepEqual(r.errors, { regionCode: W.region.CA, line1: W.line1, city: W.city, postalCode: W.postal.CA });
  });
  it('a PO Box alone is refused', () => {
    const r = checkBillingLocation({ ...guelph, line1: 'PO Box 412' }, closed);
    if (!r.ok) assert.equal(r.errors.line1, 'Enter a street address. A PO Box on its own can’t be a billing address.');
    else assert.fail('a PO Box passed');
  });
  it('postal and ZIP codes in the wrong shape', () => {
    const r = checkBillingLocation({ ...guelph, postalCode: 'N1H 4H' }, closed);
    if (!r.ok) assert.equal(r.errors.postalCode, 'Enter a postal code like N1H 4H2.');
    else assert.fail();
    const u = checkBillingLocation({ ...buffalo, postalCode: '1420' }, open);
    if (!u.ok) assert.equal(u.errors.postalCode, 'Enter a ZIP code like 14202.');
    else assert.fail();
    const swapped = checkBillingLocation({ ...guelph, postalCode: '14202' }, closed);
    assert.equal(swapped.ok, false);
  });
  it('a postal code must belong to the chosen province or territory (GST/HST Stage 2 Ask 4: the province sets the tax)', () => {
    // Canada Post's first letters, every province and territory.
    assert.deepEqual({ ...CA_POSTAL_FIRST_LETTERS }, {
      NL: ['A'], NS: ['B'], PE: ['C'], NB: ['E'], QC: ['G', 'H', 'J'], ON: ['K', 'L', 'M', 'N', 'P'],
      MB: ['R'], SK: ['S'], AB: ['T'], BC: ['V'], NT: ['X'], NU: ['X'], YT: ['Y'],
    });
    assert.deepEqual(Object.keys(CA_POSTAL_FIRST_LETTERS).sort(), countryInfo('CA')!.regions.map((r) => r.code).sort());
    for (const r of countryInfo('CA')!.regions) {
      for (const letter of 'ABCEGHJKLMNPRSTVXY'.split('')) {
        const ok = checkBillingLocation({ ...guelph, regionCode: r.code, postalCode: `${letter}1A 1A1` }, closed).ok;
        assert.equal(ok, CA_POSTAL_FIRST_LETTERS[r.code].includes(letter), `${r.code} ${letter}`);
      }
    }
    const bc = checkBillingLocation({ ...guelph, postalCode: 'V6C 1T2' }, closed);
    if (!bc.ok) assert.deepEqual(bc.errors, { postalCode: 'A postal code in Ontario starts with K, L, M, N or P.' });
    else assert.fail('a BC postal code passed as Ontario');
    const nl = checkBillingLocation({ ...guelph, regionCode: 'NL' }, closed);
    if (!nl.ok) assert.equal(nl.errors.postalCode, 'A postal code in Newfoundland and Labrador starts with A.');
    else assert.fail();
    const qc = checkBillingLocation({ ...guelph, regionCode: 'QC' }, closed);
    if (!qc.ok) assert.equal(qc.errors.postalCode, 'A postal code in Quebec starts with G, H or J.');
    else assert.fail();
    // No province chosen: only the province is asked for, never a postal sentence about a province nobody chose.
    const none = checkBillingLocation({ ...guelph, regionCode: '' }, closed);
    if (!none.ok) assert.equal(none.errors.postalCode, undefined);
    else assert.fail();
    // US addresses are unchanged: a ZIP is never compared with its state.
    assert.equal(checkBillingLocation({ ...buffalo, regionCode: 'CA' }, open).ok, true);
  });
  it('too long', () => {
    const r = checkBillingLocation({ ...guelph, line1: `1 ${'a'.repeat(199)}`, line2: 'b'.repeat(201), city: 'c'.repeat(101) }, closed);
    if (!r.ok) assert.deepEqual(r.errors, { line1: W.tooLong, line2: W.tooLong, city: W.tooLong });
    else assert.fail();
  });
  it('characters a database text column cannot hold are dropped, not saved into a failure', () => {
    const r = checkBillingLocation({ ...guelph, line1: '120 Elm\u0000 Street\ud800', city: 'Gue\u0001lph' }, closed);
    assert.ok(r.ok);
    if (r.ok) { assert.equal(r.value.line1, '120 Elm Street'); assert.equal(r.value.city, 'Guelph'); }
  });
});

describe('postal codes', () => {
  it('Canada: Canada Post letters only', () => {
    assert.equal(normalizeCanadianPostalCode('k1a0b1'), 'K1A 0B1');
    assert.equal(normalizeCanadianPostalCode('K1A-0B1'), 'K1A 0B1');
    assert.equal(normalizeCanadianPostalCode('X0A 0H0'), 'X0A 0H0');
    for (const bad of ['W1A 1A1', 'Z1A 1A1', 'D1A 1A1', 'K1D 1A1', 'K1A 1O1', 'K1A1A', '123456', '', null]) {
      assert.equal(normalizeCanadianPostalCode(bad), null, String(bad));
    }
  });
  it('US: five digits, optional plus four', () => {
    assert.equal(normalizeZipCode('02134'), '02134');
    assert.equal(normalizeZipCode('021341234'), '02134-1234');
    assert.equal(normalizeZipCode('02134-1234'), '02134-1234');
    for (const bad of ['2134', '02134-12', 'ABCDE', '', null]) assert.equal(normalizeZipCode(bad), null, String(bad));
  });
});

describe('a PO Box on its own', () => {
  it('refused', () => {
    for (const s of ['PO Box 412', 'P.O. Box 12, Station A', 'p o box 9', 'POB 77', 'Post Office Box 5', 'Box 3', 'Box #3', 'CP 34', 'C.P. 34', 'Case postale 5', 'Boîte postale 8', 'PMB 9']) {
      assert.equal(isPoBoxOnly(s), true, s);
    }
  });
  it('a street address that mentions a box is fine', () => {
    for (const s of ['120 Elm Street, Box 3', 'Box Elder Road', 'RR 2', '45 Boxwood Crescent', '12 Cpt Smith Way']) {
      assert.equal(isPoBoxOnly(s), false, s);
    }
  });
});

describe('reading it back', () => {
  const loc = { country: 'US' as const, regionCode: 'NY', line1: '88 Delaware Avenue', line2: 'Suite 400', city: 'Buffalo', postalCode: '14202' };
  it('the record line and the "Billed to" line', () => {
    assert.equal(formatBillingAddress(loc), '88 Delaware Avenue, Suite 400, Buffalo, New York 14202');
    assert.equal(formatBillingAddress({ ...loc, country: 'CA', regionCode: 'ON', line2: null, line1: '120 Elm Street', city: 'Guelph', postalCode: 'N1H 4H2' }), '120 Elm Street, Guelph, Ontario N1H 4H2');
    assert.equal(formatBilledTo({ country: 'CA', regionCode: 'ON', line1: '120 Elm Street', line2: null, city: 'Guelph', postalCode: 'N1H 4H2' }), '120 Elm Street, Guelph, Ontario');
  });
  it('onto the Stripe customer (one way only)', () => {
    assert.deepEqual(toStripeAddress(loc), { line1: '88 Delaware Avenue', line2: 'Suite 400', city: 'Buffalo', state: 'NY', postal_code: '14202', country: 'US' });
  });
});

describe('the US declaration (T7; v2 wording owner 2026-11-04)', () => {
  it('in the club’s name and in the coach’s own: managed and controlled / lives, not GST/HST-registered, used outside Canada', () => {
    assert.equal(usDeclarationText({ kind: 'club', name: 'Riverdale Minor Ball' }),
      'I confirm that Riverdale Minor Ball is managed and controlled in the United States, is not registered for Canadian GST/HST, and is buying this subscription for use outside Canada.');
    assert.equal(usDeclarationText({ kind: 'person' }),
      'I confirm that I live in the United States, am not registered for Canadian GST/HST, and am buying this subscription for use outside Canada.');
    assert.equal(US_DECLARATION_VERSION, 'us-2026-11-v2');
  });
  it('keeps every earlier wording readable by its version, and refuses an unknown one', () => {
    assert.equal(usDeclarationText({ kind: 'person' }, 'us-2026-11-provisional'),
      'I confirm that I am located in the United States and am buying this subscription for use in the United States.');
    assert.ok(US_DECLARATION_VERSION in US_DECLARATION_TEXTS);
    assert.throws(() => usDeclarationText({ kind: 'person' }, 'us-1999-nope'));
  });
});

describe('needs review', () => {
  it('a US address wants a US card and US payouts', () => {
    assert.equal(evidenceReview({ country: 'US', cardCountry: 'ca' }), 'card_country_mismatch');
    assert.equal(evidenceReview({ country: 'US', cardCountry: 'GB' }), 'card_country_mismatch');
    assert.equal(evidenceReview({ country: 'US', cardCountry: 'US', payoutCountry: 'CA' }), 'payout_country_mismatch');
    assert.equal(evidenceReview({ country: 'US', cardCountry: 'us', payoutCountry: 'us' }), null);
  });
  it('a Canadian address with a US card or US payouts is the reverse', () => {
    assert.equal(evidenceReview({ country: 'CA', cardCountry: 'US' }), 'card_country_mismatch');
    assert.equal(evidenceReview({ country: 'CA', payoutCountry: 'US' }), 'payout_country_mismatch');
    assert.equal(evidenceReview({ country: 'CA', cardCountry: 'GB', payoutCountry: 'CA' }), null);
  });
  it('no card or payout country is no evidence either way', () => {
    assert.equal(evidenceReview({ country: 'US' }), null);
    assert.equal(evidenceReview({ country: 'CA', cardCountry: null, payoutCountry: null }), null);
  });
  it('a country change counts only after paying', () => {
    assert.equal(countryChangeReview('CA', 'US', true), 'country_changed_after_paying');
    assert.equal(countryChangeReview('CA', 'US', false), null);
    assert.equal(countryChangeReview('CA', 'CA', true), null);
    assert.equal(countryChangeReview(null, 'US', true), null);
  });
  it('needs review is worked out when read: a stored flag wins and stays, the evidence sets and clears (Part 3 Ask 1)', () => {
    const stored = 'The country changed from Canada to the United States after paying.';
    assert.deepEqual(currentReview({ country: 'US', cardCountry: 'US', storedReason: 'country_changed_after_paying', storedNote: stored }),
      { reason: 'country_changed_after_paying', note: stored });
    assert.deepEqual(currentReview({ country: 'US', cardCountry: 'CA', storedReason: 'country_changed_after_paying', storedNote: stored }),
      { reason: 'country_changed_after_paying', note: stored });
    assert.equal(currentReview({ country: 'US', storedReason: 'stripe_edit_invalid', storedNote: null })?.reason, 'stripe_edit_invalid');
    assert.deepEqual(currentReview({ country: 'US', cardCountry: 'CA' }),
      { reason: 'card_country_mismatch', note: 'The address is in the United States, but the card was issued in Canada.' });
    assert.equal(currentReview({ country: 'US', cardCountry: 'US' }), null);
    assert.equal(currentReview({ country: 'CA', cardCountry: 'CA', payoutCountry: 'US' })?.reason, 'payout_country_mismatch');
    assert.equal(currentReview({ country: 'CA', cardCountry: null, payoutCountry: null }), null);
  });
  it('every reason has a sentence', () => {
    assert.equal(reviewSentence('card_country_mismatch', { country: 'US', cardCountry: 'CA' }), 'The address is in the United States, but the card was issued in Canada.');
    assert.equal(reviewSentence('country_changed_after_paying', { country: 'US', previousCountry: 'CA' }), 'The country changed from Canada to the United States after paying.');
    assert.equal(reviewSentence('payout_country_mismatch', { country: 'CA', payoutCountry: 'us' }), 'The address is in Canada, but the club’s payouts go to the United States.');
    for (const r of REVIEW_REASONS) assert.ok(reviewSentence(r, { country: 'US', previousCountry: 'CA', cardCountry: 'CA', payoutCountry: 'CA' }).length > 20, r);
  });
});

describe('the migration holds the same codes', () => {
  const sql = readFileSync('supabase/migrations/433_every_buyer_has_a_billing_address.sql', 'utf8');
  it('the review reasons', () => {
    for (const r of REVIEW_REASONS) assert.ok(sql.includes(`'${r}'`), r);
  });
  it('the countries', () => {
    assert.ok(sql.includes("country IN ('CA', 'US')"));
  });
  it('one buyer: a club or a person', () => {
    assert.ok(sql.includes('(org_id IS NULL) <> (user_id IS NULL)'));
  });
});
