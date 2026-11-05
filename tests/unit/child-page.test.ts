import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  currentChip, documentRows, documentsSentence, historyOnlyRows, householdChildSub, leagueFeesLine, leagueSeasonStatus,
  repFeesLine, repSeasonStatus, seasonRowPhoneLine, seasonRowPhoneTitle, sortSeasonRows, withTeamLine, yearsLine,
  type ChildSeasonRow,
} from '../../lib/child-page-words';
import { documentStateRows, type SeasonDocument } from '../../lib/document-state';

/**
 * CLUB TIER STAGE 14 S5 — one page per child (owner 2026-11-05, "agree as recommended" on the S5 Part 0 calls A–H).
 * The rules that must hold however the screens change:
 *   · the club's child page lists every season, rep and house league together, newest first, each with its own fees;
 *   · papers are per TEAM, the coach's rule (never pooled — call D); a house-league waiver joins the Waiver history;
 *   · the coach's "With the {team} {years}" is THIS team's seasons only, and only for a returning child (call E);
 *   · the household's line says "3 seasons · 2 documents to sign" only when each half says something;
 *   · the page sits behind the Families gate; the club's Confirm clears the child's question on every live entry (call C);
 *   · no "Split records" before S6 (call B) and no add-player door (Ask 8).
 */
const src = (p: string) => readFileSync(p, 'utf8');

const row = (o: Partial<ChildSeasonRow>): ChildSeasonRow => ({
  key: 'k', kind: 'rep', seasonName: '2027 Season', year: 2027, where: 'Lynx 12U AAA', number: '7', status: 'active',
  fees: 'Paid in full', live: true, ...o,
});

describe('the seasons table', () => {
  it('a closed rep season is Finished; a live one says the entry\'s standing', () => {
    assert.equal(repSeasonStatus('active', false), 'finished');
    assert.equal(repSeasonStatus('inactive', false), 'finished');
    assert.equal(repSeasonStatus('active', true), 'active');
    assert.equal(repSeasonStatus('inactive', true), 'inactive');
  });

  it('a house-league sign-up says what it is; a finished season is Finished unless withdrawn', () => {
    assert.equal(leagueSeasonStatus('active', true), 'finished');
    assert.equal(leagueSeasonStatus('active', false), 'active');
    assert.equal(leagueSeasonStatus('pending_review', false), 'in_review');
    assert.equal(leagueSeasonStatus('waitlisted', false), 'waitlisted');
    assert.equal(leagueSeasonStatus('withdrawn', true), 'withdrawn');
  });

  it('fees read as drawn: "$1,450.00 · $725.00 paid", "Paid in full", "No dues"', () => {
    assert.equal(repFeesLine({ duesCents: 145000, paidCents: 72500, balanceCents: 72500 }), '$1,450.00 · $725.00 paid');
    assert.equal(repFeesLine({ duesCents: 145000, paidCents: 145000, balanceCents: 0 }), 'Paid in full');
    // A credit held for the family is still paid in full.
    assert.equal(repFeesLine({ duesCents: 145000, paidCents: 150000, balanceCents: -5000 }), 'Paid in full');
    assert.equal(repFeesLine(null), 'No dues');
    assert.equal(repFeesLine({ duesCents: 0, paidCents: 0, balanceCents: 0 }), 'No dues');
  });

  it('a house-league fee: none set, not owed yet, paid in full, part paid', () => {
    assert.equal(leagueFeesLine({ feeCents: null, paidCents: 0, balanceCents: 0 }, 'active'), 'No fee');
    assert.equal(leagueFeesLine({ feeCents: 15000, paidCents: 0, balanceCents: 0 }, 'waitlisted'), 'Not owed yet');
    assert.equal(leagueFeesLine({ feeCents: 15000, paidCents: 15000, balanceCents: 0 }, 'finished'), 'Paid in full');
    assert.equal(leagueFeesLine({ feeCents: 15000, paidCents: 5000, balanceCents: 10000 }, 'active'), '$150.00 · $50.00 paid');
    // The book owes nothing on a sign-up that is not active: say what was received, never a figure that reads as owing.
    assert.equal(leagueFeesLine({ feeCents: 15000, paidCents: 10000, balanceCents: 0 }, 'withdrawn'), '$100.00 paid');
    assert.equal(leagueFeesLine({ feeCents: 16500, paidCents: 0, balanceCents: 0 }, 'finished'), 'Nothing owed');
    assert.equal(leagueFeesLine({ feeCents: 0, paidCents: 0, balanceCents: 0 }, 'active'), 'No fee');
  });

  it('newest first; within a year the live season first, then rep before house league', () => {
    const rows = sortSeasonRows([
      row({ key: 'hl25', kind: 'league', seasonName: 'Summer 2025', year: 2025, live: false }),
      row({ key: 'r26', seasonName: '2026 Season', year: 2026, live: false, status: 'finished' }),
      row({ key: 'r27', year: 2027 }),
      row({ key: 'hl27', kind: 'league', seasonName: 'Summer 2027', year: 2027 }),
    ]);
    assert.deepEqual(rows.map(r => r.key), ['r27', 'hl27', 'r26', 'hl25']);
  });

  it('the title chip names where the child plays now, or nothing', () => {
    assert.equal(currentChip([row({}), row({ key: 'old', year: 2026, live: false, status: 'finished' })]), 'Lynx 12U AAA · 2027');
    assert.equal(currentChip([row({ kind: 'league', seasonName: 'Summer 2027', where: 'U8' })]), 'House league · Summer 2027');
    assert.equal(currentChip([row({ live: false, status: 'finished' })]), null);
  });

  it('the phone rows: "2027 Season · Lynx 12U AAA" over "#7 · Paid in full"', () => {
    assert.equal(seasonRowPhoneTitle(row({})), '2027 Season · Lynx 12U AAA');
    assert.equal(seasonRowPhoneLine(row({})), '#7 · Paid in full');
    const hl = row({ kind: 'league', seasonName: 'Summer 2025', where: 'U10 Rookie · Blue Jays', number: null });
    assert.equal(seasonRowPhoneTitle(hl), 'Summer 2025 · House league');
    assert.equal(seasonRowPhoneLine(hl), 'U10 Rookie · Blue Jays · Paid in full');
  });
});

describe('"With the {team} {years}" (the coach\'s page — own team only)', () => {
  it('only for a returning child', () => {
    assert.equal(withTeamLine('Lynx', [2027]), null);
    assert.equal(withTeamLine('Lynx', [2027, 2027]), null);
    assert.equal(withTeamLine('Lynx', [2027, 2026]), 'With the Lynx 2026 · 2027');
    assert.equal(withTeamLine('The Hawks', [2026, 2027]), 'With the Hawks 2026 · 2027');
  });
  it('three years in a row read as a run', () => {
    assert.equal(yearsLine([2022, 2023, 2024, 2025, 2027]), '2022–2025 · 2027');
    assert.equal(yearsLine([2024, 2026]), '2024 · 2026');
  });
});

describe('the household\'s line per child', () => {
  it('each half only when it says something', () => {
    assert.equal(householdChildSub(3, 2), '3 seasons · 2 documents to sign');
    assert.equal(householdChildSub(1, 1), '1 document to sign');
    assert.equal(householdChildSub(2, 0), '2 seasons');
    assert.equal(householdChildSub(1, 0), null);
  });
});

describe('documents, per team', () => {
  const doc = (o: Partial<SeasonDocument>): SeasonDocument => ({
    id: 'd', documentType: 'waiver', createdAt: '2026-04-12T15:00:00Z', seasonId: 's26', seasonName: '2026 Season', seasonYear: 2026, ...o,
  });
  const templates = [
    { id: 't1', name: 'Waiver', document_type: 'waiver', validity: 'signed_each_season' },
    { id: 't2', name: 'Code', document_type: 'code_of_conduct', validity: 'signed_each_season' },
    { id: 't3', name: 'Medical', document_type: 'medical_consent', validity: 'good_until_replaced' },
  ];
  const documents = [
    doc({ id: 'w', documentType: 'waiver' }),
    doc({ id: 'c', documentType: 'code_of_conduct' }),
    doc({ id: 'm', documentType: 'medical_consent' }),
  ];
  const state = documentStateRows({ templates, documents, season: { id: 's27', name: '2027 Season' } });

  it('the drawn rows: waiver and code need signing with their history; medical consent on file by its date', () => {
    const rows = documentRows({ state, documents, workingSeasonId: 's27', leagueWaivers: ['Summer 2025'] });
    assert.deepEqual(rows.map(r => [r.label, r.chip, r.history]), [
      ['Waiver', 'Needs signing', '2026 Season · Summer 2025 waiver'],
      ['Code of conduct', 'Needs signing', '2026 Season'],
      ['Medical consent', 'On file', 'Apr 12, 2026'],
    ]);
    assert.equal(rows[0].validity, 'Signed each season');
    assert.equal(rows[2].validity, 'Good until replaced');
  });

  it('the phone\'s sentence', () => {
    const rows = documentRows({ state, documents, workingSeasonId: 's27' });
    assert.equal(documentsSentence(rows, 2027), 'Waiver and code of conduct need signing for 2027. Medical consent on file.');
    assert.equal(documentsSentence([], 2027), 'No documents on file.');
  });

  it('a team with no working season shows what was signed, by season, with no state', () => {
    const rows = historyOnlyRows([doc({ documentType: 'waiver' }), doc({ documentType: 'waiver', seasonId: 's25', seasonName: '2025 Season', seasonYear: 2025 })]);
    assert.deepEqual(rows.map(r => [r.label, r.chip, r.history]), [['Waiver', null, '2026 Season · 2025 Season']]);
  });
});

describe('the page and its doors (source guards)', () => {
  it('both child routes sit behind the Families gate and scope to the org', () => {
    for (const p of ['app/api/admin/families/children/[childId]/route.ts', 'app/api/admin/families/children/[childId]/health/route.ts']) {
      const s = src(p);
      assert.match(s, /requireFamiliesAccess\(req\)/, `${p} asks the Families gate`);
      assert.match(s, /gate\.ctx\.org\.id/, `${p} reads within the member's org`);
      assert.match(s, /isUuid\(childId\)/, `${p} refuses a malformed id as not found`);
    }
    const read = src('lib/child-page.ts');
    for (const table of ['org_children', 'rep_roster_players', 'league_registrations', 'org_people']) {
      assert.match(read, new RegExp(`from\\('${table}'\\)[\\s\\S]{0,200}\\.eq\\('org_id', orgId\\)`), `${table} is read within the org`);
    }
    // Call-ups are their own child — never on this page; a declined sign-up is not a season.
    assert.match(read, /\.neq\('status', 'callup'\)/);
    assert.match(read, /\.neq\('status', 'declined'\)/);
  });

  it('the club\'s Confirm stamps only LIVE, not-yet-stamped entries of this child, and changes no value', () => {
    const read = src('lib/child-page.ts');
    const confirm = read.slice(read.indexOf('export async function confirmChildHealth'));
    assert.match(confirm, /liveRepEntries\(rep\)\.filter\(r => !r\.health_confirmed_at\)/);
    assert.match(confirm, /\.update\(\{ health_confirmed_at: [^}]*health_confirmed_by: userId \}\)/);
    assert.doesNotMatch(confirm, /medical_notes|emergency_contact/, 'Confirm writes no health value');
    assert.match(confirm, /\.eq\('child_id', childId\)/);
  });

  it('documents are read per team with the coach\'s rule, never pooled', () => {
    const read = src('lib/child-page.ts');
    assert.match(read, /readChildTeamDocuments\(asEntry\(r\)\)/);
    assert.match(read, /templatesForTeam\(templateRows, r\.team_id\)/);
  });

  it('no "Split records" before S6 and no add-player door (Ask 8)', () => {
    const page = src('components/admin/kit/club/families/ChildPage.tsx');
    assert.doesNotMatch(page, /['">]Split records/, 'no Split records button or words on screen');
    assert.doesNotMatch(page, /Add player|method: 'POST'[\s\S]{0,80}roster/);
  });

  it('the frame draws no tab row over a child page, and does not overwrite its title', () => {
    const frame = src('components/admin/kit/club/families/FamiliesFrame.tsx');
    assert.match(frame, /if \(childPage\) return <>\{children\}<\/>;/);
    assert.match(frame, /usePageTitle\(childPage \? null :/);
  });

  it('the doors: the household line, a rep roster name (live and past) for Families access only, the no-family rows', () => {
    const win = src('components/admin/kit/club/families/FamilyRecordWindow.tsx');
    assert.match(win, /familiesChildHref\([^)]*person\.id\)/, 'the household line opens the child, back to this family');
    for (const p of ['app/[orgSlug]/admin/rep-teams/teams/[teamId]/roster/page.tsx', 'app/[orgSlug]/admin/rep-teams/teams/[teamId]/history/[yearId]/page.tsx']) {
      const s = src(p);
      assert.match(s, /canOpen\('module_families'\)/, `${p} links only for Families access`);
      assert.match(s, /childDoor && p\.childId && p\.status !== 'callup'/, `${p} never links a call-up`);
    }
    const fr = src('lib/families-read.ts');
    assert.match(fr, /href: r\.child_id \? familiesChildHref\(`\/\$\{orgSlug\}\/admin`, r\.child_id\) : null/);
  });

  it('the coach\'s line reads THIS team\'s seasons only', () => {
    const cd = src('lib/child-documents.ts');
    const fn = cd.slice(cd.indexOf('export async function readYearsWithTeam'));
    assert.match(fn, /childEntriesOnTeam\(entry,/, 'the same-team scope the papers use');
    const route = src('app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/route.ts');
    assert.match(route, /withTeam: withTeamLine\(team\.name, yearsWithTeam\)/);
  });
});
