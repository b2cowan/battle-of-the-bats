/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 5a — THE FAMILY RECORD MADE TRUE, HELD (owner ratification 2026-10-17; hub
 * K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5). The source-level halves of the gates; the database halves are
 * `npm run check:families-record` (E01, E02, the cap, a merge carrying the message dates — with `--old` failing on
 * the code it replaced) and `scripts/check-family-message-race.mjs` (two presses at two-of-three).
 *
 *   E04 — the family file holds every section its statement lists (ONE list), and nothing it says it doesn't;
 *   E05 — every Families read is paged (no unbounded select);
 *   E07 — the attach runs once per visit; the cap's number is one number on screen and in the database; every
 *         export, message and merge reaches the club's audit log;
 *   (Ask 12 — a member limited to a group of teams — is held in families-access-guard.test.ts.)
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { FAMILY_FILE_SECTIONS, FAMILY_FILE_EXCLUDES, familyFileLines, familyFileStatement, type FamilyFile } from '../../lib/family-file.ts';
import { FAMILY_MESSAGE_CAP, FAMILY_FILE_WORDS } from '../../lib/families-words.ts';

const sample = (): FamilyFile => ({
  organization: 'QA Families Fixture', exportedAt: '2026-10-16T18:14:00Z', exportedBy: 'Fixture Owner', family: 'Alex Reyes',
  ...familyFileStatement(),
  sections: {
    contact: { name: 'Alex Reyes', phone: '555-0100', addresses: [{ email: 'alex.reyes@example.com', current: true, firstSeen: '2026-05-02T00:00:00Z', lastSeen: '2026-10-01T00:00:00Z' }], clubEmail: 'on', optOuts: [], otherGuardians: [] },
    children: [{ name: 'Riley Reyes', birthDate: '2014-03-03', registrations: [{ kind: 'rep', where: 'Fixture Falcons U13', season: '2026 Season', status: 'active', since: null, medicalNotes: 'Asthma', emergencyContact: 'Sam Reyes · 555-0101', notes: [] }] }],
    tryouts: [],
    money: { dues: [{ child: 'Riley Reyes', season: '2026 Season', where: 'Fixture Falcons U13', dues: 450, fundraising: 0, otherCredits: 0, paid: 350, handedBack: 0, balance: 100 }], payments: [], credits: [], reminders: [], leagueFees: [],
      handoffs: [{ child: 'Riley Reyes', sentAt: '2026-10-19T14:00:00Z', amount: 100, receivedDate: '2026-10-18', method: 'cheque', to: ['Pat Moreau'], by: 'Fixture Owner', outcome: 'waiting', answeredBy: null, answeredAt: null }] },
    forms: { documents: [], waivers: [], consents: [] },
    messages: [{ at: '2026-10-14T15:00:00Z', by: 'Fixture Owner' }],
    notes: [{ at: '2026-10-18T15:00:00Z', by: 'Fixture Owner', editedAt: null, text: 'Paying the last installment in two parts.' }],
    merges: [],
  },
});

describe('E04 — the family file says what it holds, from ONE list, and holds it', () => {
  it('the statement IS the section list (same titles, same order)', () => {
    const { holds } = familyFileStatement();
    assert.deepEqual(holds.map(h => h.title), FAMILY_FILE_SECTIONS.map(s => s.title));
  });

  it('the assembler fills every section the statement lists — and no other', () => {
    const src = readCode('lib/families-export.ts');
    const block = src.slice(src.indexOf('sections: {'));
    for (const s of FAMILY_FILE_SECTIONS) assert.match(block, new RegExp(`\\b${s.id}:`), `the file says it holds "${s.title}" but the assembler does not fill it`);
    assert.equal(Object.keys(sample().sections).sort().join(','), FAMILY_FILE_SECTIONS.map(s => s.id).sort().join(','));
  });

  it('every section draws, and a section with nothing on file says so (never a bare heading)', () => {
    const lines = familyFileLines(sample());
    assert.deepEqual(lines.map(l => l.id), FAMILY_FILE_SECTIONS.map(s => s.id));
    for (const l of lines) assert.ok(l.lines.length > 0, `${l.title} drew no line`);
    assert.deepEqual(lines.find(l => l.id === 'tryouts')!.lines, [{ text: FAMILY_FILE_WORDS.none, depth: 0 }]);
    assert.ok(lines.find(l => l.id === 'money')!.lines[0].text.includes('Balance $100.00'));
  });

  it('it says what it does NOT hold, and never reads the coaching records it names', () => {
    const not = familyFileStatement().notInThisFile;
    for (const x of FAMILY_FILE_EXCLUDES) assert.ok(not.includes(x), `"Not in this file" no longer names ${x}`);
    const src = readCode('lib/families-export.ts');
    for (const table of ['rep_player_evaluations', 'rep_development', 'rep_attendance', 'rep_event_attendance', 'rep_player_stats', 'rep_game_stats', 'rep_lineups', 'player_observations', 'rep_player_goals']) {
      assert.doesNotMatch(src, new RegExp(`from\\('${table}`), `the family file reads ${table} — a coaching record it says stays with the team`);
    }
  });

  it('(Stage 5c, Ask 29) the coach’s pinned note about a player leaves the file, and the statement says so', () => {
    const src = readCode('lib/families-export.ts');
    const rosterRead = /from\('rep_roster_players'\)\s*\.select\('([^']*)'\)/.exec(src)?.[1] ?? '';
    assert.ok(rosterRead, 'the export’s roster read moved — re-point this test');
    assert.doesNotMatch(rosterRead, /(^|,\s*)notes(\s*,|$)/, 'the family file selects rep_roster_players.notes — the coach’s private pinned note (S5C-03)');
    assert.doesNotMatch(src, /note\('Notes', d\.notes\)/);
    assert.ok(FAMILY_FILE_EXCLUDES.some(x => x.includes('pinned note')), 'the excludes list names the coach’s pinned note');
    assert.ok(familyFileStatement().notInThisFile.includes('a coach’s pinned note about a player'));
  });

  it('(Stage 5c, Ask 29) the file holds the family’s notes, before Records joined, and the statement names them', () => {
    const ids = FAMILY_FILE_SECTIONS.map(s => s.id) as string[];
    assert.ok(ids.includes('notes'), 'no notes section');
    assert.equal(ids.indexOf('notes'), ids.indexOf('merges') - 1, 'Notes about the family sits just before Records joined');
    assert.ok(familyFileStatement().holds.some(h => h.title === 'Notes about the family' && /who wrote each and when/.test(h.holds)));
    assert.match(readCode('lib/families-export.ts'), /from\('family_notes'\)/);
    const lines = familyFileLines(sample());
    assert.deepEqual(lines.find(l => l.id === 'notes')!.lines.map(l => l.text), ['Oct 18, 2026 · Fixture Owner', 'Paying the last installment in two parts.']);
    assert.ok(lines.find(l => l.id === 'money')!.lines.some(l => /^Sent to Pat Moreau Oct 19, 2026 · Riley Reyes · \$100\.00 · Cheque · received Oct 18, 2026 by Fixture Owner/.test(l.text) && /waiting for the coach$/.test(l.text)));
    assert.ok(FAMILY_FILE_SECTIONS.find(s => s.id === 'money')!.holds.includes('a payment the club sent to a coach'));
    assert.ok(FAMILY_FILE_SECTIONS.find(s => s.id === 'children')!.holds.includes('any staff note on the registration'));
  });

  it('the export reaches the audit log with its format, never its contents', () => {
    const src = readCode('app/api/admin/families/[personId]/export/route.ts');
    assert.match(src, /writeOrgAudit\(ctx\.org\.id, ctx\.user\.id, null, 'family_exported', \{ personId, format \}\)/);
  });
});

describe('E07 — the message door, the attach, the audit log', () => {
  it('the cap is ONE number: on screen and in family_message_claim', () => {
    const mig = readFileSync('supabase/migrations/334_a_family_message_keeps_its_date_and_sender.sql', 'utf8');
    const v = Number(mig.match(/v_cap\s+constant integer := (\d+);/)?.[1]);
    assert.equal(v, FAMILY_MESSAGE_CAP);
    assert.equal(FAMILY_MESSAGE_CAP, 3, 'Ask 9 ruled three a day for one family');
  });

  it('the attach runs at the visit’s entry (the worklist) and before an ACTION (a send, an export) — never on a plain read', () => {
    const src = readCode('lib/families-read.ts');
    assert.equal((src.match(/attach: true/g) ?? []).length, 1, 'a Families READ other than the worklist runs the attach');
    assert.match(src, /buildWorklist[\s\S]{0,200}loadOrgFamilyWorld\(orgId, \{ attach: true \}\)/);
    assert.match(readCode('lib/families-export.ts'), /loadOrgFamilyWorld\(orgId, \{ attach: true \}\)/, 'the export no longer attaches first');
    assert.match(readCode('app/api/admin/families/[personId]/message/route.ts'), /loadHouseholdReach\(ctx\.org\.id, personId, \{ attach: true \}\)/, 'the send no longer attaches first');
    assert.doesNotMatch(readCode('app/api/admin/families/[personId]/message/route.ts').split('export const POST')[0], /attach: true/, 'the window\'s read attaches');
  });

  it('a failed attach never fails a read (logged, not thrown)', () => {
    const src = readCode('lib/org-people.ts');
    const fn = src.slice(src.indexOf('export async function attachPeopleForOrg'), src.indexOf('export async function recordLeagueWaiverConsent'));
    assert.doesNotMatch(fn, /throw /);
  });

  it('a merge and a "not the same" reach the audit log', () => {
    const src = readCode('app/api/admin/families/duplicates/route.ts');
    assert.match(src, /'families_merged'/);
    assert.match(src, /'families_not_same'/);
  });
});

describe('E05 — every Families read is paged', () => {
  for (const file of ['lib/families-read.ts', 'lib/families-export.ts']) {
    it(`${file}: every select runs through the shared pager`, () => {
      const src = readCode(file);
      // Each `.select(` sits inside a fetchAll / fetchAllIn / orgRows builder that ends `.range(from, to)`.
      const selects = (src.match(/\.select\(/g) ?? []).length;
      const ranged = (src.match(/\.range\(from, to\)/g) ?? []).length;
      // A read bounded by construction (one row; the message log's last day at a fixed limit) needs no pager.
      const singles = (src.match(/\.maybeSingle\(\)|\.limit\(FAMILY_MESSAGE_CAP \* 4\)|\.in\('id', \[personId1, personId2\]\)/g) ?? []).length;
      assert.ok(ranged + singles >= selects, `${file}: ${selects} selects but ${ranged} paged — an unpaged read stops at 1,000 rows without an error`);
    });
  }
});
