/**
 * HOUSE LEAGUE'S GAME WINDOW — Delete, and the pinned bands sitting flush (owner, 2026-10-09, at Edit Game walking
 * Club Tier §288 W9: "why is there so much white space at the bottom and top of this modal? also, I don't see delete
 * anywhere on here to be able to delete the game").
 *
 *   1. DELETE DELETES. The route's DELETE was a soft cancel behind "Cancel Game", which went earlier the same day; house
 *      league was left with no way to remove a game added by mistake (Cancelled keeps it on the public schedule).
 *   2. DELETE ENDS THE BODY of Edit Game — red, alone, never in the foot (the rare-door ruling, 2026-10-09) — only on an
 *      existing game, only for a manager, and it ASKS first (Keep it · Delete) on top of the window.
 *   3. THE HEAD AND FOOT STICK AT THE WINDOW'S EDGE. A sticky band stops at its scroll box's content edge, so at 0 each
 *      parked one padding-width inside the window once it scrolled: an empty strip above the title and below the
 *      buttons. Their insets are minus the window's padding.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cssRule, functionBody, readCode } from './_source-code.ts';

const ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/schedule/[gameId]/route.ts';
const PAGE = 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx';
const CSS = 'app/[orgSlug]/admin/house-league/house-league.module.css';

describe('1. the route\'s DELETE removes the game', () => {
  it('deletes the row of this season, and no longer only cancels it', () => {
    const code = readCode(ROUTE);
    const del = code.slice(code.indexOf('export const DELETE'));
    assert.ok(del.length > 0, 'the DELETE handler is gone');
    assert.match(del, /\.from\('league_games'\)\.delete\(\)\.eq\('id', gameId\)\.eq\('season_id', seasonId\)/);
    assert.doesNotMatch(del, /updateLeagueGame\(/, 'DELETE went back to a soft cancel');
    assert.match(del, /if \(ctx!\.role !== 'owner' && ctx!\.role !== 'league_admin'\) return forbidden\(\);/);
  });
});

describe('2. Edit Game ends its body with Delete, and asks first', () => {
  it('only on an existing game, only for a manager, before the foot', () => {
    const modal = functionBody(readCode(PAGE), 'GameModal');
    const door = modal.search(/\{game && canManage && \([\s\S]{0,120}<RecordDelete onClick=\{\(\) => onDelete\(game\)\} disabled=\{saving\}>Delete this game<\/RecordDelete>/);
    assert.ok(door > 0, 'Delete this game is gone from Edit Game, or lost its gate');
    const foot = modal.indexOf('className={styles.modalFooter}');
    assert.ok(foot > door, 'Delete moved into (or below) the foot — a rare door ends the body');
  });
  it('the question is Keep it · Delete, in red, and Delete calls the route', () => {
    const code = readCode(PAGE);
    const ask = functionBody(code, 'askDeleteGame');
    assert.match(ask, /type: 'danger'/);
    assert.match(ask, /confirmText: 'Delete'/);
    assert.match(ask, /cancelText: 'Keep it'/);
    assert.match(ask, /Its score comes out of the standings\./);
    const del = functionBody(code, 'deleteGame');
    assert.match(del, /\{ method: 'DELETE' \}/);
    assert.match(del, /\} finally \{\s*setSaving\(false\);\s*\}/, 'a dropped connection leaves the window locked on `saving`');
    assert.match(code, /onDelete=\{askDeleteGame\}/);
    assert.match(code, /onConfirm=\{feedback\.onConfirm\}/, 'the page\'s FeedbackModal never receives the act — the question would be a notice');
  });
});

describe('3. the pinned head and foot sit flush with the window\'s edge', () => {
  it('their insets are minus the window\'s padding', () => {
    const css = readCode(CSS);
    assert.match(cssRule(css, '.modal'), /padding: 1\.5rem;/, 'the window\'s padding changed — move the bands\' insets with it');
    assert.match(cssRule(css, '.modal > .modalHeader'), /position: sticky; top: -1\.5rem;/);
    assert.match(cssRule(css, '.modal > .modalFooter'), /position: sticky; bottom: -1\.5rem;/);
  });
});
