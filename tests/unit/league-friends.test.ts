import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { FRIEND_WORDS, friendMaxFor, friendRequestsOn, readFriends } from '../../lib/league-friends.ts';
import { makeFriendCode, showFriendCode } from '../../lib/league-friend-code.ts';

/**
 * BOARD READY STAGE 1 PART 1 · THE FAMILY'S SIDE (drawing tabs 1–3; rulings A2, A5, A8, A10, A11; /legal build rules).
 */

const read = (code: string) => readFileSync(code, 'utf8');

describe('friend requests: the gate and the maximum', () => {
  it('asks only on League Plus and both Club bands, above None', () => {
    for (const p of ['league', 'club', 'club_large']) assert.equal(friendMaxFor(p, 2), 2, p);
    for (const p of ['tournament', 'tournament_plus', 'team', null]) assert.equal(friendMaxFor(p, 2), 0, String(p));
    assert.equal(friendRequestsOn('club', 0), false);
    assert.equal(friendMaxFor('club', 1), 1);
  });
});

describe('friend requests: what a family sends', () => {
  it('drops empty blocks, keeps names and codes, holds the maximum', () => {
    const code = makeFriendCode();
    const r = readFriends([
      { by: 'name', first: ' Liam ', last: 'Chen', parent: 'Grace  Chen' },
      { by: 'name', first: '', last: '', parent: '' },
      { by: 'code', code: showFriendCode(code).toLowerCase() },
    ], 2);
    assert.deepEqual(r.errors, {});
    assert.deepEqual(r.friends, [{ by: 'name', first: 'Liam', last: 'Chen', parent: 'Grace Chen' }, { by: 'code', code }]);
  });

  it('a code with a typo is caught with no lookup, in the drawing’s words', () => {
    const code = makeFriendCode();
    const typo = code.slice(0, 5) + (code[5] === 'A' ? 'B' : 'A');
    const r = readFriends([{ by: 'code', code: typo }], 2);
    assert.equal(r.errors['friends.0.code'], 'That code has a typo. Check it with the other family.');
    assert.equal(r.friends.length, 0);
  });

  it('a parent name alone is not a friend; a last name alone is', () => {
    assert.equal(readFriends([{ by: 'name', parent: 'Ryan' }], 2).errors['friends.0.first'], FRIEND_WORDS.nameMissing);
    assert.equal(readFriends([{ by: 'name', last: 'Delaney' }], 2).friends.length, 1);
  });

  it('the child’s own code is refused on the block it was typed in (/review: never on a blank block)', () => {
    const own = makeFriendCode();
    const r = readFriends([{ by: 'name', first: '', last: '' }, { by: 'code', code: own }], 2, { code: own, child: 'Maya' });
    assert.equal(r.errors['friends.1.code'], 'That’s Maya’s own code. Enter a friend’s code instead.');
    assert.equal(r.errors['friends.0.code'], undefined);
  });

  it('a save is one database step, never delete-then-insert from the app (/review)', () => {
    const server = read('lib/league-friends-server.ts');
    assert.match(server, /supabaseAdmin\.rpc\('league_friend_requests_save'/);
    assert.doesNotMatch(server, /from\('league_friend_requests'\)\.(delete|insert)/);
  });

  it('more than the maximum is refused; the same friend twice is one', () => {
    const three = [{ by: 'name', first: 'A' }, { by: 'name', first: 'B' }, { by: 'name', first: 'C' }];
    assert.ok(readFriends(three, 2).errors.friends);
    assert.equal(readFriends([{ by: 'name', first: 'Max' }, { by: 'name', first: 'max' }], 2).friends.length, 1);
    assert.equal(readFriends(three, 0).friends.length, 0, 'None asks nothing and takes nothing');
  });
});

describe('friend requests: the /legal words are verbatim', () => {
  it('the form’s two lines', () => {
    assert.equal(FRIEND_WORDS.care, 'Only name a child whose family is happy for you to.');
    assert.equal(FRIEND_WORDS.privacy, 'Only the club staff who work on sign-ups and teams see these names, and only to decide which team they play on. They are deleted after the season.');
  });
});

describe('friend requests: what the family is never shown (A2)', () => {
  it('the change route answers only what the family asked', () => {
    const route = read('app/api/league/[orgSlug]/[seasonSlug]/friends/route.ts');
    assert.match(route, /return NextResponse\.json\(\{ ok: true, asked \}\);/);
    assert.doesNotMatch(route, /matched_registration_id|state:/);
  });
  it('"Plays with" reads the typed name or code, never the match', () => {
    const server = read('lib/league-friends-server.ts');
    const fn = server.slice(server.indexOf('export async function readFriendsAsked'), server.indexOf('export async function saveFriendRequests'));
    assert.match(fn, /select\('registration_id, slot, typed_first, typed_last, typed_parent, code_entered'\)/);
    assert.doesNotMatch(fn, /matched_registration_id|state/);
  });
  it('the requests table is service role only', () => {
    const sql = read('supabase/migrations/461_a_child_can_name_a_friend.sql');
    assert.match(sql, /REVOKE ALL ON TABLE public\.league_friend_requests FROM anon, authenticated;/);
    assert.doesNotMatch(sql, /CREATE POLICY/);
  });
});
