import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chooseLoginDestination, startDoorNext, START_DOOR_NEXT_PATHS } from '../../lib/login-destination.ts';
import { readCode } from './_source-code.ts';

/**
 * `/auth/login?next=/start/club` used to land on Home: `next` was honoured only for a person with a workspace, and a
 * person who is about to start a club has none yet. The start doors are honoured without one, by a list.
 */
describe('signing in with a next', () => {
  const noWorkspace = { destination: '/discover', hasWorkspace: false };

  it('a person with no organization yet lands on the start door they asked for', () => {
    for (const next of ['/start/club', '/start/league', '/start/tournament', '/start/team', '/start']) {
      assert.equal(chooseLoginDestination({ next, ...noWorkspace }), next, next);
    }
  });

  it('keeps the door’s query (a plan) and ignores a trailing slash', () => {
    assert.equal(chooseLoginDestination({ next: '/start/club?plan=club_large', ...noWorkspace }), '/start/club?plan=club_large');
    assert.equal(chooseLoginDestination({ next: '/start/league/', ...noWorkspace }), '/start/league/');
  });

  it('a person with no organization is still NOT sent to a page they could not open', () => {
    for (const next of ['/harbourtown/admin', '/harbourtown/coaches', '/platform-admin', '/discover/x', '/start/unknown', '/startx', '/start/club/extra']) {
      assert.equal(chooseLoginDestination({ next, ...noWorkspace }), '/discover', next);
    }
  });

  it('never an off-site address, however it is dressed', () => {
    for (const next of ['https://evil.example/start/club', '//evil.example/start/club', '/\\evil.example', '/.//evil.example', '/start/club/..//evil.example']) {
      assert.equal(chooseLoginDestination({ next, ...noWorkspace }), '/discover', next);
    }
  });

  it('a suspended member is shown why, not sent on to a start door', () => {
    assert.equal(chooseLoginDestination({ next: '/start/club', destination: '/auth/suspended', hasWorkspace: false }), '/auth/suspended');
  });

  it('no next at all lands where the resolver said', () => {
    assert.equal(chooseLoginDestination({ next: null, ...noWorkspace }), '/discover');
    assert.equal(chooseLoginDestination({ next: undefined, destination: '/harbourtown/admin', hasWorkspace: true }), '/harbourtown/admin');
  });

  it('a person who holds a workspace keeps the old behaviour: their own safe next, whatever it is', () => {
    const own = { destination: '/harbourtown/admin', hasWorkspace: true };
    assert.equal(chooseLoginDestination({ next: '/harbourtown/coaches', ...own }), '/harbourtown/coaches');
    assert.equal(chooseLoginDestination({ next: '/start/club', ...own }), '/start/club');
    assert.equal(chooseLoginDestination({ next: 'https://evil.example', ...own }), '/harbourtown/admin');
  });

  it('startDoorNext answers only for the listed doors', () => {
    assert.equal(startDoorNext('/start/club'), '/start/club');
    assert.equal(startDoorNext('/home'), null);
    assert.equal(startDoorNext(null), null);
    assert.deepEqual([...START_DOOR_NEXT_PATHS], ['/start', '/start/club', '/start/league', '/start/tournament', '/start/team']);
  });

  it('the sign-in page decides through this one function, so the workspace rule cannot be dropped by accident', () => {
    const page = readCode('app/(consumer)/auth/login/page.tsx');
    assert.match(page, /chooseLoginDestination\(\{ next, destination, hasWorkspace \}\)/);
    assert.doesNotMatch(page, /safeNext && hasWorkspace/);
  });
});
