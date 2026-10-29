/**
 * ONE TOURNAMENT AT A TIME (A23, owner 2026-10-10; Tournament admin redesign Stage 5, Part 0).
 *
 * On a one-slot plan only a Draft or an Active event holds the slot. A finished event doesn't: its site stays online
 * while next year's is set up. Before this, every event not archived held it, so a free organizer had to take last
 * year's results offline to start next year. These assertions pin the rule in its one home (`lib/tournament-slot.ts`),
 * the words that say it, and that every limit check reads it — a check that counts "not archived" again would quietly
 * put the old rule back at one door.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { holdsSlot, needsFreeSlot, SLOT_STATUSES, visibleHolder, withinFreeSlots } from '../../lib/tournament-slot.ts';
import { RECORD_WORDS, slotsInUseRefusal, statusConfirm, statusSentence } from '../../lib/tournament-status-words.ts';
import { LIST_WORDS, NEXT_YEAR_WORDS } from '../../lib/after-event-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('one at a time — what holds a slot', () => {
  it('Draft and Active hold it; Completed and Archived do not', () => {
    assert.deepEqual([...SLOT_STATUSES], ['draft', 'active']);
    assert.equal(holdsSlot('draft'), true);
    assert.equal(holdsSlot('active'), true);
    assert.equal(holdsSlot('completed'), false, 'a finished event holds no slot — its site stays online');
    assert.equal(holdsSlot('archived'), false);
    assert.equal(holdsSlot(null), false);
  });

  it('Reopen and Move back to draft of a finished event need a free slot', () => {
    assert.equal(needsFreeSlot('completed', 'active'), true, 'Reopen');
    assert.equal(needsFreeSlot('completed', 'draft'), true, 'Move back to draft');
    assert.equal(needsFreeSlot('archived', 'active'), true);
  });

  it('Bring back, Mark complete, Archive and Draft ⇄ Active need none', () => {
    assert.equal(needsFreeSlot('archived', 'completed'), false, 'Bring back returns it as Completed, which holds none');
    assert.equal(needsFreeSlot('active', 'completed'), false, 'Mark complete frees the slot');
    assert.equal(needsFreeSlot('completed', 'archived'), false);
    assert.equal(needsFreeSlot('draft', 'active'), false, 'Activate keeps the slot the draft already holds');
    assert.equal(needsFreeSlot('active', 'draft'), false);
  });

  it('a restore brings a finished event back without a slot, and a live one only into a free slot', () => {
    const rows = [
      { id: 'a', s: 'active' }, { id: 'b', s: 'completed' }, { id: 'c', s: 'draft' }, { id: 'd', s: 'completed' },
    ];
    assert.deepEqual(withinFreeSlots(rows, 0, r => r.s).map(r => r.id), ['b', 'd'], 'no free slot: only the finished ones');
    assert.deepEqual(withinFreeSlots(rows, 1, r => r.s).map(r => r.id), ['a', 'b', 'd'], 'one slot: the newest live one takes it');
    assert.deepEqual(withinFreeSlots(rows, 5, r => r.s).map(r => r.id), ['a', 'b', 'c', 'd']);
  });
});

describe('one at a time — the words (/marketing 2026-10-10)', () => {
  it('the refusal names the event that holds the slot and never sends a free organizer to Archive', () => {
    const live = slotsInUseRefusal(1, { name: 'Spring Classic 2027', status: 'active' });
    assert.match(live, /one tournament at a time/);
    assert.match(live, /Spring Classic 2027 holds the slot/);
    assert.match(live, /Mark it complete/);
    assert.doesNotMatch(live, /Archive/, 'archiving takes a site offline — one at a time exists to avoid that (A55)');
    const draft = slotsInUseRefusal(1, { name: 'Spring Classic 2027', status: 'draft' });
    assert.match(draft, /holds the slot as a draft/);
    assert.match(slotsInUseRefusal(1), /another tournament holds the slot/);
    assert.match(slotsInUseRefusal(3, { name: 'X', status: 'draft' }), /drafts hold them all/, 'a draft can’t be marked complete');
  });

  it('a refusal names only an event the caller may see (/review 2026-10-10)', () => {
    const holders = [{ id: 'a', name: 'Hidden', status: 'active' as const }, { id: 'b', name: 'Mine', status: 'draft' as const }];
    assert.equal(visibleHolder(holders, null)?.name, 'Hidden', 'an unrestricted member sees the first holder');
    assert.equal(visibleHolder(holders, ['b'])?.name, 'Mine');
    assert.equal(visibleHolder(holders, ['z']), null, 'nothing they may see: the words say another tournament');
    assert.equal(visibleHolder(holders, undefined), null, 'scope unknown: never named');
  });

  it('a finished event says it holds no slot; Mark complete says it frees one; Bring back promises none', () => {
    const base = { startDate: '2026-06-12', endDate: '2026-06-14', today: '2026-07-01', finiteSlots: true, sealed: false };
    assert.match(statusSentence({ ...base, status: 'completed' }), /doesn’t hold a tournament slot/);
    assert.match(statusSentence({ ...base, status: 'active' }), /It holds a tournament slot/);
    const complete = statusConfirm('complete', { name: 'X', startDate: null, today: base.today, finiteSlots: true });
    assert.match(complete.body, /frees your plan’s tournament slot/);
    const bringBack = statusConfirm('bringBack', { name: 'X', startDate: null, today: base.today, finiteSlots: true });
    assert.doesNotMatch(bringBack.body, /slot/);
  });

  it("Archive says it frees a slot only for an event that holds one", () => {
    const f = { name: 'X', startDate: null, today: '2026-07-01', finiteSlots: true };
    assert.doesNotMatch(statusConfirm('archive', { ...f, status: 'completed' }).body, /slot/, 'a finished event holds none');
    assert.match(statusConfirm('archive', { ...f, status: 'active' }).body, /tournament slot is freed/);
    assert.doesNotMatch(statusConfirm('archive', { ...f, status: 'active' }).body, /if a tournament slot is free/);
  });

  it('the slot line says the rule, and while the slot is held, what frees it', () => {
    assert.match(LIST_WORDS.slotsInUse(0, 1), /^0 of 1 tournament slot in use\. Your plan runs one tournament at a time/);
    assert.match(LIST_WORDS.slotsInUse(1, 1, { name: 'Spring Classic 2026', status: 'active' }), /once Spring Classic 2026 is marked complete/);
    assert.match(LIST_WORDS.slotsInUse(1, 1, { name: 'Spring Classic 2027', status: 'draft' }), /holds it as a draft/);
    assert.equal(LIST_WORDS.slotsInUse(2, 1), '2 events hold slots; your plan has 1.');
    assert.match(RECORD_WORDS.needsSlot('reopen', 'Spring Classic 2027'), /^Reopening needs a free slot, and Spring Classic 2027 holds it\.$/);
    assert.match(NEXT_YEAR_WORDS.oneAtATime, /stays online/);
    assert.doesNotMatch(NEXT_YEAR_WORDS.oneAtATime, /archive/i);
  });
});

describe('one at a time — every limit check reads the one rule', () => {
  const READERS = [
    'app/api/admin/setup-tournament/route.ts',
    'app/api/admin/tournaments/[tournamentId]/clone/route.ts',
    'app/api/admin/tournaments/route.ts',
    'lib/billing-retention.ts',
    'lib/billing-reactivation.ts',
    'lib/billing-usage.ts',
    'app/[orgSlug]/admin/org/tournaments/page.tsx',
    // (The admin rail left this list 2026-10-19: its + and "New tournament" are gone, so it checks no limit.)
    'components/admin/tournament/RecordFromList.tsx',
    'app/[orgSlug]/admin/tournaments/dashboard/page.tsx',
    'app/api/coaches/[orgSlug]/teams/[teamId]/hosted-tournaments/route.ts',
    'app/platform-admin/orgs/[id]/page.tsx',
  ];
  for (const file of READERS) {
    it(`${file} reads lib/tournament-slot`, () => {
      assert.match(read(file), /from '(@\/lib|\.)\/tournament-slot'/, `${file} must take the slot rule from its one home`);
    });
  }

  it('New tournament no longer refuses with "Archive an existing tournament"', () => {
    assert.doesNotMatch(read('app/api/admin/setup-tournament/route.ts'), /Archive an existing tournament/);
  });

  it('the downgrade chooses among Draft and Active events only — a finished one is never archived by a plan change', () => {
    const src = read('lib/billing-retention.ts');
    const preflight = src.slice(src.indexOf('export async function buildDowngradePreflight'), src.indexOf('export async function archiveOverCapTournamentsForPlanChange'));
    assert.match(preflight, /getSlotHoldingTournaments\(org\.id\)/);
    const overCap = src.slice(src.indexOf('export async function archiveOverCapTournamentsForPlanChange'), src.indexOf('export async function buildCancellationPreflight'));
    assert.match(overCap, /getSlotHoldingTournaments\(orgId\)/);
    assert.doesNotMatch(overCap, /getNonArchivedTournaments/);
  });

  it('the status route asks the one decision, not its own count', () => {
    const src = read('app/api/admin/tournaments/route.ts');
    const setStatus = src.slice(src.indexOf("action === 'set-status'"), src.indexOf('tournaments_org_slug_live_unique'));
    assert.match(setStatus, /needsFreeSlot\(current\.status, newStatus\)/);
    assert.doesNotMatch(setStatus, /neq\('status', 'archived'\)/);
  });
});
