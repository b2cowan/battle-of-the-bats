import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filesUnder, readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FRIEND REQUESTS ARE READ ONLY BY THE SEATS THAT OPEN REGISTRATIONS (Board Ready Stage 1 Part 2; ruling A11, the same
 * seats as family notes; /legal build rules). The rows carry children's names a family typed on an anonymous form.
 *   1. The registrar's read (`readSeasonFriendRequests`) has ONE caller: the friends route.
 *   2. That route's GET refuses through the SAME house-league action as the registrations list, so narrowing who opens
 *      registrations narrows who reads friend names in the same change (this test fails until both move). Its writes are
 *      the registrations desk's (`register`).
 *   3. Friend NAMES never reach "Excel with contact details": the registrations export holds only the two name-free
 *      columns, and every cell is written formula-safe (anonymous text reaches Excel and CSV).
 *   4. The friends route logs no row (a typed child's name never goes into the logs).
 * ⚠ When Part 3 puts friends on the draft board, extend 1 and 2 to the board route the way the board-notes guard does.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const SERVER = 'lib/league-friend-queue-server.ts';
const FRIENDS_ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/friends/route.ts';
const REG_LIST = 'app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts';
const REG_EXPORT = 'components/admin/kit/club/league/registrations/registrationsExport.ts';
const FRIEND_EXPORT = 'components/admin/kit/club/league/registrations/friendRequestsExport.ts';
const BOARD_ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/teams-board/route.ts';
const DRAFT_ROUTE = 'app/api/admin/house-league/seasons/[seasonId]/draft/route.ts';

/** The action a route's handler refuses through first: `houseLeagueRefusal(ctx, '<action>')`, bounded at the next export. */
function actionOf(rel: string, handler: 'GET' | 'POST'): string {
  const code = readCode(rel);
  const at = code.indexOf(`export const ${handler}`);
  assert.ok(at >= 0, `${rel} has no ${handler}`);
  const rest = code.slice(at + 1);
  const end = rest.search(/\nexport /);
  const m = /houseLeagueRefusal\(ctx, '(\w+)'/.exec(end > 0 ? rest.slice(0, end) : rest);
  assert.ok(m, `${rel}'s ${handler} no longer refuses through houseLeagueRefusal`);
  return m![1];
}

describe('1 · the registrar’s read has one caller', () => {
  it('only the family side and the registrar’s side query the friend requests table', () => {
    // The family side (lib/league-friends-server.ts) reads only what that family typed, for "Plays with".
    const FAMILY = 'lib/league-friends-server.ts';
    const readers = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx'), ...filesUnder('components', '.ts')]
      .filter(f => /from\(\s*'league_friend_requests'\s*\)/.test(readCode(f)));
    assert.deepEqual(readers.sort(), [SERVER, FAMILY].sort());
  });
  it('only the friends route imports readSeasonFriendRequests', () => {
    const callers = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
      .filter(f => f !== SERVER && /\breadSeasonFriendRequests\b/.test(readCode(f)));
    assert.deepEqual(callers, [FRIENDS_ROUTE]);
  });
  it('Part 3: only the board and the draft routes read a division’s links', () => {
    const callers = [...filesUnder('app', '.ts'), ...filesUnder('app', '.tsx'), ...filesUnder('lib', '.ts'), ...filesUnder('components', '.tsx')]
      .filter(f => f !== SERVER && /\breadDivisionFriendLinks\b/.test(readCode(f)));
    assert.deepEqual(callers.sort(), [BOARD_ROUTE, DRAFT_ROUTE].sort());
  });
  it('the read is the season’s own, in the org', () => {
    const code = readCode(SERVER);
    const body = code.slice(code.indexOf('export async function readSeasonFriendRequests'));
    assert.match(body.split('\nexport ')[0], /\.eq\('org_id', orgId\)\.eq\('season_id', seasonId\)/);
  });
});

describe('2 · the same gate as the registrations list', () => {
  it('the friends GET refuses on the registrations list’s action', () => {
    assert.equal(actionOf(FRIENDS_ROUTE, 'GET'), actionOf(REG_LIST, 'GET'));
  });
  it('a decision is the registrations desk’s, checked again against the season (finished = refused)', () => {
    assert.equal(actionOf(FRIENDS_ROUTE, 'POST'), 'register');
    assert.match(readCode(FRIENDS_ROUTE), /houseLeagueRefusal\(ctx, 'register', season\)/);
  });
  it('a season off the plan, or at None, returns no rows', () => {
    assert.match(readCode(FRIENDS_ROUTE), /if \(!friendRequestsOn\(ctx!\.org\.planId, season\.friendRequestsMax\)\) return NextResponse\.json\(\{ on: false, requests: \[\] \}\)/);
  });
});

describe('2b · Part 3: the board shows friends only to a reader of Registrations; the draft returns none', () => {
  it('the board route reads the links only inside a refusal check on the registrations list’s action', () => {
    const code = readCode(BOARD_ROUTE);
    const m = /if \(board && friendRequestsOn\(ctx!\.org\.planId, season\.friendRequestsMax\) && !houseLeagueRefusal\(ctx, '(\w+)'\)\) \{\s*friends = await readDivisionFriendLinks\(/.exec(code);
    assert.ok(m, 'the board route reads friend links without its registrations gate in front of the call');
    assert.equal(m![1], actionOf(REG_LIST, 'GET'), 'the board’s friends gate and the registrations read have come apart');
    assert.equal((code.match(/readDivisionFriendLinks\(/g) ?? []).length, 1, 'a second friends read in the board route');
    assert.match(code, /\.\.\.\(friends \? \{ friends \} : \{\}\)/, 'a refused reader must get no friends key at all');
  });
  it('the draft route keeps groups for anyone who runs it, and sends no link back', () => {
    const code = readCode(DRAFT_ROUTE);
    // Every response the route writes is a refusal or { ok: true }: never the links, never a name.
    for (const m of code.matchAll(/NextResponse\.json\(\{([^}]*)\}/g)) {
      // A key (or shorthand) naming friend data, never the words of a refusal.
      assert.doesNotMatch(m[1], /\b(links|friends|requests|groups)\s*[:,]|\b(links|friends|requests|groups)\s*$|typed/i, `the draft route answers with ${m[1]}`);
    }
    assert.match(code, /houseLeagueRefusal\(ctx, 'read', season\)/, 'Keep apart is not behind the registrations read');
  });
  it('the links carry ids, never a typed name', () => {
    const draft = readCode('lib/league-friend-draft.ts');
    const body = draft.slice(draft.indexOf('export function divisionLinks')).split('\nexport ')[0];
    assert.doesNotMatch(body, /typedFirst|typedLast|typedParent/);
  });
});

describe('3 · friend names stay out of the contact-details file', () => {
  const reg = readCode(REG_EXPORT);
  it('the registrations export adds only the two name-free columns', () => {
    assert.match(reg, /key: 'friendRequests'/);
    assert.match(reg, /key: 'friendsHonoured'/);
    assert.doesNotMatch(reg, /typedFirst|typedLast|typedParent|askedText|matchedRegistration/);
  });
  it('every CSV cell of both files is written formula-safe (an Excel cell is stored as text and never runs)', () => {
    assert.match(reg, /generateCSV\(serializeHeaders\(colsFor\(rows\)\), serializeRows\(source\(rows\), colsFor\(rows\)\)\.map\(formulaSafeRow\)\)/);
    assert.match(readCode(FRIEND_EXPORT), /forCsv \? cells\.map\(v => String\(formulaSafe\(v\)\)\) : cells/);
    // Part 3 passes the live result as a fifth argument; the CSV flag (true) is what makes every cell formula-safe.
    assert.match(readCode(FRIEND_EXPORT), /generateCSV\(HEAD, lines\(p\.rows, p\.divisionName, p\.teamName, true(, p\.resultOf)?\)\)/);
  });
  it('the friend requests file carries no parent name and no contact', () => {
    assert.doesNotMatch(readCode(FRIEND_EXPORT), /typedParent|guardian/i);
  });
});

describe('4 · nothing logs a friend row', () => {
  it('the friends route and the server read write nothing to the console', () => {
    for (const f of [FRIENDS_ROUTE, SERVER]) assert.doesNotMatch(readCode(f), /console\./, `${f} logs`);
  });
});
