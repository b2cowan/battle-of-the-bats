import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { documentsTickLine, summariseTicks } from '../../lib/club-form-tick-summary.ts';
import { CHILD_PAGE_WORDS as W, documentCopies } from '../../lib/child-page-words.ts';
import { familyFileLines, familyFileStatement, type FamilyFile } from '../../lib/family-file.ts';

/**
 * BOARD READY STAGE 4 — the staff readers read a sign-up's document TICKS, not `waiver_accepted_at` (which is set only when a
 * document asked "I have read and agree"). The date is the earliest tick; "agreed to" only when a tick said so, else "ticked".
 */
const AGREE = 'I have read and agree to the waiver.';
const READ = 'I have read the code of conduct.';

describe('summariseTicks', () => {
  it('no tick, no summary: not recorded, never "not accepted"', () => {
    assert.equal(summariseTicks([]).size, 0);
    assert.equal(summariseTicks([{ subject_id: 'r1', sentence: AGREE, ticked_at: null }]).has('r1'), false);
  });

  it('the date is the EARLIEST tick of that registration, whatever order the rows come in', () => {
    const m = summariseTicks([
      { subject_id: 'r1', sentence: READ, ticked_at: '2026-06-03T12:00:00Z' },
      { subject_id: 'r1', sentence: READ, ticked_at: '2026-06-01T12:00:00Z' },
      { subject_id: 'r2', sentence: READ, ticked_at: '2026-05-01T12:00:00Z' },
    ]);
    assert.equal(m.get('r1')!.at, '2026-06-01T12:00:00Z');
    assert.equal(m.get('r2')!.at, '2026-05-01T12:00:00Z');
  });

  it('"agreed" when ANY tick begins "I have read and agree"; only-"I have read" ticks are not agreement', () => {
    assert.equal(summariseTicks([{ subject_id: 'a', sentence: READ, ticked_at: '2026-06-01T00:00:00Z' }]).get('a')!.agreed, false);
    assert.equal(summariseTicks([{ subject_id: 'a', sentence: AGREE, ticked_at: '2026-06-01T00:00:00Z' }]).get('a')!.agreed, true);
    const both = summariseTicks([
      { subject_id: 'a', sentence: READ, ticked_at: '2026-06-01T00:00:00Z' },
      { subject_id: 'a', sentence: AGREE, ticked_at: '2026-06-02T00:00:00Z' },
    ]);
    assert.equal(both.get('a')!.agreed, true);
    assert.equal(both.get('a')!.at, '2026-06-01T00:00:00Z');
  });
});

describe('the words of the three staff readers', () => {
  it('the Children queue: "Agreed to documents on {date}" / "Documents ticked on {date}"', () => {
    assert.equal(documentsTickLine(true, 'May 2, 2025'), 'Agreed to documents on May 2, 2025');
    assert.equal(documentsTickLine(false, 'May 2, 2025'), 'Documents ticked on May 2, 2025');
  });

  it('the child page line: "agreed to" by default, "ticked" when only "I have read …"', () => {
    assert.equal(W.leagueOnlyWaiver('Summer 2029'), 'Summer 2029 documents agreed to at sign-up.');
    assert.equal(W.leagueOnlyWaiver('Summer 2029', true), 'Summer 2029 documents agreed to at sign-up.');
    assert.equal(W.leagueOnlyWaiver('Summer 2029', false), 'Summer 2029 documents ticked at sign-up.');
    // The flag travels with the copy the line reads.
    const copies = documentCopies([], [
      { seasonName: 'Summer 2029', acceptedAt: '2029-06-01T00:00:00Z', agreed: false },
      { seasonName: 'Summer 2028', acceptedAt: '2028-06-01T00:00:00Z' },
    ]);
    assert.deepEqual(copies.map(c => c.agreed), [false, true]);
  });

  it('the Families export line: "Documents agreed to · …" / "Documents ticked · …"', () => {
    const file = (agreed?: boolean): FamilyFile => ({
      organization: 'Fixture', exportedAt: '2026-10-16T18:14:00Z', exportedBy: 'Owner', family: 'Alex Reyes', ...familyFileStatement(),
      sections: {
        contact: { name: 'Alex Reyes', phone: null, addresses: [], clubEmail: 'on', optOuts: [], otherGuardians: [] },
        children: [], tryouts: [],
        money: { dues: [], payments: [], credits: [], reminders: [], leagueFees: [], handoffs: [] },
        forms: { documents: [], waivers: [{ child: 'Riley Reyes', season: 'Summer 2029', acceptedAt: '2029-06-01T16:00:00Z', agreed }], consents: [] },
        messages: [], notes: [], merges: [],
      },
    });
    const line = (a?: boolean) => familyFileLines(file(a)).find(s => s.id === 'forms')!.lines.map(l => l.text).find(t => /^Documents /.test(t))!;
    assert.match(line(true), /^Documents agreed to · Riley Reyes · Summer 2029 · /);
    assert.match(line(undefined), /^Documents agreed to · /);
    assert.match(line(false), /^Documents ticked · Riley Reyes · Summer 2029 · /);
  });
});

describe('the readers read ticks, in bulk (source guards)', () => {
  it('none of the three selects waiver_accepted_at any more; each reads the tick summaries', () => {
    for (const p of ['lib/child-page.ts', 'lib/children-duplicates-read.ts', 'lib/families-export.ts']) {
      const s = readCode(p);
      assert.doesNotMatch(s, /waiver_accepted_at/, `${p} still reads the old waiver date`);
      assert.match(s, /readTickSummaries\(/, `${p} reads the ticks`);
    }
  });

  it('the tick read is org-scoped, paged and chunked', () => {
    const s = readCode('lib/club-form-tick-summary-read.ts');
    assert.match(s, /fetchAllIn/);
    assert.match(s, /\.eq\('org_id', orgId\)/);
    assert.match(s, /\.eq\('subject_table', 'league_registrations'\)/);
  });

  it('the child page keeps the house-league line apart from the team\'s Waiver row', () => {
    const s = readCode('lib/child-page.ts');
    assert.doesNotMatch(s, /waiversPlaced/);
    assert.match(s, /leagueOnlyWaivers: leagueWaivers/);
    assert.doesNotMatch(s, /documentRows\(\{[^}]*leagueWaivers/);
    assert.doesNotMatch(s, /historyOnlyRows\([^)]*leagueWaivers/);
  });
});
