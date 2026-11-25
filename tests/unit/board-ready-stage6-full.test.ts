import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { holdingDeals, holdsPlace, offerLapsed, parseOfferInput, takenOf, type ClubDeal } from '../../lib/club-sponsorship-deals.ts';
import { filesUnder, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 6 — TWO FIXES TO WHAT PART 2 SHIPPED, found by Part 4a (plan BOARD_READY_PLAN.md §5 Stage 6 "Part 4a").
 * Kept apart from Offer again's own tests because both can go to production on their own.
 *   · What "Full" counts (owner ruling 1A, 2026-11-25): it counted every year; and the link of an offer whose place that
 *     frees takes no answers (owner the same day).
 *   · Emailing an offer to a business that has an address on file was refused ("enter an email").
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const read = (p: string) => stripComments(readSource(p));
const TODAY = '2028-01-15';
const THIS_YEAR = { firstDay: '2028-01-01', lastDay: '2028-12-31' };

const deal = (over: Partial<ClubDeal> = {}): ClubDeal => ({
  id: 'd1', sponsorId: 's1', businessName: 'Harbour Dental', packageId: 'p-div', packageName: 'Division sponsor', items: [], logoOnSite: true,
  placeKind: 'division', targetId: 'div-u9-27', targetName: 'U9', endsOn: '2027-08-31', amount: 1000, chargeTax: false, state: 'paid',
  offeredOn: '2027-02-24', offeredAt: '2027-02-24T15:00:00Z', offeredByName: 'Dana Ruiz', offeredTo: 'frank@harbourdental.ca',
  emailedAt: '2027-02-24T15:00:00Z', openedAt: null, linkUnsentAt: null, formAt: null, invoice: null, withdrawn: null, done: {},
  revisedOn: null, invoiceEmailedAt: null, paidOn: '2027-04-10', paidHow: 'cheque', paidAmount: 1000, ...over,
});

describe('what "Full" counts (ruling 1A — the production defect)', () => {
  it('a deal holds its place in the fiscal year it was offered in', () => {
    assert.equal(holdsPlace(deal({ offeredOn: '2028-01-03', endsOn: null }), TODAY, THIS_YEAR), true);
  });
  it('after that year, only while its last day has not passed (inclusive)', () => {
    assert.equal(holdsPlace(deal({ endsOn: '2027-08-31' }), TODAY, THIS_YEAR), false, 'last summer’s deal frees its place');
    assert.equal(holdsPlace(deal({ endsOn: '2028-05-31', state: 'offered' }), TODAY, THIS_YEAR), true, 'a December offer for spring holds it');
    assert.equal(holdsPlace(deal({ endsOn: TODAY }), TODAY, THIS_YEAR), true, 'the last day itself still holds');
  });
  it('a deal with no last day frees its place when the year turns; withdrawn never holds one', () => {
    assert.equal(holdsPlace(deal({ endsOn: null }), TODAY, THIS_YEAR), false);
    assert.equal(holdsPlace(deal({ state: 'withdrawn', offeredOn: '2028-01-03' }), TODAY, THIS_YEAR), false);
  });
  it('a package that sold out last year is no longer full on the first day of the next', () => {
    const last = [1, 2, 3, 4].map(i => deal({ id: `d${i}`, endsOn: '2027-08-31' }));
    assert.deepEqual(takenOf(last, 'p-div'), { paid: 4, invoiced: 0, offered: 0 }, 'every year: the old count');
    assert.deepEqual(takenOf(holdingDeals(last, TODAY, THIS_YEAR), 'p-div'), { paid: 0, invoiced: 0, offered: 0 });
  });
  it('every route that counts Full or "Taken: …" hands it only the deals holding a place today', () => {
    for (const f of filesUnder('app/api/admin/sponsorships', '.ts')) {
      const code = read(f);
      for (const m of code.matchAll(/takenOf\((\w+)/g)) assert.doesNotMatch(m[1], /^(all|deals)$/, `${f}: takenOf(${m[1]}) counts every year`);
      assert.doesNotMatch(code, /holds:\s*all\.filter\(d => d\.state !== 'withdrawn'/, `${f}: holds must be holdingDeals(…)`);
    }
  });
});

describe('an offer whose place has gone back takes no answers (owner 2026-11-25)', () => {
  it('an earlier year’s open offer lapses with its place; one still running, this year’s, or an invoice does not', () => {
    assert.equal(offerLapsed(deal({ state: 'offered' }), TODAY, THIS_YEAR), true);
    assert.equal(offerLapsed(deal({ state: 'form_received', endsOn: null }), TODAY, THIS_YEAR), true);
    assert.equal(offerLapsed(deal({ state: 'offered', endsOn: '2028-05-31' }), TODAY, THIS_YEAR), false);
    assert.equal(offerLapsed(deal({ state: 'offered', offeredOn: '2028-01-03', endsOn: null }), TODAY, THIS_YEAR), false);
    assert.equal(offerLapsed(deal({ state: 'invoiced' }), TODAY, THIS_YEAR), false, 'an invoice already issued is still paid');
  });
  it('the link, its routes and the club’s presses all ask', () => {
    for (const f of ['lib/sponsor-link-route.ts', 'lib/sponsor-deal-view.ts', 'app/api/admin/sponsorships/deals/[dealId]/email/route.ts',
      'app/api/admin/sponsorships/deals/[dealId]/again/route.ts', 'app/api/admin/sponsorships/deals/[dealId]/send-invoice/route.ts']) {
      assert.match(read(f), /offerLapsedNow\(org\.id, deal\)/, f);
    }
    const dealRoute = read('app/api/admin/sponsorships/deals/[dealId]/route.ts');
    assert.match(dealRoute, /link: deal\.state === 'withdrawn' \|\| lapsed \? null :/);
    assert.match(dealRoute.slice(dealRoute.indexOf('export const PATCH')), /offerLapsedNow\(org\.id, deal\)/, 'editing can’t revive it');
    assert.match(read('lib/sponsor-deal-view.ts'), /offerLapsedNow\(org\.id, deal\) && !\(await unrecordedCardPayment/, 'a card payment taken still shows');
  });
});

describe('a business on the list is emailed at the address on file', () => {
  const errors = { business: 'b', newName: 'n', email: 'e', pkg: 'p', target: 't', amount: 'a', lastDay: 'l', reason: 'r', note: 'o', when: 'w', whenFuture: 'f', whenOld: () => 'old' };
  const base = { packageId: '11111111-1111-4111-8111-111111111111', amount: '1,000.00', reason: 'gave_address' };
  it('the window types no address for it, and the send is accepted', () => {
    const ok = parseOfferInput({ ...base, sponsorId: '22222222-2222-4222-8222-222222222222', email: null }, '2027-03-09', errors);
    assert.ok(ok.ok && ok.value.send && ok.value.email === null);
  });
  it('a new business still needs one to be emailed, and the route falls back to the address on file', () => {
    assert.equal((parseOfferInput({ ...base, newName: 'Harbour Dental', email: '' }, '2027-03-09', errors) as { field: string }).field, 'email');
    assert.match(read('app/api/admin/sponsorships/deals/route.ts'), /const to = v\.email \?\? existing\?\.email \?\? null;/);
  });
});
