import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emailBarFor, stopsFollowingBusiness, type ClubDeal } from '../../lib/club-sponsorship-deals.ts';
import {
  AGAIN_MAX_ROWS, againCallout, againRows, canOfferAgainOne, lastDayFor, nameWithoutYear, placeForPress, resolvePlace, type AgainInput,
} from '../../lib/club-sponsorship-offer-again.ts';
import { DEAL_WORDS as W } from '../../lib/club-sponsorship-deal-words.ts';
import type { PlaceTargets, SponsorshipPackage } from '../../lib/club-sponsorships.ts';
import { filesUnder, readSource, stripComments } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * BOARD READY STAGE 6, PART 4a — OFFER AGAIN (owner rulings 1A–12A, 2026-11-25, plan BOARD_READY_PLAN.md §5 Stage 6 "Part 4a";
 * /legal 2026-11-25 must-fixes 1–5, docs/agents/legal/BOARD_READY_STAGE6_SPONSORSHIPS_DRAWING_REVIEW.md). The window's rows
 * (2A–9A), the callout (11A), one old deal (12A), the reason worked out from payments (8A), the press, and the one send step
 * every offer email goes through (drawing F6). What Full counts (1A) is board-ready-stage6-full.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const read = (p: string) => stripComments(readSource(p));
const TODAY = '2028-01-15';
const THIS_YEAR = { firstDay: '2028-01-01', lastDay: '2028-12-31', name: '2028' };
const LAST_YEAR = { firstDay: '2027-01-01', lastDay: '2027-12-31', name: '2027' };

const deal = (over: Partial<ClubDeal> = {}): ClubDeal => ({
  id: 'd1', sponsorId: 's1', businessName: 'Harbour Dental', packageId: 'p-div', packageName: 'Division sponsor', items: [], logoOnSite: true,
  placeKind: 'division', targetId: 'div-u9-27', targetName: 'U9', endsOn: '2027-08-31', amount: 1000, chargeTax: false, state: 'paid',
  offeredOn: '2027-02-24', offeredAt: '2027-02-24T15:00:00Z', offeredByName: 'Dana Ruiz', offeredTo: 'frank@harbourdental.ca',
  emailedAt: '2027-02-24T15:00:00Z', openedAt: null, linkUnsentAt: null, formAt: null, invoice: null, withdrawn: null, done: {},
  revisedOn: null, invoiceEmailedAt: null, paidOn: '2027-04-10', paidHow: 'cheque', paidAmount: 1000, ...over,
});

const pkg = (over: Partial<SponsorshipPackage> = {}): SponsorshipPackage => ({
  id: 'p-div', name: 'Division sponsor', price: 1000, placeKind: 'division', howMany: 4, showsUntil: '2028-08-31', logoOnSite: true,
  items: [], document: null, archivedAt: null, ...over,
});

const TARGETS: PlaceTargets = {
  divisions: [
    { id: 'div-u9-27', name: 'U9', seasonId: 'sp27', seasonName: 'Spring 2027', live: false },
    { id: 'div-u9-28', name: 'U9', seasonId: 'sp28', seasonName: 'Spring 2028', live: true },
    { id: 'div-u11-a', name: 'U11', seasonId: 'sp28', seasonName: 'Spring 2028', live: true },
    { id: 'div-u11-b', name: 'U11', seasonId: 'fa28', seasonName: 'Fall 2028 mini league', live: true },
  ],
  teams: [{ id: 'team-sharks-27', name: 'U9 Sharks', divisionName: 'U9', seasonId: 'sp27', seasonName: 'Spring 2027', live: false }],
  tournaments: [
    { id: 't-27', name: 'Spring Classic 2027', live: false },
    { id: 't-28', name: 'Spring Classic 2028', live: true },
    { id: 't-fall', name: 'Fall Frenzy', live: true },
  ],
};

const input = (over: Partial<AgainInput> = {}): AgainInput => ({
  today: TODAY, thisYear: THIS_YEAR, lastYear: LAST_YEAR, clubName: 'Riverdale Minor Ball',
  deals: [deal()], packages: [pkg()], targets: TARGETS, contacts: [{ id: 's1', email: 'frank@harbourdental.ca' }],
  bars: { stops: new Map(), family: new Set() }, paidOn: new Map([['s1', '2027-04-10']]), registered: true, ...over,
});

describe('the window’s rows (ruling 2A)', () => {
  it('one row per deal offered last year that was not withdrawn', () => {
    const rows = againRows(input({ deals: [deal({ id: 'a' }), deal({ id: 'b', packageId: 'p-club', placeKind: 'club', targetId: null, targetName: null }), deal({ id: 'c', state: 'withdrawn' }), deal({ id: 'old', offeredOn: '2026-03-01' })],
      packages: [pkg(), pkg({ id: 'p-club', name: 'Club partner', placeKind: 'club', price: 2500 })] }));
    assert.deepEqual(rows.map(r => r.dealId), ['a', 'b']);
  });
  it('left off when the business already holds that package this year', () => {
    const renewed = deal({ id: 'new', offeredOn: '2027-12-10', endsOn: '2028-08-31', state: 'offered' });
    assert.deepEqual(againRows(input({ deals: [deal(), renewed] })).map(r => r.dealId), [], 'the December renewal holds it, so neither is listed');
  });
  it('a business with two deals on a package is offered both; each one held this year takes one row off (owner 2026-11-25)', () => {
    const u9 = deal({ id: 'u9' });
    const u11 = deal({ id: 'u11', targetId: 'old-u11', targetName: 'U11' });
    assert.deepEqual(againRows(input({ deals: [u9, u11] })).map(r => r.dealId), ['u9', 'u11']);
    const nowU11 = deal({ id: 'n', offeredOn: '2028-01-05', targetId: 'div-u11-a', targetName: 'U11', endsOn: '2028-08-31', state: 'offered' });
    assert.deepEqual(againRows(input({ deals: [u9, u11, nowU11] })).map(r => r.dealId), ['u9'], 'the U11 renewal takes the U11 row');
    const nowU9 = deal({ id: 'm', offeredOn: '2028-01-06', targetId: 'div-u9-28', targetName: 'U9', endsOn: '2028-08-31', state: 'offered' });
    assert.deepEqual(againRows(input({ deals: [u9, u11, nowU11, nowU9] })), []);
  });
  it('a renewal made before the old deal ended still takes its row (the December renewal)', () => {
    const old = deal({ id: 'old', offeredOn: '2027-02-24', endsOn: '2027-12-31' });
    const early = deal({ id: 'new', offeredOn: '2027-12-10', endsOn: '2028-12-31', state: 'offered' });
    assert.deepEqual(againRows(input({ deals: [old, early] })), []);
    assert.equal(canOfferAgainOne(old, input({ deals: [old, early] }), LAST_YEAR), null);
  });
  it('two bought side by side renew neither, with or without a last day', () => {
    const open = deal({ id: 'a', offeredOn: '2027-02-01', endsOn: null });
    const running = deal({ id: 'b', offeredOn: '2027-02-15', targetName: 'U11', endsOn: '2028-02-28' });
    assert.deepEqual(againRows(input({ deals: [open, running] })).map(r => r.dealId), ['a']);
  });
  it('a deal of last year still running leaves only its own row off', () => {
    const ended = deal({ id: 'a', offeredOn: '2027-02-01', endsOn: '2027-08-31' });
    const running = deal({ id: 'b', offeredOn: '2027-03-01', targetName: 'U11', endsOn: '2028-02-28' });
    assert.deepEqual(againRows(input({ deals: [ended, running] })).map(r => r.dealId), ['a']);
  });
  it('ready rows are ticked; this year’s price, last year’s as a hint only when different (9A)', () => {
    const [same] = againRows(input());
    assert.equal(same.group, 'ready');
    assert.equal(same.ticked, true);
    assert.equal(same.lastPrice, null);
    const [changed] = againRows(input({ deals: [deal({ amount: 900 })] }));
    assert.equal(changed.price, 1000);
    assert.equal(changed.lastPrice, 900);
  });
  it('a full package waits, and says so', () => {
    const holder = deal({ id: 'h', sponsorId: 's9', offeredOn: '2028-01-03', state: 'offered' });
    const [r] = againRows(input({ deals: [deal(), holder], packages: [pkg({ howMany: 1 })] }));
    assert.equal(r.group, 'waiting');
    assert.equal(r.why, W.again.waitFull);
    assert.equal(r.ticked, false);
  });
  it('a package with a limit ticks only as many rows as it has places left', () => {
    const deals = [deal({ id: 'a' }), deal({ id: 'b', sponsorId: 's2' }), deal({ id: 'c', sponsorId: 's3' })];
    const rows = againRows(input({
      deals, packages: [pkg({ howMany: 2 })], contacts: [{ id: 's1', email: 'a@x.ca' }, { id: 's2', email: 'b@x.ca' }, { id: 's3', email: 'c@x.ca' }],
      paidOn: new Map([['s1', '2027-04-10'], ['s2', '2027-04-10'], ['s3', '2027-04-10']]),
    }));
    assert.deepEqual(rows.map(r => [r.group, r.ticked]), [['ready', true], ['ready', true], ['ready', false]]);
  });
  it('the Charge switch copies last year’s deal only while the club is registered', () => {
    assert.equal(againRows(input({ deals: [deal({ chargeTax: true })] }))[0].chargeTax, true);
    assert.equal(againRows(input({ deals: [deal({ chargeTax: true })], registered: false }))[0].chargeTax, false);
  });
});

describe('the reason each email rests on (ruling 8A; /legal must-fix 1)', () => {
  it('a payment 23 months old can go; 25 months old cannot (the computed two-year clock)', () => {
    const ok = againRows(input({ paidOn: new Map([['s1', '2026-02-16']]) }))[0];
    assert.equal(ok.group, 'ready');
    const old = againRows(input({ paidOn: new Map([['s1', '2025-12-14']]) }))[0];
    assert.equal(old.group, 'blocked');
    assert.equal(old.why, W.again.lapsed('2025-12-14'));
  });
  it('never paid: listed, never ticked, and says so', () => {
    const r = againRows(input({ deals: [deal({ state: 'offered', paidOn: null })], paidOn: new Map() }))[0];
    assert.equal(r.group, 'blocked');
    assert.equal(r.ticked, false);
    assert.equal(r.why, W.again.neverPaid('2027'));
    assert.match(r.why!, /To give them a link in person, use Offer a deal\.$/);
  });
  it('a paid deal with no payment that stands is not called "never paid"', () => {
    assert.equal(againRows(input({ paidOn: new Map() }))[0].why, W.again.noStandingPayment);
  });
  it('an unsubscribed, Do not offer again or family-opted-out address is never ticked', () => {
    const stops = new Map([['frank@harbourdental.ca', { source: 'unsubscribe' as const, on: '2027-11-02' }]]);
    assert.equal(againRows(input({ bars: { stops, family: new Set() } }))[0].why, W.offer.barUnsubscribed('2027-11-02'));
    const club = new Map([['frank@harbourdental.ca', { source: 'club' as const, on: '2027-11-02' }]]);
    assert.equal(againRows(input({ bars: { stops: club, family: new Set() } }))[0].group, 'blocked');
    assert.equal(againRows(input({ bars: { stops: new Map(), family: new Set(['frank@harbourdental.ca']) } }))[0].group, 'blocked');
  });
  it('the payments the date is read from: voided, gone back, withdrawn, open dispute and an ending refund never count', () => {
    const code = read('lib/club-sponsorship-deals-server.ts');
    const fn = code.slice(code.indexOf('export async function readStandingPaidOn'), code.indexOf('export async function readDealPayments'));
    for (const must of [".neq('state', 'withdrawn')", ".is('voided_at', null)", ".is('returned_at', null)", ".lte('received_on', today)", ".eq('ends_deal', true)", "disputeOutcome(d.status) !== 'won'", 'fetchAll']) {
      assert.ok(fn.includes(must), `readStandingPaidOn: ${must}`);
    }
  });
  it('the press works every row out again and sends only "paid_recently" on the computed day', () => {
    const code = read('app/api/admin/sponsorships/deals/offer-again/route.ts');
    const post = code.slice(code.indexOf('export const POST'));
    assert.match(post, /readAgainInput\(org, today\)/);
    assert.match(post, /againRows\(input\)/);
    assert.match(post, /reason: 'paid_recently', reasonOn: row\.paidOn/);
    assert.match(post, /placeForPress\(row\.place, a\.targetId\)/, 'a place is one of the row’s own choices, never one the browser names');
    assert.match(code, /list\.length > AGAIN_MAX_ROWS/);
    assert.equal(AGAIN_MAX_ROWS, 100);
    assert.match(read('components/admin/kit/club/sponsorships/OfferAgainWindow.tsx'), /rows\.slice\(0, AGAIN_MAX_ROWS\)/);
  });
  it('one request stops starting rows inside the host’s limit and answers the rest; the window posts them next', () => {
    const code = read('app/api/admin/sponsorships/deals/offer-again/route.ts');
    assert.match(code, /Date\.now\(\) - startedAt > PRESS_BUDGET_MS\) break;/);
    assert.match(code, /const later = asked\.slice\(done\)/);
    const budget = Number(code.match(/PRESS_BUDGET_MS = ([\d_]+)/)![1].replace(/_/g, ''));
    const email = read('lib/sponsor-offer-email.ts');
    const ms = (name: string) => Number(email.match(new RegExp(`${name} = ([\\d_]+)`))![1].replace(/_/g, ''));
    assert.ok(budget + 2 * ms('SEND_TIMEOUT_MS') + ms('RETRY_AFTER_MS') < 27_000, 'the slowest last row still ends inside the request');
    assert.match(read('components/admin/kit/club/sponsorships/OfferAgainWindow.tsx'), /while \(rows\.length\)/);
  });
  it('every row stands alone: its own try, its name even when it dropped off, never offered twice today, never a past last day', () => {
    const code = read('app/api/admin/sponsorships/deals/offer-again/route.ts');
    assert.match(code, /catch \(e\) \{[^}]*fail\(A\.failError\);/);
    assert.match(code, /name: nameOf\.get\(a\.dealId\)/);
    assert.match(code, /await offeredPackageToday\(org\.id, row\.sponsorId, pkg\.id, today\) > known/, 'more of today’s deals than this press knows of = another press');
    assert.match(code, /if \(endsOn && endsOn < today\)/);
  });
  it('a send with no answer is asked once more under the same key; still silent, the deal and its record stay (owner 2026-11-25)', () => {
    const email = read('lib/sponsor-offer-email.ts');
    assert.match(email, /idempotencyKey: key,/);
    assert.match(email, /r\.status === 'no_answer' \|\| \(r\.status === 'provider_error' && !r\.refused && !r\.throttled\)/);
    assert.match(email, /if \(mayHaveGone\) return 'unconfirmed';/);
    const step = read('lib/club-sponsorship-offer-send.ts');
    assert.match(step, /return \{ ok: true, dealId, unconfirmed: delivery === 'unconfirmed' \};/);
    assert.match(read('lib/email.ts'), /res\.status === 429 \? \{ throttled: true \}/, 'too busy to take it: nothing went');
  });
  it('the result line says what wasn’t offered and what couldn’t be confirmed (owner 2026-11-25)', () => {
    assert.equal(W.again.sentSome(0, 1, [{ name: 'Oakridge Physio', why: W.again.failFull }]),
      'No offers were sent. Oakridge Physio wasn’t offered: the package is full. Nothing was made for them.');
    assert.equal(W.again.sentSome(5, 8, [{ name: 'A', why: 'x' }, { name: 'B', why: 'y' }]), 'Sent 5 of 8 offers. 2 weren’t offered (A and B). Nothing was made for them.');
    assert.match(W.again.sentSome(7, 8, [], ['Summit Roofing']), /^Sent 7 of 8 offers\. We couldn’t confirm Summit Roofing’s email went\./);
    assert.match(W.again.sentSome(0, 1, [], ['Summit Roofing']), /^No offers are confirmed sent\./);
  });
});

describe('"Do not offer again" follows the business (/legal 2026-11-25)', () => {
  const club = { source: 'club' as const, on: '2027-11-02' };
  it('a stop the club pressed on one address bars every address the business has on record', () => {
    const stops = stopsFollowingBusiness(new Map([['old@x.ca', club]]), [['new@x.ca', 'Old@X.ca', null], ['other@y.ca']]);
    assert.deepEqual(emailBarFor('new@x.ca', stops, new Set()), { kind: 'do_not_offer', on: '2027-11-02' });
    assert.equal(emailBarFor('other@y.ca', stops, new Set()), null);
    const [row] = againRows(input({ contacts: [{ id: 's1', email: 'new@x.ca' }], bars: { stops, family: new Set() } }));
    assert.equal(row.group, 'blocked');
  });
  it('an unsubscribe follows the business too (owner 2026-11-25); a stop the club pressed speaks first', () => {
    const unsubscribed = new Map([['old@x.ca', { source: 'unsubscribe' as const, on: '2027-01-02' }]]);
    assert.deepEqual(emailBarFor('new@x.ca', stopsFollowingBusiness(unsubscribed, [['new@x.ca', 'old@x.ca']]), new Set()), { kind: 'unsubscribed', on: '2027-01-02' });
    const both = new Map<string, { source: 'unsubscribe' | 'club'; on: string }>([...unsubscribed, ['b@x.ca', { source: 'club', on: '2027-05-05' }]]);
    assert.deepEqual(emailBarFor('new@x.ca', stopsFollowingBusiness(both, [['new@x.ca', 'old@x.ca', 'b@x.ca']]), new Set()), { kind: 'do_not_offer', on: '2027-05-05' });
  });
  it('every send reads its stops through it, a typed address included', () => {
    const server = read('lib/club-sponsorship-deals-server.ts');
    assert.match(server, /if \(typed\) book\.get\(typed\.sponsorId\)\?\.push\(typed\.email\);/);
    assert.match(server, /stopsFollowingBusiness\(stops, book\.values\(\)\)/);
  });
});

describe('places (rulings 3A, 5A, 6A) and the last day (4A)', () => {
  it('a division carries over by name when exactly one live division other than last year’s has it', () => {
    const p = resolvePlace(deal(), 'division', TARGETS);
    assert.deepEqual(p, { status: 'ok', targetId: 'div-u9-28', targetName: 'U9', label: 'U9, Spring 2028' });
  });
  it('no match waits; two matches ask which, each named with its season', () => {
    const none = resolvePlace(deal({ targetName: 'U15', targetId: 'x' }), 'division', TARGETS);
    assert.equal(none.status, 'wait');
    const two = resolvePlace(deal({ targetName: 'U11', targetId: 'old-u11' }), 'division', TARGETS);
    assert.equal(two.status, 'pick');
    if (two.status === 'pick') {
      assert.deepEqual(two.choices.map(c => c.label), ['U11 Spring 2028', 'U11 Fall 2028 mini league']);
      assert.equal(two.chosen, null);
    }
  });
  it('a tournament is pre-picked on a single name match with the year taken off; last year’s own is never offered', () => {
    assert.equal(nameWithoutYear('Spring Classic 2027'), 'spring classic');
    const t = resolvePlace(deal({ placeKind: 'tournament', targetId: 't-27', targetName: 'Spring Classic 2027' }), 'tournament', TARGETS);
    assert.equal(t.status, 'pick');
    if (t.status === 'pick') {
      assert.equal(t.chosen, 't-28');
      assert.ok(!t.choices.some(c => c.id === 't-27'));
    }
    const none = resolvePlace(deal({ placeKind: 'tournament', targetId: 't-28', targetName: 'Spring Classic 2028' }), 'tournament', { ...TARGETS, tournaments: [TARGETS.tournaments[1]] });
    assert.deepEqual(none, { status: 'wait', why: W.again.waitTournament });
  });
  it('a team waits until the new season has teams, then asks, last year’s division’s teams first, never pre-picked', () => {
    const sharks = deal({ placeKind: 'team', targetId: 'team-sharks-27', targetName: 'U9 Sharks' });
    const waits = resolvePlace(sharks, 'team', TARGETS);
    assert.equal(waits.status, 'wait');
    const withTeams: PlaceTargets = { ...TARGETS, teams: [...TARGETS.teams,
      { id: 'lions', name: 'U11 Lions', divisionName: 'U11', seasonId: 'sp28', seasonName: 'Spring 2028', live: true },
      { id: 'owls', name: 'U9 Owls', divisionName: 'U9', seasonId: 'sp28', seasonName: 'Spring 2028', live: true }] };
    const asks = resolvePlace(sharks, 'team', withTeams);
    assert.equal(asks.status, 'pick');
    if (asks.status === 'pick') {
      assert.deepEqual(asks.choices.map(c => c.id), ['owls', 'lions']);
      assert.equal(asks.choices[0].group, 'U9 · Spring 2028');
      assert.equal(asks.chosen, null);
    }
    assert.equal(placeForPress(asks, null), null, 'unticked until a team is picked');
    assert.deepEqual(placeForPress(asks, 'owls'), { targetId: 'owls', targetName: 'U9 Owls' });
    assert.equal(placeForPress(asks, 'not-a-choice'), null);
  });
  it('the package’s last day when it hasn’t passed; when it has, the same day a year on; none gives none', () => {
    assert.deepEqual(lastDayFor('2028-08-31', TODAY), { endsOn: '2028-08-31', passed: null });
    assert.deepEqual(lastDayFor('2027-08-31', TODAY), { endsOn: '2028-08-31', passed: '2027-08-31' });
    assert.deepEqual(lastDayFor(null, TODAY), { endsOn: null, passed: null });
  });
  it('an archived package can’t be emailed (7A)', () => {
    const r = againRows(input({ packages: [pkg({ archivedAt: '2027-12-01T00:00:00Z', name: 'Program ad' })] }))[0];
    assert.equal(r.group, 'blocked');
    assert.equal(r.why, 'The Program ad package is archived. Offer them another one.');
  });
});

describe('the callout (11A) and one old deal (12A)', () => {
  it('counts businesses that paid a deal last year; left = rows that can still be offered', () => {
    const inp = input({ deals: [deal(), deal({ id: 'x', sponsorId: 's2', state: 'offered', paidOn: null })], contacts: [{ id: 's1', email: 'a@b.ca' }, { id: 's2', email: 'c@d.ca' }] });
    assert.deepEqual(againCallout(inp, againRows(inp)), { sponsored: 1, left: 1 });
  });
  it('Offer again on one old deal: only a paid deal from an earlier year that can be emailed on a reason that holds', () => {
    assert.ok(canOfferAgainOne(deal(), input(), LAST_YEAR));
    assert.equal(canOfferAgainOne(deal({ state: 'invoiced' }), input(), LAST_YEAR), null);
    assert.equal(canOfferAgainOne(deal({ offeredOn: '2028-01-05' }), input(), THIS_YEAR), null, 'this year’s deal');
    assert.equal(canOfferAgainOne(deal(), input({ paidOn: new Map([['s1', '2025-12-14']]) }), LAST_YEAR), null, 'the reason ran out (/legal must-fix 5)');
    const running = deal({ endsOn: '2028-03-31' });
    assert.equal(canOfferAgainOne(running, input({ deals: [running] }), LAST_YEAR), null, 'it still holds the package this year');
    const renewed = deal({ id: 'new', offeredOn: '2028-01-04', endsOn: '2028-08-31', state: 'offered' });
    assert.equal(canOfferAgainOne(deal(), input({ deals: [deal(), renewed] }), LAST_YEAR), null, 'already renewed');
  });
  it('"They paid us" rests on the payments on record, on every single offer (owner 2026-11-25)', () => {
    const step = read('lib/club-sponsorship-offer-send.ts');
    assert.match(step, /if \(on\) return reasonOn > on \? DEAL_WORDS\.again\.errPaidLater\(on\) : null;/);
    assert.match(step, /await sponsorHasPayment\(orgId, sponsorId\)\) \? O\.errNoStanding : null/);
    for (const f of ['route.ts', '[dealId]/email/route.ts']) {
      assert.match(read(`app/api/admin/sponsorships/deals/${f}`), /paidReasonRefusal\(org\.id, /, f);
    }
    // Send the link again asks through its plan (Board Ready Stage 6 fixes, B-2), which the deal's page reads too.
    assert.match(read('app/api/admin/sponsorships/deals/[dealId]/again/route.ts'), /await againPlan\(/);
    assert.match(step, /await paidReasonRefusal\(input\.orgId, deal\.sponsorId, first\.reasonOn, today\)/);
  });
});

describe('one send step (drawing F6; /legal must-fixes 2–4)', () => {
  it('nothing but the shared step calls the offer email', () => {
    const files = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts')];
    const callers = files.filter(f => /\bsendOfferEmail\(/.test(read(f))).map(f => f.replace(/\\/g, '/')).sort();
    assert.deepEqual(callers, ['lib/club-sponsorship-offer-send.ts', 'lib/sponsor-offer-email.ts']);
    assert.ok(!files.some(f => /\bemailDealOffer\b/.test(read(f))), 'the old per-route send is gone');
  });
  it('every route that sends an offer asks the shared check first', () => {
    for (const f of filesUnder('app/api/admin/sponsorships', '.ts')) {
      const code = read(f);
      if (!/\b(sendOffer|offerNewDeal)\(/.test(code)) continue;
      assert.match(code, /\b(offer(Send|Club)Check|againPlan)\(/, `${f} sends without offerSendCheck`);
    }
    // againPlan is a door to the same check, never a way round it.
    const step = read('lib/club-sponsorship-offer-send.ts');
    assert.match(step.slice(step.indexOf('export async function againPlan(')), /await offerSendCheck\(\{[\s\S]*?if \(!check\.ok\) return \{ emails: false/);
  });
});
