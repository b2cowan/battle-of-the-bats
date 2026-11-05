import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  documentStateRows, toSignLabel, healthAskTitle, healthAskLine, DOCUMENT_TYPE_LABEL, type SeasonDocument,
} from '../../lib/document-state';
import { defaultValidity, validityOf, formOnFile, hasEveryForm } from '../../lib/forms-coverage';
import { documentsWindowLine, documentsSignedLine } from '../../lib/season-roll-path';

/**
 * CLUB TIER STAGE 14 S4 — papers and the health check follow the child (owner 2026-11-04, Ask 10 A and the S4 Part 0
 * calls). The rules that must hold however the screens change:
 *   · a form is SIGNED EACH SEASON or GOOD UNTIL REPLACED — the club's setting, else the type's default (waiver + code of
 *     conduct each season, medical consent + other until replaced);
 *   · last season's waiver shows "Needs signing" on the new season; a medical consent stays "On file" across a roll;
 *   · documents stay on the season's entry they were signed on — an earlier season's copy is downloadable from the live
 *     page, never deletable, and only this team's seasons are read (Ask 9);
 *   · "Still right for the {season}?" is confirmed, or a Safety value CHANGED — never merely re-sent by the autosave.
 * The database half (the child holds the one current health value; live entries follow; a join keeps the newer side's)
 * is proved by tests/sql/child-health-fixture.sql on dev.
 */

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const S2027 = { id: 'y27', name: '2027 Season' };
const doc = (o: Partial<SeasonDocument> & Pick<SeasonDocument, 'documentType' | 'seasonId'>): SeasonDocument => ({
  id: `${o.documentType}-${o.seasonId}`, createdAt: '2025-04-03T15:00:00Z',
  seasonName: o.seasonId === 'y27' ? '2027 Season' : o.seasonId === 'y26' ? '2026 Season' : '2025 Season',
  seasonYear: o.seasonId === 'y27' ? 2027 : o.seasonId === 'y26' ? 2026 : 2025,
  ...o,
});

describe('which forms carry (Ask 10 A)', () => {
  it('defaults by type', () => {
    assert.equal(defaultValidity('waiver'), 'signed_each_season');
    assert.equal(defaultValidity('code_of_conduct'), 'signed_each_season');
    assert.equal(defaultValidity('medical_consent'), 'good_until_replaced');
    assert.equal(defaultValidity('other'), 'good_until_replaced');
  });
  it('the club’s setting beats the default; an unknown value falls back to it', () => {
    assert.equal(validityOf({ document_type: 'waiver', validity: 'good_until_replaced' }), 'good_until_replaced');
    assert.equal(validityOf({ document_type: 'waiver', validity: 'nonsense' }), 'signed_each_season');
  });
  it('the board’s "signed every form" reads the same rule', () => {
    const held = { thisSeason: new Set(['waiver']), earlier: new Set(['medical_consent', 'code_of_conduct']) };
    assert.equal(formOnFile(held, { document_type: 'medical_consent' }), true);
    assert.equal(formOnFile(held, { document_type: 'code_of_conduct' }), false, 'last season’s code of conduct does not count');
    assert.equal(hasEveryForm(held, [{ document_type: 'waiver' }, { document_type: 'medical_consent' }]), true);
  });
});

describe('the Family & paperwork rows (drawings tab 3 + 5B)', () => {
  const templates = [
    { id: 't-w', name: 'Participant waiver', document_type: 'waiver', validity: 'signed_each_season' },
    { id: 't-m', name: 'Medical consent', document_type: 'medical_consent', validity: 'good_until_replaced' },
  ];
  it('last season’s waiver needs signing; the medical consent stays on file across the roll', () => {
    const rows = documentStateRows({
      templates,
      documents: [doc({ documentType: 'waiver', seasonId: 'y25' }), doc({ documentType: 'medical_consent', seasonId: 'y25' })],
      season: S2027,
    });
    assert.deepEqual(rows.map(r => [r.label, r.state]), [['Waiver', 'needs_signing'], ['Medical consent', 'on_file']]);
    assert.equal(rows[0].line, 'Needs signing for the 2027 Season. Last signed for the 2025 Season, Apr 3, 2025.');
    assert.equal(rows[0].chip, 'Needs signing');
    assert.equal(rows[0].templateId, 't-w', 'the row’s Upload answers its template');
    assert.equal(rows[1].line, 'Uploaded Apr 3, 2025. Good until it’s replaced.');
    assert.equal(toSignLabel(rows), '1 to sign');
  });
  it('a waiver signed for THIS season is on file; nothing to sign', () => {
    const rows = documentStateRows({ templates, documents: [doc({ documentType: 'waiver', seasonId: 'y27' }), doc({ documentType: 'medical_consent', seasonId: 'y26' })], season: S2027 });
    assert.deepEqual(rows.map(r => r.state), ['on_file', 'on_file']);
    assert.equal(rows[0].line, 'Uploaded Apr 3, 2025 for the 2027 Season.');
    assert.equal(toSignLabel(rows), null);
  });
  it('a form never signed needs signing, with no "last signed"', () => {
    const rows = documentStateRows({ templates, documents: [], season: S2027 });
    assert.equal(rows[1].line, 'Needs signing for the 2027 Season.');
    assert.equal(toSignLabel(rows), '2 to sign');
  });
  it('no templates (a standalone coach): the types signed before, at their defaults', () => {
    const rows = documentStateRows({ templates: [], documents: [doc({ documentType: 'waiver', seasonId: 'y26' }), doc({ documentType: 'other', seasonId: 'y26' })], season: S2027 });
    assert.deepEqual(rows.map(r => [r.documentType, r.validity, r.state, r.templateId]), [
      ['waiver', 'signed_each_season', 'needs_signing', null],
      ['other', 'good_until_replaced', 'on_file', null],
    ]);
  });
  it('two templates of one type set differently: the stricter wins (one copy answers both)', () => {
    const rows = documentStateRows({
      templates: [
        { id: 'a', name: 'B consent', document_type: 'medical_consent', validity: 'good_until_replaced' },
        { id: 'b', name: 'A consent', document_type: 'medical_consent', validity: 'signed_each_season' },
      ],
      documents: [doc({ documentType: 'medical_consent', seasonId: 'y26' })], season: S2027,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].validity, 'signed_each_season');
    assert.equal(rows[0].state, 'needs_signing');
    assert.equal(rows[0].templateId, 'b', 'the first by name');
  });
  it('rows come in the drawing’s order, sentence case', () => {
    const rows = documentStateRows({ templates: [], documents: [
      doc({ documentType: 'medical_consent', seasonId: 'y27' }), doc({ documentType: 'code_of_conduct', seasonId: 'y27' }), doc({ documentType: 'waiver', seasonId: 'y27' }),
    ], season: S2027 });
    assert.deepEqual(rows.map(r => r.label), ['Waiver', 'Code of conduct', 'Medical consent']);
    assert.equal(DOCUMENT_TYPE_LABEL.medical_consent, 'Medical consent');
  });
});

describe('the season window’s papers line (drawing 2A/2B)', () => {
  it('the drawn sentence, from the team’s own settings', () => {
    const d = { eachSeason: ['waiver', 'code_of_conduct'] as const, untilReplaced: ['medical_consent'] as const };
    const line = documentsWindowLine({ eachSeason: [...d.eachSeason], untilReplaced: [...d.untilReplaced] }, '2027 Season');
    assert.deepEqual(line, { title: 'Waivers and the code of conduct', rest: ' need signing again for the 2027 Season. Medical forms carry.' });
    assert.equal(documentsSignedLine({ eachSeason: ['waiver', 'code_of_conduct'], untilReplaced: [] }, '2027 Season'),
      'Waivers and the code of conduct need signing for the 2027 Season. Each player shows “Needs signing”.');
  });
  it('singular, carry-only and nothing', () => {
    assert.equal(documentsWindowLine({ eachSeason: ['code_of_conduct'], untilReplaced: [] }, 'Spring 2027')?.rest,
      ' needs signing again for the Spring 2027 season.');
    assert.deepEqual(documentsWindowLine({ eachSeason: [], untilReplaced: ['medical_consent'] }, '2027 Season'),
      { title: 'Medical forms', rest: ' carry into the 2027 Season.' });
    assert.equal(documentsSignedLine({ eachSeason: [], untilReplaced: ['medical_consent'] }, '2027 Season'), null);
    assert.equal(documentsWindowLine(null, '2027 Season'), null, 'a team with no templates and no papers says nothing');
  });
});

describe('the health check’s words', () => {
  it('one wording in both portals', () => {
    assert.equal(healthAskTitle('2027 Season'), 'Still right for the 2027 Season?');
    assert.equal(healthAskLine('2026 Season'), 'Last checked for the 2026 Season. Confirm the medical note and emergency contact once a season, or change them.');
    assert.equal(healthAskLine(null), 'Confirm the medical note and emergency contact once a season, or change them.');
  });
});

describe('the routes keep the rules (source guards)', () => {
  const list = read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents/route.ts');
  const one = read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/documents/[docId]/route.ts');
  const player = read('app/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/route.ts');
  it('the list is still the working season’s door, and reads the child’s papers on this team', () => {
    assert.match(list, /player\.programYearId !== workingYear\.id/, 'a past season’s entry still answers 404');
    assert.match(list, /readChildTeamDocuments\(player\)/);
    assert.match(list, /t\.isActive && t\.documentType === documentType/, 'a row’s template id is checked, never trusted');
  });
  it('a history copy downloads; only this season’s copy deletes', () => {
    assert.match(one, /documentIsTheChilds\(doc, player\)/);
    assert.match(one, /doc\.playerId !== playerId \|\| !workingYear \|\| resolved\.player\.programYearId !== workingYear\.id/);
  });
  it('the health check is stamped on Confirm or a CHANGED value — not on every autosave', () => {
    assert.match(player, /trimmedOrNull\(body\[k\]\) !== trimmedOrNull\(player\[k\]\)/);
    assert.match(player, /body\.confirmHealth === true && !assignment\.capabilities\.rosterPii/, 'nobody confirms what they cannot see');
    assert.match(player, /capabilities\.rosterPii && !isReadOnly \? readHealthCheck/);
  });
  it('the child-documents reads stay on this team, never a call-up', () => {
    const lib = read('lib/child-documents.ts');
    assert.match(lib, /\.in\('team_id', teamIds\)\.neq\('status', 'callup'\)/);
    assert.match(lib, /\.eq\('team_id', entry\.teamId\)/);
  });
  it('the roll no longer says papers are not carried', () => {
    assert.doesNotMatch(read('lib/rep-season-rollover.ts'), /waivers and documents are not carried/);
    assert.match(read('lib/rep-season-rollover.ts'), /documentsSignedLine\(await rollDocuments\(currentSeason\), newName\)/);
    assert.doesNotMatch(read('lib/club-season-words.ts'), /and player documents/);
  });
  it('the coach portal’s labels are sentence case', () => {
    for (const f of ['components/coaches/PlayerDocumentsSection.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/documents/page.tsx']) {
      assert.doesNotMatch(read(f), /'Medical Consent'|'Code of Conduct'/, f);
    }
  });
});
