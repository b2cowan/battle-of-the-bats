/**
 * THE BOARD BEFORE THE EVENT (Tournament admin redesign Stage 5, Part 2 — E2, A48, A56; F80–F82, F85). What the build
 * must keep true:
 *   - the board's "ready" and Activate's server check read ONE rule — dates and a division; the contact is never
 *     missing, the owner being the last one (2026-10-19: Activate refused a draft Event settings said had a contact);
 *   - Activate asks in the record's words, naming the divisions teams can register in;
 *   - fees are never "free": none set up says payments aren't tracked here (F81, F92);
 *   - "Start from a past tournament" fills THIS draft through the reuse step: nothing it holds is replaced, the copy
 *     finishes or leaves the draft as it was, and it asks the create_tournaments capability (F33, F80);
 *   - every board has its "?", opening its own help sub-topic, and the help drawer counts days as the board does;
 *   - the draft's four orientation blocks, the persona panel and the board's old look are gone.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { activationMissing, contactSourceOf } from '../../lib/tournament-activation.ts';
import { statusConfirm, RECORD_WORDS } from '../../lib/tournament-status-words.ts';
import {
  DRAFT_BOARD_WORDS, WEEKS_BEFORE_WORDS, contactLine, divisionsLine, feeLine, feeState, publicSiteLine, timingLine,
  venuesLine, type BoardFees,
} from '../../lib/tournament-board-words.ts';
import { sameKey } from '../../lib/tournament-setup-copy.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const facts = { startDate: '2027-05-14', endDate: '2027-05-16', divisionCount: 2 };

describe('one rule for Activate (F82)', () => {
  it('needs dates and a division — in the record\'s order — and never a contact (2026-10-19)', () => {
    assert.deepEqual(activationMissing({ ...facts, startDate: null, divisionCount: 0 }), ['dates', 'division']);
    assert.deepEqual(activationMissing(facts), [], 'no contact chosen and no club email still activates');
  });
  it('says where the contact comes from: a chosen member, the event\'s own address, the club\'s, then the owner', () => {
    assert.equal(contactSourceOf({ defaultContactMemberId: 'm1', contactEmail: 'a@b.c', orgContactEmail: 'o@b.c' }), 'member');
    assert.equal(contactSourceOf({ defaultContactMemberId: null, contactEmail: 'a@b.c', orgContactEmail: 'o@b.c' }), 'tournament');
    assert.equal(contactSourceOf({ defaultContactMemberId: null, contactEmail: null, orgContactEmail: 'o@b.c' }), 'org');
    assert.equal(contactSourceOf({ defaultContactMemberId: null, contactEmail: '   ', orgContactEmail: null }), 'owner', 'a blank address is no address');
  });
  it('the board, the record and the route all read it', () => {
    const board = code('app/api/admin/tournament-dashboard/route.ts');
    assert.match(board, /ready: activationMissing\(activationFacts\)\.length === 0/);
    assert.doesNotMatch(board, /ready: hasDates && hasDivisions/, 'the old checklist rule, without the contact');
    const route = code('app/api/admin/tournaments/route.ts');
    assert.match(route, /activationMissing\(\{/);
    assert.match(route, /RECORD_WORDS\.blocked\(/, 'the refusal is the record\'s own sentence');
    assert.doesNotMatch(route, /add a public contact email/);
    assert.match(code('components/admin/tournament/TournamentRecord.tsx'), /const missing = activationMissing\(\{/);
  });
  it('the refusal says what is missing', () => {
    assert.equal(RECORD_WORDS.blocked('activate', ['dates', 'division']), 'To activate it, first add its dates and a division.');
    assert.equal(RECORD_WORDS.blocked('reopen', ['division']), 'To reopen it, first add a division.');
  });
});

describe('Activate asks in the record\'s words (E2)', () => {
  const base = { name: 'Maple Valley Spring Classic', startDate: '2027-05-14', today: '2027-03-01', finiteSlots: false };
  it('names the divisions teams can register in, with the serial comma', () => {
    const q = statusConfirm('activate', { ...base, openDivisions: ['U11', 'U13', 'U15'] });
    assert.equal(q.title, 'Activate Maple Valley Spring Classic?');
    assert.match(q.body, /goes online, and teams can register in U11, U13, and U15 until it starts on/);
    assert.doesNotMatch(q.body, /live/i, 'a site is online; "Live" is one game');
  });
  it('says so when no division is open, and keeps the record\'s sentence when the caller didn\'t read them', () => {
    assert.match(statusConfirm('activate', { ...base, openDivisions: [] }).body, /No division is open for registration yet/);
    assert.match(statusConfirm('activate', base).body, /in its open divisions until it starts on/);
  });
});

describe('the board\'s rows say what is set (E2)', () => {
  const none: BoardFees = { scope: null, mode: 'tournament', total: null, deposit: null, divisionFees: 0 };
  it('fees are never "free" (F81, F92)', () => {
    assert.equal(feeLine(none), 'Not set up — payments aren’t tracked here');
    assert.equal(feeState(none), 'notSet');
    assert.equal(feeLine({ ...none, scope: 'free' }), 'Not tracked here', 'the stored `free` reads as not tracked');
    assert.equal(feeLine({ ...none, scope: 'tournament', total: 450, deposit: 100 }), '$450 per team · a $100 deposit');
    assert.equal(feeLine({ ...none, scope: 'tournament', total: 450 }), '$450 per team');
    assert.equal(feeLine({ ...none, scope: 'per_division', mode: 'division', divisionFees: 2 }), 'Set for each division');
    for (const f of [none, { ...none, scope: 'free' }]) assert.doesNotMatch(feeLine(f), /free/i);
  });
  it('the weeks-before Payments card says nothing is due until a team is accepted', () => {
    assert.equal(WEEKS_BEFORE_WORDS.nothingDue(feeLine({ ...none, scope: 'tournament', total: 450 })), '$450 per team · nothing due until a team is accepted');
  });
  it('divisions, venues, timing, the public site and the contact', () => {
    assert.equal(divisionsLine([{ name: 'U11', capacity: 8 }, { name: 'U13', capacity: 8 }, { name: 'U15', capacity: 8 }]), 'U11 · U13 · U15 — 24 spots');
    assert.equal(divisionsLine([]), 'None yet');
    assert.match(divisionsLine(['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({ name, capacity: null }))), /^A · B · C · D and 2 more$/);
    assert.equal(venuesLine({ names: ['Lions Park'], lanes: 3 }, 'softball'), 'Lions Park · 3 diamonds');
    assert.equal(venuesLine({ names: ['Lions Park', 'Kinsmen'], lanes: 5 }, 'baseball'), '2 venues · 5 diamonds');
    assert.equal(venuesLine({ names: [], lanes: 0 }, 'softball'), 'None yet');
    assert.equal(timingLine({ minutes: 90, perDivision: false, breakers: ['h2h', 'rd', 'rf'], breakersPerDivision: false }, 'softball'),
      '90-minute games · head-to-head, then run difference');
    assert.equal(publicSiteLine(['Schedule', 'Standings', 'Teams', 'Rules'], false, 6), 'Schedule, Standings, Teams, and Rules on · no logo');
    assert.equal(contactLine({ source: 'owner', email: 'sam@club.ca' }), 'Your organization’s owner, sam@club.ca');
    assert.equal(contactLine({ source: 'owner', email: null }), 'Your organization’s owner');
    assert.equal(contactLine({ source: 'org', email: 'info@club.ca' }), 'Your organization’s email, info@club.ca');
    assert.equal(contactLine({ source: 'tournament', email: 'td@club.ca' }), 'td@club.ca');
  });
  it('the progress line says how far along once', () => {
    assert.equal(DRAFT_BOARD_WORDS.progress(2, 3), '2 of 3 done · it stays private until then');
    assert.equal(DRAFT_BOARD_WORDS.progress(3, 3), '3 of 3 done');
  });
});

describe('"Start from a past tournament" fills this draft (F33, F80)', () => {
  const db = code('lib/db.ts');
  const populate = db.slice(db.indexOf('export async function populateTournamentFrom'));
  it('nothing is replaced unasked: it deletes none of the draft\'s rows, and copies with keep', () => {
    assert.doesNotMatch(populate.slice(0, populate.indexOf('\n}\n')), /\.delete\(\)/, 'the old wipe deleted venues, rules, questions and the welcome first');
    assert.match(populate, /keep: true/);
    assert.match(populate, /copySetupRows\(/);
  });
  it('one step that finishes or leaves the draft as it was', () => {
    assert.match(populate, /takeBackSetupRows\(destinationTournamentId, ledger\)/);
    assert.match(populate, /throw new PopulateFailed\(tookBack, error\)/);
    const copy = code('lib/tournament-setup-copy.ts');
    for (const table of ['diamonds', 'divisions', 'rules', 'resources', 'announcements', 'tournament_registration_fields']) {
      assert.match(copy, new RegExp(`table: '${table}'`), `${table} rows go on the ledger`);
    }
  });
  it('each parent is written one row at a time — never paired by a bulk insert\'s row order', () => {
    const copy = code('lib/tournament-setup-copy.ts');
    assert.match(copy, /insertOne\('divisions'/);
    assert.match(copy, /insertOne\('pools'/);
    assert.match(copy, /insertOne\('rules'/);
    assert.doesNotMatch(copy, /inserted\w*\?\.\[(?:index|i)\]/);
  });
  it('the route asks the capability, scopes the source too, and takes the five areas', () => {
    const route = code('app/api/admin/tournaments/[tournamentId]/populate-from/route.ts');
    assert.match(route, /'create_tournaments'/);
    assert.match(route, /scopeGuard\(ctx, sourceTournamentId\)/);
    assert.match(route, /populateTournamentFrom\(destinationTournamentId, sourceTournamentId, ctx\.org\.id, areas\)/);
    assert.doesNotMatch(route, /error instanceof Error \? error\.message/, 'never the database\'s words');
  });
  it('the clone and "into this draft" share one copier', () => {
    const clone = db.slice(db.indexOf('export async function cloneTournament'), db.indexOf('export async function populateTournamentFrom'));
    assert.match(clone, /copySetupRows\(\{/);
    assert.match(code('lib/tournament-setup-copy.ts'), /copyTournamentVenues\(sourceId, targetId/);
  });
  it('the /review\'s fixes hold: a refusal before any write says the draft is as it was; a division\'s fee is the draft\'s fee; a scope keeps its division; a resource is its link', () => {
    assert.match(populate, /throw new PopulateFailed\(true, new Error\('Can only populate a draft tournament\.'\)\)/);
    assert.match(code('app/api/admin/tournaments/[tournamentId]/populate-from/route.ts'), /error instanceof PopulateFailed \? error\.tookBack : true/);
    assert.match(populate, /\(draftDivisionFees \?\? 0\) > 0/);
    const copy = code('lib/tournament-setup-copy.ts');
    assert.match(copy, /\(include\.rulesResources \|\| include\.welcome\) && divisionIdMap\.size === 0/);
    assert.match(copy, /const resourceKey = /);
    assert.doesNotMatch(copy, /heldResources\.has\(sameKey\(r\.label\)\)/, 'a same-named resource pointing elsewhere still comes in');
  });
  it('a name is the same name whatever its case and spaces', () => {
    assert.equal(sameKey('  U11   Girls '), sameKey('u11 girls'));
  });
  it('the wizard has the mode, and the board opens it', () => {
    const wizard = code('components/admin/TournamentSetupWizard.tsx');
    assert.match(wizard, /preStep === 'into' && into/);
    assert.match(wizard, /\/populate-from\$\{orgQuery\}/);
    assert.match(code('app/[orgSlug]/admin/tournaments/dashboard/page.tsx'), /openInto\(/);
  });
});

describe('the boards (E2, A56)', () => {
  const page = code('app/[orgSlug]/admin/tournaments/dashboard/page.tsx');
  it('every board has its "?", each opening a help sub-topic that exists', () => {
    const help = read('lib/help-content/tournaments.tsx');
    for (const id of ['launch-draft-board', 'launch-weeks-before', 'results-game-day-board', 'closeout-finished-board']) {
      assert.match(page, new RegExp(`subtopicId: '${id}'`));
      assert.match(help, new RegExp(`id: '${id}'`), `the help content has ${id}`);
    }
  });
  it('the draft\'s four orientation blocks and the persona panel are gone', () => {
    assert.equal(existsSync(new URL('../../components/admin/tournament/PersonaPanel.tsx', import.meta.url)), false);
    assert.doesNotMatch(page, /PersonaPanel|reuseSetupPrompt|Draft Launch Checklist|populateOpen/);
  });
  it('the board\'s old look is retired', () => {
    assert.doesNotMatch(page, /useKitStyle|kx\(/);
    assert.doesNotMatch(read('app/[orgSlug]/admin/tournaments/dashboard/dashboard.module.css'), /data-admin-kit/);
    assert.doesNotMatch(read('components/admin/tournament/GuidanceRail.module.css'), /data-admin-kit/);
    assert.doesNotMatch(code('components/admin/LiveEventLog.tsx'), /useKitStyle/);
  });
  it('the weeks-before board keeps the demo tour\'s schedule-health anchor and says Payments truly', () => {
    const weeks = code('app/[orgSlug]/admin/tournaments/dashboard/WeeksBeforeBoard.tsx');
    assert.match(weeks, /data-sandbox-tour="schedule-health"/);
    assert.match(weeks, /settings\/event\?section=fees/, 'Payments opens Fees & Payments (F55), never the Tournaments list');
    assert.doesNotMatch(weeks, /No fee schedule configured/);
  });
  it('the help drawer counts days in the org\'s own day, as the board does', () => {
    const guidance = code('lib/tournament-guidance.ts');
    assert.match(guidance, /daysBetweenDateStrings\(tournamentToday\(\), startDate\)/);
    assert.doesNotMatch(guidance, /Date\.now\(\)\) \/ 86_400_000/);
    assert.match(page, /daysUntilStart\(currentTournament\?\.startDate\)/);
  });
});
