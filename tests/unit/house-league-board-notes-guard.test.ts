import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, functionBody, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DRAFT BOARD'S NOTE MARK (HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE, ruling A8): a family's sign-up note is shown only to a
 * reader who can already open that registration — and is never SENT to anyone else, not just hidden from them.
 *   1. The board's one read (`readDivisionBoard`, which the draft and Publish also read) carries no note.
 *   2. The notes have their own read, and only the Teams & draft board route calls it.
 *   3. That route asks for it behind the SAME gate action the registrations reads use, so narrowing who opens
 *      registrations narrows who receives a note on the board in the same change (this test fails until both move).
 * Notes can be medical (an allergy). Who opens registrations reads them; that is the ruling, not a leak.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TEAMS = 'lib/house-league-teams.ts';
const BOARD_ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/teams-board/route.ts';
const REG_LIST = 'app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts';
const REG_ONE = 'app/api/admin/house-league/seasons/[seasonId]/registrations/[regId]/route.ts';

/** The action a route's GET handler refuses through first: `houseLeagueRefusal(ctx, '<action>')`. */
function getAction(rel: string): string {
  const code = readCode(rel);
  const at = code.indexOf('export const GET');
  assert.ok(at >= 0, `${rel} has no GET`);
  // Bounded at the next exported handler: a GET that lost its refusal must not borrow the POST's.
  const rest = code.slice(at + 1);
  const end = rest.search(/\nexport /);
  const m = /houseLeagueRefusal\(ctx, '(\w+)'/.exec(end > 0 ? rest.slice(0, end) : rest);
  assert.ok(m, `${rel}'s GET no longer refuses through houseLeagueRefusal`);
  return m![1];
}

describe('1 · the shared board read carries no note', () => {
  const code = readCode(TEAMS);
  it('BOARD_REG_COLUMNS names no notes column', () => {
    const cols = /BOARD_REG_COLUMNS\s*=([\s\S]*?);/.exec(code)?.[1];
    assert.ok(cols, 'BOARD_REG_COLUMNS is gone');
    assert.doesNotMatch(cols!, /notes/);
  });
  it('readDivisionBoard reads no notes column and returns no note', () => {
    // Bounded at the next export: `functionBody` runs on past an `export async function`.
    const body = functionBody(code, 'readDivisionBoard').split('\nexport ')[0];
    assert.match(body, /return \{/, 'the bound lost the function');
    assert.doesNotMatch(body, /notes/i);
  });
});

describe('2 · the notes read is the board route’s alone', () => {
  it('only the Teams & draft board route imports readBoardNotes', () => {
    const callers = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
      .filter(f => f !== TEAMS && /\breadBoardNotes\b/.test(readCode(f)));
    assert.deepEqual(callers, [BOARD_ROUTE]);
  });
  it('it reads accepted players of the one division only', () => {
    const body = functionBody(readCode(TEAMS), 'readBoardNotes');
    assert.match(body, /\.eq\('division_id', divisionId\)/);
    assert.match(body, /\.eq\('status', 'active'\)/);
  });
});

describe('3 · the same gate as opening a registration', () => {
  it('the registrations list and the single registration open on one action', () => {
    assert.equal(getAction(REG_LIST), getAction(REG_ONE));
  });
  it('the board route reads notes only inside a refusal check on that same action', () => {
    const code = readCode(BOARD_ROUTE);
    const m = /if \(board && !houseLeagueRefusal\(ctx, '(\w+)'\)\) \{\s*notes = await readBoardNotes\(/.exec(code);
    assert.ok(m, 'the board route reads notes without its registrations gate in front of the call');
    assert.equal(m![1], getAction(REG_LIST), 'the board’s note gate and the registrations read have come apart');
    assert.equal((code.match(/readBoardNotes\(/g) ?? []).length, 1, 'a second notes read in the board route');
  });
  it('a refused reader gets no notes key at all, not an empty map', () => {
    assert.match(readCode(BOARD_ROUTE), /\.\.\.\(notes \? \{ notes \} : \{\}\)/);
  });
});
