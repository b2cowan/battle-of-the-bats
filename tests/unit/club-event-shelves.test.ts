import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventInYear, eventShelves, isGenericTournamentsShelf } from '../../lib/club-event-shelves.ts';
import type { BudgetCategoryWithItems } from '../../lib/types.ts';
import type { FiscalSetting } from '../../lib/club-fiscal-year.ts';

const cat = (id: string, name: string, extra: Partial<BudgetCategoryWithItems> = {}): BudgetCategoryWithItems => ({
  id, orgId: 'org-1', teamId: null, teamName: null, name, scope: 'org', sortOrder: 0, isDefault: false, createdAt: '2026-01-01', items: [], ...extra,
});
const event = (id: string, name: string, startDate: string | null, endDate: string | null) =>
  cat(id, `Hosted tournament · ${name}`, { hostedEvent: { tournamentId: `t-${id}`, startDate, endDate } });
const generic = cat('generic', 'Tournaments', { orgId: null, isDefault: true });
const sponsorship = cat('spons', 'Sponsorship');

/* A calendar-year club: the fiscal year of 2026-10-21 runs 2026-01-01 to 2026-12-31. */
const FISCAL: FiscalSetting = { firstMonth: 1, rows: [] };
const DAY = '2026-10-21';

const thisYear = event('a', 'UAT Invitational 2026', '2026-10-17', '2026-10-18');
const alsoThisYear = event('b', 'Fall Classic 2026', '2026-11-07', '2026-11-08');
const lastYear = event('c', 'Winter Dome Cup 2025', '2025-02-01', '2025-02-02');
const all = [thisYear, alsoThisYear, lastYear, generic, sponsorship];

const GENERAL = { kind: 'org', entityId: null } as const;
const OWN = { kind: 'tournament', entityId: 't-a' } as const;
const run = (over: Partial<Parameters<typeof eventShelves>[0]> = {}) =>
  eventShelves({ categories: all, book: GENERAL, day: DAY, fiscal: FISCAL, direction: 'in', ...over });
const ids = (s?: ReadonlySet<string>) => [...(s ?? [])].sort();

describe('the standard Tournaments shelf is recognised by what it is, not by its name alone', () => {
  it('is the platform default called Tournaments', () => {
    assert.equal(isGenericTournamentsShelf(generic), true);
  });
  it('is not a club shelf that happens to share the name, nor a hosted event', () => {
    assert.equal(isGenericTournamentsShelf(cat('x', 'Tournaments')), false);
    assert.equal(isGenericTournamentsShelf(thisYear), false);
  });
});

describe('an event is in a fiscal year by either of its two days', () => {
  const year = { firstDay: '2026-01-01', lastDay: '2026-12-31' };
  it('counts an event that starts or ends inside the year', () => {
    assert.equal(eventInYear({ startDate: '2025-12-30', endDate: '2026-01-02' }, year), true);
    assert.equal(eventInYear({ startDate: '2026-12-30', endDate: '2027-01-02' }, year), true);
  });
  it('does not count an event wholly outside it', () => {
    assert.equal(eventInYear({ startDate: '2025-02-01', endDate: '2025-02-02' }, year), false);
  });
  it('counts an event with no dates, or no year to compare, as inside (folded is the safe error)', () => {
    assert.equal(eventInYear({ startDate: null, endDate: null }, year), true);
    assert.equal(eventInYear({ startDate: '2025-02-01', endDate: null }, null), true);
  });
});

describe('a club with no hosted event sees its list exactly as before', () => {
  it('gives the picker nothing to change', () => {
    assert.equal(run({ categories: [generic, sponsorship] }), undefined);
  });
});

describe('the general book: this year\'s events fold, other years appear only when typed at', () => {
  const r = run()!;
  it('folds the events of the entry\'s own fiscal year', () => {
    assert.deepEqual(ids(r.folded), ['a', 'b']);
  });
  it('shows an event of another year only while someone types', () => {
    assert.deepEqual(ids(r.searchOnly), ['c']);
  });
  it('hides nothing and has no lead shelf', () => {
    assert.equal(r.hidden, undefined);
    assert.equal(r.lead, undefined);
  });
  it('follows the DATE of the entry: dated last year, last year\'s event is the folded one', () => {
    const back = run({ day: '2025-02-01' })!;
    assert.deepEqual(ids(back.folded), ['c']);
    assert.deepEqual(ids(back.searchOnly), ['a', 'b']);
  });
  it('folds everything when the date is not a real day yet (typing in progress)', () => {
    const typing = run({ day: '0002-' })!;
    assert.deepEqual(ids(typing.folded), ['a', 'b', 'c']);
    assert.equal(typing.searchOnly!.size, 0);
  });
});

describe('a tournament\'s own book: its shelf leads and nothing else about events shows', () => {
  it('leads with the event\'s shelf and hides every other event', () => {
    const r = run({ book: OWN })!;
    assert.equal(r.lead, 'a');
    assert.equal(r.leadNote, 'this tournament');
    assert.deepEqual(ids(r.hidden), ['b', 'c', 'generic']);
  });
  it('hides the generic Tournaments shelf for money IN — its words are the event\'s now', () => {
    assert.equal(run({ book: OWN })!.hidden!.has('generic'), true);
  });
  it('KEEPS the generic Tournaments shelf for money OUT — it is where fees paid to enter other tournaments are filed', () => {
    assert.deepEqual(ids(run({ book: OWN, direction: 'out' })!.hidden), ['b', 'c']);
  });
  it('a tournament book whose event has no shelf yet behaves like any other club book', () => {
    const r = run({ book: { kind: 'tournament', entityId: 't-none' } })!;
    assert.equal(r.lead, undefined);
    assert.deepEqual(ids(r.folded), ['a', 'b']);
  });
});
