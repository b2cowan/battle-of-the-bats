/**
 * HOUSE LEAGUE'S GAME WINDOW — read first, edited whole, a state is a door (9d-2a step 4, frame b4; plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h). It replaced the page's Edit Game form (owner, 2026-10-09, §288 W9), whose Delete
 * rules carry over.
 *
 *   1. DELETE DELETES. The route's DELETE was a soft cancel behind "Cancel Game"; house league was left with no way to
 *      remove a game added by mistake (Cancelled keeps it on the public schedule). 9d2·9 (9d-2b): Delete before
 *      publishing, Cancel after — the doors, and the route refuses deleting a published division's game.
 *   2. A RECORD READS FIRST AND EDITS WHOLE: the pencil (whoever runs the season, a game that's on or played) turns the
 *      whole record into its form; ✓ saves; a reader gets no pencil and no doors.
 *   3. THE STATUS DROPDOWN IS GONE. Postpone · Cancel · Give it a new date · Put it back on are doors at the end of the
 *      body; Postpone, Cancel and Delete ask first, "Keep it" against the act. 9d-2b replaced 9d2a·F's "Families aren't
 *      emailed." with the state-true pairs: on a draft nobody is told; on a published division families hear when the
 *      changes are sent, or now (f5).
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
    // 9d2·9: a published division's game is cancelled, never deleted.
    const refuse = del.indexOf('(await divisionOf(game.division_id)).published');
    assert.ok(refuse > 0 && refuse < del.indexOf(".from('league_games').delete()"), 'DELETE lost its published refusal');
  });
  it('Delete ends the body for whoever runs the season, and asks first in the window', () => {
    const w = readCode(WINDOW);
    assert.match(w, /\{canRun && doors && \([\s\S]*\{doors\.delete && <RecordDelete onClick=\{\(\) => setMode\('delete'\)\}/);
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
  it('each state offers its own doors on a published division (9d2·10, 9d2a·E)', () => {
    assert.deepEqual(gameWindowDoors('scheduled', true), { pencil: true, postpone: true, cancel: true, delete: false, giveDate: false, putBack: false });
    assert.deepEqual(gameWindowDoors('completed', true), { pencil: true, postpone: false, cancel: false, delete: false, giveDate: false, putBack: false });
    assert.deepEqual(gameWindowDoors('postponed', true), { pencil: false, postpone: false, cancel: true, delete: false, giveDate: true, putBack: false });
    assert.deepEqual(gameWindowDoors('cancelled', true), { pencil: false, postpone: false, cancel: false, delete: false, giveDate: false, putBack: true });
  });
  it('9d2·9: Delete before publishing, Cancel after', () => {
    for (const st of ['scheduled', 'completed', 'postponed', 'cancelled'] as const) {
      assert.equal(gameWindowDoors(st, false).delete, true, st);
      assert.equal(gameWindowDoors(st, false).cancel, false, st);
      assert.equal(gameWindowDoors(st, true).delete, false, st);
    }
  });
  it('Postpone and Cancel ask, Keep it against the act, and say who hears (9d-2b f1, f5)', () => {
    const w = readCode(WINDOW);
    assert.doesNotMatch(w, /<option value="cancelled"/, 'the Status dropdown came back');
    assert.match(w, />\{W\.keep\}<\/button>/);
    const words = readCode('lib/league-season-calendar.ts');
    assert.doesNotMatch(words, /Families aren’t emailed/, '9d2a·F ends with 9d-2b');
    assert.match(words, /Nobody is told: the schedule isn’t published yet\./);
    assert.match(words, /Families hear when you send changes, and the public schedule shows it Cancelled from then\./);
    // f5: on a published division the one question offers both ways.
    assert.match(w, /const urgent = published && mode !== 'delete';/);
    assert.match(w, /onClick=\{\(\) => void act\(status, true\)\}/);
  });
  it('every press carries what the window saw, and the route refuses a game changed since (the stale window)', () => {
    const w = readCode(WINDOW);
    assert.match(functionBody(w, 'changes'), /seen: \{ status: game\.status, updatedAt: game\.updatedAt \}/);
    assert.match(functionBody(w, 'act'), /seen: \{ status: game\.status, updatedAt: game\.updatedAt \}/);
    const patch = readCode(ROUTE);
    assert.match(patch, /seen\.status !== game\.status \|\| !sameInstant\(seen\.updatedAt, game\.updated_at\)/);
    assert.match(patch, /if \(!\(await updateLeagueGame\(gameId, patch, game\.updated_at\)\)\)/);
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

describe('6. the ✓ (review 2026-10-28)', () => {
  it('a score or a note on a game that already shares its place is recorded, not moved: the live clash line is asked only of a booking being placed', () => {
    const w = readCode(WINDOW);
    assert.match(w, /const placing = creating \|\| mode === 'redate'/);
    assert.match(w, /occurrence: editing && placing \? \{/);
  });
  it('a re-date is held until it has a date and a time', () => {
    const w = readCode(WINDOW);
    assert.match(w, /const undated = mode === 'redate' && \(!draft\.date \|\| !draft\.time\);/);
    assert.match(w, /const blocked = refused \|\| checking \|\| !!held \|\| undated;/);
  });
});

describe('5. the permit line and "See the permit" (9d-2a step 7, frames b4, c3, i)', () => {
  const SCHEDULE_ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/schedule/route.ts';
  it('the season read carries a permit answer only for someone who runs the season ("A reader doesn\'t see the line")', () => {
    const get = readCode(SCHEDULE_ROUTE);
    const body = get.slice(get.indexOf('export const GET'), get.indexOf('export const POST'));
    assert.match(body, /const runs = !houseLeagueRefusal\(ctx, 'run', season\);/);
    assert.match(body, /if \(runs\) \{[\s\S]*checkClubPermitsQuietly\(/);
  });
  it('the season\'s game time goes to someone who runs the season too, and a failed read of it never fails the schedule (review 2026-10-28)', () => {
    const get = readCode(SCHEDULE_ROUTE);
    const body = get.slice(get.indexOf('export const GET'), get.indexOf('export const POST'));
    assert.match(body, /runs \? seasonGameSlots\(ctx!\.org\.id, seasonId\)\.catch\(\(\) => \[\]\) : Promise\.resolve\(\[\]\)/);
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

describe('5. a published game is never let through by a failed read, and a revived game is placed again (9d-2b Part 7 review)', () => {
  it('the division read throws rather than reading a published division as a draft', () => {
    const code = readCode(ROUTE);
    assert.match(code, /if \(error \|\| !data\) throw error \?\? new Error\('Division not found'\);/);
  });
  it('a game coming back on is placed like a move, so postponing it somewhere else and reviving it checks the division\'s time', () => {
    const code = readCode(ROUTE);
    assert.match(code, /const moved = slotRevived \|\|/);
  });
  it('a 409 "changed" re-reads the season, and a press stays busy until that read lands', () => {
    const w = readCode(WINDOW);
    assert.match(w, /res\.status === 409 && data\.code === 'changed'\) \{ await onChanged\(\); setMode\('read'\); \}/);
    assert.equal((w.match(/try \{ await onChanged\(\); \} finally \{ setSaving\(false\); \}/g) ?? []).length, 2, 'save and act');
  });
});
