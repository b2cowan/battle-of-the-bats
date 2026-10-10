/**
 * DIVISIONS (Tournament admin redesign Stage 5, Part 4 — E4, A50 record A, A52; F28, F88). What the build must keep
 * true:
 *   - a full division reads as good news, in words ("6 of 6 · full"), and registration is said in words;
 *   - a division opens its own record, which reads first and edits whole with autosave;
 *   - Delete asks ONCE, naming what goes, and the route deletes only what the question named;
 *   - no browser alert box; an Exhibition's division never speaks of playoff seeding and saves no playoff setting.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import { DIVISION_WORDS as W, agesLine, deleteQuestion, divisionCaption, teamsFigure } from '../../lib/division-words.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const page = code('app/[orgSlug]/admin/tournaments/divisions/page.tsx');
const record = code('app/[orgSlug]/admin/tournaments/divisions/DivisionRecord.tsx');

describe('a division, in words (E4)', () => {
  it('a full division is good news, in the row\'s own words', () => {
    assert.equal(teamsFigure(6, 6), '6 of 6 · full');
    assert.equal(teamsFigure(7, 8), '7 of 8');
    assert.equal(teamsFigure(0, 8), '0 of 8');
    assert.equal(teamsFigure(5, null), '5 teams');
  });
  it('the row says its ages, its pools and its registration', () => {
    assert.equal(divisionCaption({ minAge: 9, maxAge: 11, poolNames: ['Red', 'Blue'], isClosed: false }), 'Ages 9–11 · pools Red and Blue · registration open');
    assert.equal(divisionCaption({ minAge: null, maxAge: null, poolNames: [], isClosed: true }), 'registration closed');
    assert.equal(agesLine(13, null), 'Ages 13 and up');
    assert.equal(agesLine(null, 11), 'Up to age 11');
  });
  it('Delete asks once, naming what goes', () => {
    const q = deleteQuestion('U11 Girls', { games: 4, scoredGames: 2, teams: 8, waitlist: 2 });
    assert.equal(q.title, 'Delete U11 Girls?');
    assert.equal(q.body, 'It holds 4 games (2 with a score) and 8 teams, 2 of them on the waitlist. Deleting it removes all of them for good. To keep the teams, move them to another division on Teams first.');
    assert.equal(q.action, 'Delete U11 Girls, its 4 games and 8 teams');
    const empty = deleteQuestion('U15 Open', { games: 0, scoredGames: 0, teams: 0, waitlist: 0 });
    assert.deepEqual(empty, { title: 'Delete U15 Open?', body: 'Nothing is in it.', action: 'Delete U15 Open' });
    assert.equal(deleteQuestion('U9', { games: 0, scoredGames: 0, teams: 1, waitlist: 0 }).body,
      'It holds 1 team. Deleting it removes it for good. To keep the teams, move them to another division on Teams first.');
  });
  it('an Exhibition never speaks of playoff seeding (F88)', () => {
    assert.doesNotMatch(W.tieBreakersFor(true), /playoff/);
    assert.match(W.tieBreakersFor(false), /playoff seeding/);
    assert.match(record, /const playoffDefaults = ctx\.exhibition \? \{\} : \{ type: 'single'/);
  });
});

describe('the screen (E4)', () => {
  it('the old cards and their window are gone; a row opens the record', () => {
    assert.equal(existsSync(new URL('../../app/[orgSlug]/admin/tournaments/divisions/admin-page.module.css', import.meta.url)), false);
    assert.match(page, /<DivisionRecord/);
    assert.doesNotMatch(page, /Edit Division|Delete Division\?|This division is not empty/);
  });
  it('no browser alert box anywhere on Divisions', () => {
    assert.doesNotMatch(page + record, /\balert\(/);
  });
  it('the record reads first and edits whole, with autosave and the floating pill', () => {
    assert.match(record, /edit=\{canWrite \? \{ editing, onToggle: toggleEdit, label: W\.edit \}/);
    assert.match(record, /useRecordAutosave\(/);
    assert.match(record, /<SavePill inline/);
    assert.match(record, /<RecordDelete /);
  });
  it('the /review\'s fixes hold: a blank limit clears it, an old cap never lingers, a flush with nothing new sends nothing', () => {
    assert.match(record, /capacity: f\.capacity\.trim\(\) \? Number\(f\.capacity\) : null/);
    assert.match(record, /maxRunDiffPerGame: ctx\.scopes\.tieBreakers !== 'tournament' && breakersOwn \? clampRunDiffCap\(f\.runDiffCap\) : null/);
    assert.match(record, /if \(fSig === savedSigRef\.current\) return;/);
  });
  it('the route reads the counts on request and deletes only what the question named', () => {
    const route = code('app/api/admin/divisions/route.ts');
    assert.match(route, /url\.searchParams\.get\('counts'\) === '1'/);
    assert.match(route, /error: 'DIVISION_CHANGED', counts: now/);
    assert.match(page, /&counts=1/);
  });
});
