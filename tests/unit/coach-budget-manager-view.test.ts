/**
 * THE CATEGORIES & ITEMS DIALOG'S VIEW RULES (owner rulings 2026-09-09, mockup 43698c62 round 4b).
 *
 * The three rules under test are the ones the owner's questions turned on, in the order they were
 * asked: a shelf earns its side from its items (so "uniform hats" can never sit under money in, and
 * Tournaments sits under both); the filter is by tier of item (so the coach's handful of rows is the
 * page and the shared library is behind a chip); and the add form's category list is ordered, never
 * filtered (so a heading showing under the other band is offered rather than twinned).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BudgetCategoryWithItems, BudgetItem } from '../../lib/types';
import {
  buildManagerView, categoryOptionsForSide, reportingLine, notYetLabel,
  MANAGER_FILTER_LABEL, SIDE_BAND_LABEL, SIDE_ORDER, SIDE_FLOW_LABEL, SIDE_FLOW_SHORT,
} from '../../lib/coach-budget-manager-view';

const ORG = 'org-1';
const TEAM = 'team-a';
const OTHER = 'team-b';

type Tier = 'platform' | 'club' | 'team' | 'other-team';
const owner = (tier: Tier) => ({
  orgId:  tier === 'platform' ? null : ORG,
  teamId: tier === 'team' ? TEAM : tier === 'other-team' ? OTHER : null,
});

let n = 0;
function item(name: string, direction: 'in' | 'out', tier: Tier, categoryId: string): BudgetItem {
  n += 1;
  return {
    id: `i${n}`, categoryId, ...owner(tier), name, suggestedAmount: null, sortOrder: n,
    isDefault: tier === 'platform', isMisc: false, direction, actualSource: 'typed', createdAt: '',
  };
}
function category(
  name: string, tier: Tier, sortOrder: number,
  items: Array<[string, 'in' | 'out', Tier]>,
  incomeSource: 'typed' | 'fundraiser' | 'sponsor' = 'typed',
): BudgetCategoryWithItems {
  const id = `c-${name.toLowerCase().replace(/\W+/g, '-')}`;
  return {
    id, ...owner(tier), name, scope: 'team', sortOrder, isDefault: tier === 'platform',
    incomeSource, createdAt: '',
    items: items.map(([nm, dir, t]) => item(nm, dir, t, id)),
  };
}

/** The demo world's shape, reduced: two mixed standard shelves, two one-sided ones, a club shelf,
 *  the team's own heading (costs only), the team's own item on a standard shelf, and an empty own
 *  heading. Plus another team's private heading, which must never show. */
function library(): BudgetCategoryWithItems[] {
  return [
    category('Tournaments', 'platform', 1, [
      ['Entry Fees', 'out', 'platform'], ['Registration revenue', 'in', 'platform'], ['Gate / admission', 'in', 'platform'],
    ]),
    category('Team Gear', 'platform', 2, [['Jerseys', 'out', 'platform'], ['Hats', 'out', 'platform']]),
    category('Fundraising', 'platform', 3, [
      ['Fundraising drive', 'in', 'platform'], ['Printing', 'out', 'platform'], ['Chocolate sale', 'in', 'team'], ['Raffle', 'in', 'club'],
    ], 'fundraiser'),
    category('Sponsorship', 'platform', 4, [['Team sponsorship', 'in', 'platform']], 'sponsor'),
    category('Club Events', 'club', 5, [['Banquet', 'out', 'club']]),
    category('Provincials Trip', 'team', 6, [['Hotel block', 'out', 'team'], ['Charter bus', 'out', 'team']]),
    category('Old heading', 'team', 7, []),
    category('Their Trip', 'other-team', 8, [['Their bus', 'out', 'other-team']]),
  ];
}

const shelfNames = (shelves: { category: { name: string } }[]) => shelves.map(s => s.category.name);
const itemNames  = (shelf: { items: { name: string }[] }) => shelf.items.map(i => i.name);

test('the two bands carry the Add Line form\'s words, money coming in first', () => {
  assert.deepEqual([...SIDE_ORDER], ['in', 'out']);
  assert.equal(SIDE_BAND_LABEL.in, 'Money coming in');
  assert.equal(SIDE_BAND_LABEL.out, 'Money the team spends');
  assert.deepEqual(MANAGER_FILTER_LABEL, { team: 'Our own', club: 'Club', platform: 'Standard', all: 'Everything' });
});

/* ⚠ THE PAIR THAT DRIFTED. The shared picker used to keep its own hand-written side words and one
   sentence read "money coming in" against "an expense" — plain language on one side, an accounting
   noun on the other. Both halves are pinned here so a future edit cannot change one alone. */
test('the flow words are symmetric, and the short pair is the Ledger’s own column headings', () => {
  assert.equal(SIDE_FLOW_LABEL.in,  'Money coming in');
  assert.equal(SIDE_FLOW_LABEL.out, 'Money going out');
  assert.equal(SIDE_FLOW_SHORT.in,  'Money in');
  assert.equal(SIDE_FLOW_SHORT.out, 'Money out');
});

test('a shelf earns its side from its items: Tournaments under both, Team Gear under spending only', () => {
  const view = buildManagerView(library(), TEAM, 'all', '');
  assert.deepEqual(shelfNames(view.bands.in), ['Tournaments', 'Fundraising', 'Sponsorship']);
  assert.deepEqual(shelfNames(view.bands.out), ['Tournaments', 'Team Gear', 'Fundraising', 'Club Events', 'Provincials Trip']);
  const tIn  = view.bands.in.find(s => s.category.name === 'Tournaments')!;
  const tOut = view.bands.out.find(s => s.category.name === 'Tournaments')!;
  assert.deepEqual(itemNames(tIn),  ['Registration revenue', 'Gate / admission']);
  assert.deepEqual(itemNames(tOut), ['Entry Fees']);
  // "Uniform hats" can never appear under money coming in.
  assert.ok(!view.bands.in.some(s => s.category.name === 'Team Gear'));
});

test('Our own shows a standard heading only because the team\'s item lives under it, with that item alone', () => {
  const view = buildManagerView(library(), TEAM, 'team', '');
  assert.deepEqual(shelfNames(view.bands.in), ['Fundraising']);
  assert.deepEqual(itemNames(view.bands.in[0]), ['Chocolate sale']);
  assert.deepEqual(shelfNames(view.bands.out), ['Provincials Trip']);
  assert.deepEqual(itemNames(view.bands.out[0]), ['Hotel block', 'Charter bus']);
  assert.deepEqual(view.ownPerBand, { in: 1, out: 3 }, '"1 of yours" and "3 of yours" on the bands');
});

test('an own heading gains the money-in band the moment it holds a money-in item — the Tournaments flexibility, with no setting', () => {
  const lib = library();
  const trip = lib.find(c => c.name === 'Provincials Trip')!;
  trip.items.push(item('Trip fundraiser', 'in', 'team', trip.id));
  const view = buildManagerView(lib, TEAM, 'team', '');
  assert.deepEqual(shelfNames(view.bands.in), ['Fundraising', 'Provincials Trip']);
  assert.deepEqual(itemNames(view.bands.in[1]), ['Trip fundraiser']);
  assert.deepEqual(itemNames(view.bands.out[0]), ['Hotel block', 'Charter bus'], 'the cost half is unchanged');
});

test('the club and standard chips show their own tiers; another team\'s private heading shows nowhere', () => {
  const club = buildManagerView(library(), TEAM, 'club', '');
  assert.deepEqual(shelfNames(club.bands.in), ['Fundraising']);
  assert.deepEqual(itemNames(club.bands.in[0]), ['Raffle']);
  assert.deepEqual(shelfNames(club.bands.out), ['Club Events']);
  const std = buildManagerView(library(), TEAM, 'platform', '');
  assert.ok(!std.bands.out.some(s => s.category.name === 'Provincials Trip'));
  for (const filter of ['team', 'club', 'platform', 'all'] as const) {
    const v = buildManagerView(library(), TEAM, filter, '');
    assert.ok(![...v.bands.in, ...v.bands.out].some(s => s.category.name === 'Their Trip'), `${filter}: another team's heading leaked`);
  }
});

test('the chip counts are of the library — headings and items of each tier — and never of the search', () => {
  const view = buildManagerView(library(), TEAM, 'team', 'zzz');
  // Own: Provincials Trip + Old heading (2 headings) + Hotel block, Charter bus, Chocolate sale (3 items).
  assert.equal(view.counts.team, 5);
  // Club: Club Events (1) + Banquet, Raffle (2).
  assert.equal(view.counts.club, 3);
  // Standard: Tournaments, Team Gear, Fundraising, Sponsorship (4) + 8 platform items.
  assert.equal(view.counts.platform, 12);
  // Everything: the three tiers, and nothing of the other team's — its heading and item are dropped
  // before counting, the same fail-closed posture the list route takes.
  assert.equal(view.counts.all, 5 + 3 + 12);
});

test('an own heading with nothing under it is listed once as an orphan, under Our own and Everything only', () => {
  assert.deepEqual(buildManagerView(library(), TEAM, 'team', '').orphans.map(c => c.name), ['Old heading']);
  assert.deepEqual(buildManagerView(library(), TEAM, 'all', '').orphans.map(c => c.name), ['Old heading']);
  assert.deepEqual(buildManagerView(library(), TEAM, 'club', '').orphans, []);
  assert.deepEqual(buildManagerView(library(), TEAM, 'platform', '').orphans, []);
});

test('search narrows to matching headings (whole shelf) or matching items (those rows), and offers Everything when the filter hides the match', () => {
  const byItem = buildManagerView(library(), TEAM, 'all', 'gate');
  assert.deepEqual(shelfNames(byItem.bands.in), ['Tournaments']);
  assert.deepEqual(itemNames(byItem.bands.in[0]), ['Gate / admission']);
  assert.deepEqual(byItem.bands.out, []);

  const byHeading = buildManagerView(library(), TEAM, 'all', 'team gear');
  assert.deepEqual(itemNames(byHeading.bands.out[0]), ['Jerseys', 'Hats'], 'a matching heading shows all its items');

  const hidden = buildManagerView(library(), TEAM, 'team', 'jerseys');
  assert.deepEqual(hidden.bands.in, []);
  assert.deepEqual(hidden.bands.out, []);
  assert.equal(hidden.matchesUnderEverything, 2, 'Team Gear + Jerseys would show under Everything');

  const found = buildManagerView(library(), TEAM, 'team', 'choc');
  assert.equal(found.matchesUnderEverything, 0, 'no door when the filter already matches');
});

test('the add form\'s category list is ordered, not filtered: taking this side first, then every other heading', () => {
  const inSide = categoryOptionsForSide(library(), 'in', TEAM);
  assert.deepEqual(inSide.taking.map(c => c.name), ['Tournaments', 'Fundraising', 'Sponsorship']);
  assert.deepEqual(inSide.notYet.map(c => c.name), ['Team Gear', 'Club Events', 'Provincials Trip', 'Old heading'],
    'every other heading the team can see, its own empties included, never another team\'s');
  assert.equal(notYetLabel('in'), 'Not taking money in yet — pick one and it will');
  const outSide = categoryOptionsForSide(library(), 'out', TEAM);
  assert.ok(outSide.taking.some(c => c.name === 'Provincials Trip'));
  assert.ok(outSide.notYet.some(c => c.name === 'Sponsorship'));
});

test('the reporting line follows the shelf: a drive, a sponsor, or the coach — and under the heading\'s own name', () => {
  assert.equal(reportingLine({ name: 'Fundraising', incomeSource: 'fundraiser' }, 'in'), 'Under Fundraising, a drive fills in its money.');
  assert.equal(reportingLine({ name: 'Sponsorship', incomeSource: 'sponsor' }, 'in'), 'Under Sponsorship, a sponsor fills in its money.');
  const own = reportingLine({ name: 'Bake sales' }, 'in')!;
  assert.ok(own.startsWith('Will report under Bake sales.'), own);
  assert.ok(!/other income/i.test(own), 'a coach\'s own money-in heading reports under its own name since the shelf ruling');
  assert.equal(reportingLine({ name: 'Team Gear' }, 'out'), null, 'nothing to say on the spending side');
  assert.equal(reportingLine({ name: '   ' }, 'in'), null);
});
