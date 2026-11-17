import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { matchesFee, regFilterCounts, NO_PICKS } from '../../lib/house-league-registrations.ts';
import { feeState, seasonMoney, stillOwingCents, type LeagueMoneyLine } from '../../lib/league-money.ts';
import { clearingCentsByReg, clearingShareCents, type RegDebit } from '../../lib/league-debits.ts';
import { seasonCalendar, teamNextBooking } from '../../lib/league-season-calendar.ts';
import { findMoney, findNextLine, findOrder, findStatus, FIND_WORDS } from '../../lib/house-league-find.ts';
import { MONEY_PAGE_WORDS, REGS_WORDS } from '../../lib/house-league-money-words.ts';
import type { LeagueGame, LeaguePractice, LeagueRegistration } from '../../lib/types.ts';

/**
 * Club Tier Stage 13e, Session A — the registrar's house league (build prompt CLUB_TIER_STAGE13E_BUILD_PROMPT.md; drawing
 * tabs 2, 3 and 7). One shared Still owing rule (13e-3), Received's "1 in part" (13e-8), Still owing's doors (13e-2, 13e-3),
 * Find a child (13e-4, 13e-1).
 */
const TODAY = '2026-11-16';
const SEASON = { registrationFee: 150, owingAmberDays: 14 };
const reg = (id: string, over: Partial<LeagueRegistration> = {}): LeagueRegistration => ({
  id, seasonId: 's', divisionId: 'd', playerFirstName: 'Ava', playerLastName: id, playerDateOfBirth: null, playerJerseyPref: null,
  playerPositionPref: null, playerNotes: null, guardianFirstName: 'Grace', guardianLastName: 'Kim', guardianEmail: `${id}@x.ca`, guardianPhone: null,
  status: 'active', waitlistPosition: null, teamId: null, registrationFeePaid: false, feeEntryId: null, adminNotes: null, source: 'public_form',
  waiverAcceptedAt: null, signupRef: null, signupPosition: null, feeAmount: 150, acceptedAt: '2026-10-21T15:00:00Z', endedAt: null,
  spotReleased: false, endMoney: null, endMoneyReason: null, withdrawRequestedAt: null, withdrawRequestNote: null,
  registeredAt: '2026-10-01T15:00:00Z', updatedAt: '2026-10-01T15:00:00Z', ...over,
} as LeagueRegistration);
const paid = (regId: string, amount: number): LeagueMoneyLine => ({
  id: `l-${regId}`, regId, dir: 'in', amount, day: '2026-11-01', method: 'etransfer', status: 'posted', note: null, createdAt: '2026-11-01T15:00:00Z',
});
const debit = (shareCents: number, state: RegDebit['state'] = 'clearing'): RegDebit => ({
  state, onlinePaymentId: 'op', itemId: 'it', totalCents: shareCents, shareCents, feeShareCents: 0, familyPaysFee: false, last4: '6789',
  startedAt: '2026-11-14T15:00:00Z', returnedAt: null, reversedAt: null, reason: null, receiptNo: 1043, siblings: [], decision: null,
});

// The fixture: owing in full, part-paid (Dev Sharma: $75 of $150), part of the fee clearing, the whole fee clearing, paid in
// full, to review, waiting, and ended with the fee kept.
const REGS = [
  reg('owing'),
  reg('part'),
  reg('partClearing'),
  reg('allClearing'),
  reg('paid'),
  reg('review', { status: 'pending_review', acceptedAt: null }),
  reg('wait', { status: 'waitlisted', waitlistPosition: 3, acceptedAt: null }),
  reg('kept', { status: 'withdrawn', endMoney: 'kept', endMoneyReason: 'Late' }),
];
const LINES = new Map<string, LeagueMoneyLine[]>([
  ['part', [paid('part', 75)]], ['paid', [paid('paid', 150)]], ['kept', [paid('kept', 150)]],
]);
const DEBITS: Record<string, RegDebit> = { partClearing: debit(10000), allClearing: debit(15000), paid: debit(5000, 'returned') };
const CLEARING = clearingCentsByReg(DEBITS);

describe('13e-3: one Still owing rule, two lists that cannot drift', () => {
  it('reads what is clearing one way', () => {
    assert.equal(clearingShareCents(debit(10000)), 10000);
    assert.equal(clearingShareCents(debit(10000, 'returned')), 0, 'a returned debit is not on its way');
    assert.equal(clearingShareCents(null), 0);
    assert.deepEqual([...CLEARING.keys()].sort(), ['allClearing', 'partClearing']);
  });

  it('a child with part of the fee clearing stays on both lists, owing the rest', () => {
    const fee = feeState(REGS[2], SEASON, [], TODAY);
    assert.equal(stillOwingCents(fee, 10000), 5000);
    assert.ok(matchesFee(fee, new Set(['owing']), 10000), 'the filter keeps them (it used to drop the child entirely)');
    const all = feeState(REGS[3], SEASON, [], TODAY);
    assert.equal(stillOwingCents(all, 15000), 0);
    assert.ok(!matchesFee(all, new Set(['owing']), 15000), 'all of it on its way: owing nothing, on neither list');
  });

  it('Fee: Owing lists exactly the children Money counts as Still owing', () => {
    const band = seasonMoney(REGS, SEASON, LINES, CLEARING);
    const active = REGS.filter(r => r.status === 'active');
    const filter = active.filter(r => matchesFee(feeState(r, SEASON, LINES.get(r.id) ?? [], TODAY), new Set(['owing']), CLEARING.get(r.id) ?? 0));
    // Money's Still owing rows are the same rule (the ledger route asks `stillOwingCents`, pinned below).
    const rows = REGS.filter(r => stillOwingCents(feeState(r, SEASON, LINES.get(r.id) ?? [], TODAY), CLEARING.get(r.id) ?? 0) > 0);
    assert.deepEqual(filter.map(r => r.id), ['owing', 'part', 'partClearing']);
    assert.deepEqual(rows.map(r => r.id), filter.map(r => r.id));
    assert.equal(band.owingPlayers, filter.length);
    assert.equal(band.owing, 150 + 75 + 50);
    const counts = regFilterCounts(active, r => feeState(r, SEASON, LINES.get(r.id) ?? [], TODAY), NO_PICKS,
      { team: [], fee: ['owing', 'received'], flags: [] }, r => CLEARING.get(r.id) ?? 0);
    assert.equal(counts.fee.get('owing'), filter.length, 'the menu count is the same rule');
  });

  it('the band still adds up the way it did (no figure moved)', () => {
    const b = seasonMoney(REGS, SEASON, LINES, CLEARING);
    assert.equal(b.owed, 150 * 5);
    assert.equal(b.clearing, 100 + 150);
    assert.equal(Math.round((b.received - 150) * 100) + Math.round(b.clearing * 100) + Math.round(b.owing * 100), Math.round(b.owed * 100),
      'owed = received (from the accepted) + clearing + still owing');
  });

  it('there is no second definition: every reader asks the shared helpers', () => {
    const ledger = readCode('app/api/admin/house-league/seasons/[seasonId]/ledger/route.ts');
    assert.match(ledger, /stillOwingCents\(fee, clearingCents\.get\(o\.regId\) \?\? 0\)/);
    assert.match(ledger, /clearingCentsByReg\(debits, activeIds\)/);
    for (const f of ['app/api/admin/house-league/seasons/[seasonId]/ledger/route.ts', 'app/api/admin/house-league/seasons/[seasonId]/route.ts', 'lib/club-band-read.ts']) {
      assert.doesNotMatch(readCode(f), /d\.state === 'clearing'/, `${f} builds its own clearing map`);
    }
    const lib = readCode('lib/house-league-registrations.ts');
    assert.match(lib, /picks\.has\('owing'\) && stillOwingCents\(fee, clearingCents\) > 0/);
    // The old drop-the-child rule, in the filter. (A row's own actions still offer no Mark received while a debit clears —
    // 12c Part 6, a different question from which list the child is on.)
    const matchesFeeBody = lib.slice(lib.indexOf('export function matchesFee'), lib.indexOf('// ── The Filter\'s three groups'));
    assert.doesNotMatch(matchesFeeBody, /isOwing\(fee\) && !clearing\b/);
    const screen = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
    assert.match(screen, /clearingShareCents\(read\?\.debits\?\.\[r\.id\]\)/);
    assert.doesNotMatch(screen, /!!fees\.get\(r\.id\)!?\??\.chip/, 'the filter reads the clearing amount, not the chip');
  });
});

describe('13e-8: Received says "1 in part"', () => {
  it('counts the part-paid inside Received, never takes them out', () => {
    const b = seasonMoney(REGS, SEASON, LINES, CLEARING);
    assert.equal(b.receivedPlayers, 3, 'part-paid, paid in full, and the ended one the club kept');
    assert.equal(b.partPlayers, 1);
    assert.equal(MONEY_PAGE_WORDS.band.inPart(1), '1 in part');
    const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx');
    assert.match(page, /band\.partPlayers > 0 \? `\$\{W\.band\.players\(band\.receivedPlayers\)\} · \$\{W\.band\.inPart\(band\.partPlayers\)\}`/);
  });
});

describe('Money · Still owing: its address, its rows, its doors (13e-2, 13e-3)', () => {
  const page = readCode('app/[orgSlug]/admin/house-league/seasons/[seasonId]/money/page.tsx');
  it('the tab has its own address, the same ?tab= Registrations uses', () => {
    assert.match(page, /const asked = search\.get\('tab'\)/);
    assert.match(page, /\$\{base\}\/money\?tab=\$\{t\}/);
    assert.doesNotMatch(page, /useState<Tab>/, 'no second tab mechanism');
    assert.match(readCode('lib/league-morning.ts'), /href: `\$\{season\}\/money\?tab=owing`/);
    assert.match(readCode('components/admin/kit/club/ClubBand.tsx'), /\/money\?tab=owing`/);
  });
  it('rows and both buttons only for someone who can open Registrations: never a door to a refused page', () => {
    assert.match(page, /const opensRegistrations = !!access\?\.read;/);
    assert.match(page, /const emailsFamilies = opensRegistrations && !!access\?\.email;/);
    assert.match(page, /\{opensRegistrations && \(\s*<div className=\{s\.owingActions\}>/);
    assert.match(page, /\{emailsFamilies && \(/);
    // Every link into Registrations is behind the gate (the Refunds line's names too).
    assert.match(page, /href=\{opensRegistrations \? childHref : null\}/);
    assert.match(page, /const childHref = \(regId: string\) => `\$\{regsHref\}\?reg=\$\{regId\}&at=fee`/);
  });
  it('"Open on Registrations" sets Active and Fee: Owing, the one pick a link can set', () => {
    assert.match(page, /\$\{regsHref\}\?tab=active&fee=owing/);
    const screen = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
    assert.match(screen, /search\.get\('fee'\) === 'owing' \? \{ \.\.\.NO_PICKS, fee: new Set\(\['owing'\]\) \} : NO_PICKS/);
    assert.doesNotMatch(screen, /search\.get\('(division|q|team|flags)'\)/, 'the link vocabulary is not widened past Fee: Owing');
  });
  it('"Email these families" opens the existing window with Still owing ticked, and builds no sender', () => {
    assert.match(page, /<EmailFamiliesWindow[\s\S]*?ticked: read\.owing\.map\(o => o\.regId\)/);
    assert.doesNotMatch(page, /method: 'POST'|\/send/, 'Money sends nothing itself');
    assert.equal(MONEY_PAGE_WORDS.emailThese, 'Email these families');
  });
});

describe('Registrations: the twin line, and the search names the tab (13e-3, F-R5-1)', () => {
  const screen = readCode('components/admin/kit/club/league/registrations/RegistrationsScreen.tsx');
  it('names Money\'s Still owing only when it is true', () => {
    assert.match(screen, /tab === 'active' && !scope && !searching && onlyOwing && tabRegs\.length > 0/);
    assert.match(screen, /W\.twin\(tabRegs\.length\)/, 'the count is the list\'s own');
    assert.equal(REGS_WORDS.twin(12), '12 owing, the same 12 as Money’s Still owing.');
  });
  it('a miss names the view that has the child, and keeps the search', () => {
    assert.equal(REGS_WORDS.empty.searchMiss('To review', 'isaac'), 'No one in To review matches “isaac”.');
    assert.equal(REGS_WORDS.empty.searchElsewhere([{ n: 1, tab: 'Active' }]), '1 match in Active');
    assert.equal(REGS_WORDS.empty.searchElsewhere([{ n: 2, tab: 'Active' }, { n: 1, tab: 'Waitlist' }]), '2 matches in Active · 1 in Waitlist');
    assert.equal(REGS_WORDS.empty.showIn(1, 'Active'), 'Show it in Active');
    // Switching view changes the address only; the search is the screen's own state and is never cleared by it.
    assert.match(screen, /if \(seenTab !== tab\) \{ setSeenTab\(tab\); setSelected\(new Set\(\)\); setShown\(PAGE\); setNotes\(\{\}\); \}/);
  });
});

describe('Find a child or a parent (13e-4, 13e-1)', () => {
  const route = readCode('app/api/admin/house-league/find/route.ts');
  it('is gated exactly as Registrations, and only reads', () => {
    assert.match(route, /houseLeagueRefusal\(ctx, 'read'\)/);
    assert.doesNotMatch(route, /export const (POST|PATCH|PUT|DELETE)/);
    assert.doesNotMatch(route, /\.(insert|update|upsert|delete)\(/);
    assert.match(route, /\.eq\('org_id', orgId\)/, 'the tenant is named on the cross-season read');
    assert.match(route, /matchesSearch\(r, query\)/, 'Registrations\' own search decides');
    assert.match(route, /teamNextBooking\(f\.bookings, r\.teamId!, nowMs\)/, 'the schedule\'s own pick');
    assert.match(route, /seasonCalendar\(\{/);
  });

  it('the team\'s next is whatever comes first, a practice or a game; never one called off or past', () => {
    const at = (iso: string) => iso;
    const game = (id: string, iso: string, over: Partial<LeagueGame> = {}) => ({
      id, seasonId: 's', divisionId: 'd', homeTeamId: 'reds', awayTeamId: 'blues', scheduledAt: at(iso), endsAt: null,
      status: 'scheduled', location: 'Kinsmen Park', orgVenueId: null, orgVenueFacilityId: null, homeScore: null, awayScore: null, ...over,
    } as unknown as LeagueGame);
    const practice = (id: string, iso: string, over: Partial<LeaguePractice> = {}) => ({
      id, seasonId: 's', divisionId: 'd', teamId: 'reds', scheduledAt: at(iso), endsAt: null, status: 'scheduled', location: 'Diamond B',
      orgVenueId: null, orgVenueFacilityId: null, clubScheduleSlotId: null, ...over,
    } as unknown as LeaguePractice);
    const teamName = new Map([['reds', 'Reds'], ['blues', 'Blues']]);
    const cal = (games: LeagueGame[], practices: LeaguePractice[]) => seasonCalendar({
      seasonName: 'Fall', sport: 'baseball', games, practices, teamName, divisionName: new Map([['d', 'U9 Rookie']]), placeOf: () => null,
    }).bookings;
    const now = Date.parse('2026-11-16T15:00:00Z');
    const b = cal(
      [game('g0', '2026-11-10T23:00:00Z'), game('g1', '2026-11-26T23:00:00Z'), game('gx', '2026-11-18T23:00:00Z', { status: 'cancelled' as LeagueGame['status'] })],
      [practice('p1', '2026-11-24T23:00:00Z'), practice('pb', '2026-11-20T23:00:00Z', { teamId: 'blues' })],
    );
    assert.equal(teamNextBooking(b, 'reds', now)?.key, 'league_practice:p1', 'the practice comes first');
    assert.equal(teamNextBooking(b, 'blues', now)?.key, 'league_practice:pb');
    const gameOnly = cal([game('g1', '2026-11-26T23:00:00Z')], []);
    const next = teamNextBooking(gameOnly, 'reds', now);
    assert.equal(findNextLine('Reds', next), 'Reds’ next: Thu, Nov 26, 6:00 p.m. · Reds vs Blues · Kinsmen Park');
    assert.equal(findNextLine('Blue Jays', next)?.startsWith('Blue Jays’ next'), true);
    assert.equal(findNextLine('Thunder', next)?.startsWith('Thunder’s next'), true);
    assert.equal(teamNextBooking(gameOnly, 'greens', now), null);
    assert.equal(findNextLine('Reds', null), null);
    // A game scored inside its window is played: the next is the one after it (/review 13e-A).
    const scored = cal([game('gs', '2026-11-16T14:30:00Z', { status: 'completed' as LeagueGame['status'] }), game('g1', '2026-11-26T23:00:00Z')], []);
    assert.equal(teamNextBooking(scored, 'reds', now)?.key, 'league_game:g1');
  });

  it('"Show all" never promises more rows than it lists', () => {
    assert.equal(FIND_WORDS.showAll(23), 'Show all 23');
    assert.equal(FIND_WORDS.showAll(250), 'Show the first 100 of 250');
  });

  it('a row says where the child is and what is owing, by the one rule', () => {
    assert.equal(findStatus({ status: 'waitlisted', waitlistPosition: 3 }), 'Waitlist #3');
    assert.equal(findStatus({ status: 'pending_review', waitlistPosition: null }), 'To review');
    assert.equal(findStatus({ status: 'declined', waitlistPosition: null }), 'Ended');
    assert.equal(findMoney(REGS[0], SEASON, [], TODAY, null), '$150 owing');
    assert.equal(findMoney(REGS[2], SEASON, [], TODAY, DEBITS.partClearing), '$50 owing');
    assert.equal(findMoney(REGS[3], SEASON, [], TODAY, DEBITS.allClearing), '$150 clearing');
    assert.equal(findMoney(REGS[4], SEASON, [paid('paid', 150)], TODAY, null), 'Paid');
    assert.equal(findMoney(REGS[6], SEASON, [], TODAY, null), FIND_WORDS.nothingYet);
  });

  it('running seasons first, then by name', () => {
    const rows = findOrder([{ seasonRank: 1, child: 'Ann' }, { seasonRank: 0, child: 'Zoe' }, { seasonRank: 0, child: 'Bea' }]);
    assert.deepEqual(rows.map(r => r.child), ['Bea', 'Zoe', 'Ann']);
  });

  it('sits on House league\'s home, behind the page\'s own Registrations gate', () => {
    const home = readCode('app/[orgSlug]/admin/house-league/page.tsx');
    assert.match(home, /if \(!access\?\.read\) return <NotYours page="houseLeague" \/>;[\s\S]*<FindChild orgSlug=\{orgSlug\} \/>/);
  });
});
