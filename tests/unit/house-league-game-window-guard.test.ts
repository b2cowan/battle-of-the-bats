/**
 * HOUSE LEAGUE'S GAME WINDOW — read first, edited whole, a state is a door (9d-2a step 4, frame b4; plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h). It replaced the page's Edit Game form (owner, 2026-10-09, §288 W9), whose Delete
 * rules carry over.
 *
 *   1. DELETE DELETES. The route's DELETE was a soft cancel behind "Cancel Game"; house league was left with no way to
 *      remove a game added by mistake (Cancelled keeps it on the public schedule). 9d2·9: Delete before publishing —
 *      nothing is published until 9d-2b, so it stays on every state.
 *   2. A RECORD READS FIRST AND EDITS WHOLE: the pencil (whoever runs the season, a game that's on or played) turns the
 *      whole record into its form; ✓ saves; a reader gets no pencil and no doors.
 *   3. THE STATUS DROPDOWN IS GONE. Postpone · Cancel · Give it a new date · Put it back on are doors at the end of the
 *      body; Postpone, Cancel and Delete ask first, "Keep it" against the act, and Postpone and Cancel say families aren't
 *      emailed (9d2a·F).
 *   4. THE SAVE SENDS ONLY WHAT CHANGED, so a score on a game that already clashes is a record, never a move the route
 *      re-checks and refuses (the route's own rule, which the old every-field save broke).
 *   (⚰ 3, "the pinned head and foot sit flush": the old look's sticky bands; the window is the kit's KitDialog now.)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { functionBody, readCode } from './_source-code.ts';
import { asksScores, gameWindowDoors, scoresToSave } from '../../lib/league-season-calendar.ts';

const ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts';
const PAGE = 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx';
const WINDOW = 'components/admin/kit/club/league/schedule/GameWindow.tsx';

describe('1. the route\'s DELETE removes the game', () => {
  it('deletes the row of this season, and no longer only cancels it', () => {
    const code = readCode(ROUTE);
    const del = code.slice(code.indexOf('export const DELETE'));
    assert.ok(del.length > 0, 'the DELETE handler is gone');
    assert.match(del, /\.from\('league_games'\)\.delete\(\)\.eq\('id', gameId\)\.eq\('season_id', seasonId\)/);
    assert.doesNotMatch(del, /updateLeagueGame\(/, 'DELETE went back to a soft cancel');
    // Who may: the one house-league gate (Stage 9a Part 1), on this season — a finished season's games are locked (Q16).
    assert.match(del, /houseLeagueRefusal\(ctx, 'run', season\)/);
  });
  it('Delete ends the body for whoever runs the season, and asks first in the window', () => {
    const w = readCode(WINDOW);
    assert.match(w, /\{canRun && doors && \([\s\S]*<RecordDelete onClick=\{\(\) => setMode\('delete'\)\}/);
    assert.match(w, /W\.deleteAsk\(name\), says: W\.deleteSays\(scoredGame\), yes: W\.deleteYes, cls: 'btn btn-danger'/);
    const write = functionBody(w, 'write');
    assert.match(write, /\} finally \{\s*setSaving\(false\);\s*\}/, 'a dropped connection leaves the window locked on `saving`');
    assert.match(write, /method === 'DELETE' && res\.status === 404/, 'a game someone else deleted is what Delete asked for');
  });
});

describe('2. a record reads first and edits whole', () => {
  it('the page opens every game in the one window; the old form is gone', () => {
    const page = readCode(PAGE);
    assert.doesNotMatch(page, /function GameModal\b/);
    assert.match(page, /<GameWindow\b[\s\S]*canRun=\{canManage\}/);
    assert.match(page, /if \(b\.source\.kind === 'game'\) setGameWindow\(\{ id: b\.source\.game\.id \}\);/);
  });
  it('the pencil is the runner\'s, ✓ in its spot saves, and the form holds while the check is out or refuses', () => {
    const w = readCode(WINDOW);
    assert.match(w, /edit=\{canRun && doors\?\.pencil \? \{ editing: false, label: W\.edit, onToggle: \(\) => openForm\('edit'\) \} : undefined\}/);
    assert.match(w, /edit=\{\{ editing: true, label: W\.edit, onToggle: \(\) => void save\(\), disabled: saving \|\| blocked \}\}/);
    assert.match(functionBody(w, 'save'), /if \(!\(await lineIsCurrent\(\)\)\) return;/, 'the save must ask the live check once more first');
  });
});

describe('3. a state is a door', () => {
  it('each state offers its own doors (9d2·9, ·10, 9d2a·E)', () => {
    assert.deepEqual(gameWindowDoors('scheduled'), { pencil: true, postpone: true, cancel: true, giveDate: false, putBack: false });
    assert.deepEqual(gameWindowDoors('completed'), { pencil: true, postpone: false, cancel: false, giveDate: false, putBack: false });
    assert.deepEqual(gameWindowDoors('postponed'), { pencil: false, postpone: false, cancel: true, giveDate: true, putBack: false });
    assert.deepEqual(gameWindowDoors('cancelled'), { pencil: false, postpone: false, cancel: false, giveDate: false, putBack: true });
  });
  it('Postpone and Cancel ask, Keep it against the act, and say families aren\'t emailed', () => {
    const w = readCode(WINDOW);
    assert.doesNotMatch(w, /<option value="cancelled"/, 'the Status dropdown came back');
    assert.match(w, />\{W\.keep\}<\/button>/);
    const words = readCode('lib/league-season-calendar.ts');
    assert.match(words, /postponeSays: '[^']*Families aren’t emailed\.'/);
    assert.match(words, /cancelSays: '[^']*Families aren’t emailed\.'/);
  });
  it('a re-dated game is put back on by the same form', () => {
    assert.match(functionBody(readCode(WINDOW), 'changes'), /if \(mode === 'redate'\) out\.status = 'scheduled';/);
  });
});

describe('4. the save sends only what changed, and a score is both or neither', () => {
  it('when and where go only when they changed (or on a create / a re-date)', () => {
    const c = functionBody(readCode(WINDOW), 'changes');
    assert.match(c, /if \(creating \|\| mode === 'redate' \|\| draft\.date !== seed\.date \|\| draft\.time !== seed\.time \|\| draft\.endTime !== seed\.endTime\)/);
    assert.match(c, /if \(creating \|\| JSON\.stringify\(draft\.where\) !== JSON\.stringify\(seed\.where\)\)/);
  });
  it('both scores make it played, neither puts it back on, one alone is held', () => {
    assert.deepEqual(scoresToSave('7', '4'), { homeScore: 7, awayScore: 4, status: 'completed' });
    assert.deepEqual(scoresToSave(' ', ''), { homeScore: null, awayScore: null, status: 'scheduled' });
    assert.equal(scoresToSave('7', ''), null);
    assert.equal(scoresToSave('-1', '2'), null);
  });
  it('the score is asked once the game has started, or when it has one', () => {
    const now = Date.parse('2027-06-17T22:00:00Z');
    assert.equal(asksScores({ status: 'scheduled', scheduledAt: '2027-06-17T21:00:00Z' }, now), true);
    assert.equal(asksScores({ status: 'scheduled', scheduledAt: '2027-06-18T21:00:00Z' }, now), false);
    assert.equal(asksScores({ status: 'completed', scheduledAt: '2027-06-18T21:00:00Z' }, now), true);
    assert.equal(asksScores({ status: 'postponed', scheduledAt: '2027-06-17T21:00:00Z' }, now), false);
  });
});

describe('5. the permit line and "See the permit" (9d-2a step 7, frames b4, c3, i)', () => {
  const SCHEDULE_ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts';
  it('the season read carries a permit answer only for someone who runs the season ("A reader doesn\'t see the line")', () => {
    const get = readCode(SCHEDULE_ROUTE);
    const body = get.slice(get.indexOf('export const GET'), get.indexOf('export const POST'));
    assert.match(body, /if \(!houseLeagueRefusal\(ctx, 'run', season\)\) \{[\s\S]*checkClubPermitsQuietly\(/);
  });
  it('the record says the line from the season read, for whoever runs it, with the door', () => {
    const w = readCode(WINDOW);
    assert.match(w, /const permit = canRun \? booking\?\.permit \?\? null : null;/);
    assert.match(w, /\{permit && <WhereLine tone="quiet" mark="clock" rest=\{permitLine\(permit, sport\)\} door=\{<SeePermitDoor permitId=\{permit\.permitId\} onOpen=\{onSeePermit\} \/>\} \/>\}/);
    // the form's live line gets the same door
    assert.match(w, /useLeagueLine\(\{[\s\S]*?onSeePermit,\s*\}\);/);
  });
  it('the page opens Stage 10\'s permit window RAISED over the window that asked, which waits underneath', () => {
    const page = readCode(PAGE);
    assert.match(page, /<PermitWindow raised key=\{permitOpen\}/);
    assert.equal((page.match(/onSeePermit=\{setPermitOpen\}/g) ?? []).length, 2, 'the game window and Generate games both open it');
  });
});
