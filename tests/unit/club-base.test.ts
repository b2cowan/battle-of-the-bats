/**
 * CLUB TIER 4e, PART 4b: the club's name comes from the route, never from the address, so every parser that expects
 * `/{club}/…` sees it on a club's own address too; and a link is spelled in the address the visitor is on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clubBaseFor, internalPath, orgHref } from '../../lib/club-base.ts';

const S = 'lakeshore-lynx';

describe('the club\'s name, from the route', () => {
  it('on fieldlogichq.ca the path is unchanged', () => {
    for (const p of ['/lakeshore-lynx', '/lakeshore-lynx/teams', '/lakeshore-lynx/spring-classic/schedule']) {
      assert.equal(internalPath(p, S), p);
      assert.equal(clubBaseFor(p, S)?.ownHost, false);
    }
  });

  it('on a club\'s own address the name goes back in front', () => {
    assert.equal(internalPath('/', S), '/lakeshore-lynx');
    assert.equal(internalPath('/teams', S), '/lakeshore-lynx/teams');
    assert.equal(internalPath('/spring-classic/schedule', S), '/lakeshore-lynx/spring-classic/schedule');
    assert.equal(clubBaseFor('/teams', S)?.ownHost, true);
  });

  it('a route that names no club is left alone, on ours or anywhere', () => {
    for (const p of ['/', '/pricing', '/discover', '/auth/login', '/coaches/teams']) {
      assert.equal(internalPath(p, null), p);
      assert.equal(internalPath(p, undefined), p);
      assert.equal(clubBaseFor(p, undefined), null);
    }
  });

  it('a club whose name merely starts like another path is not mistaken for being on its own address', () => {
    assert.equal(clubBaseFor('/lakeshore-lynx-extra/teams', 'lakeshore-lynx')?.ownHost, true, 'a different first segment is not the club\'s name');
    assert.equal(clubBaseFor('/lakeshore-lynx/teams', 'lakeshore-lynx')?.ownHost, false);
  });
});

describe('a link, spelled in the address the visitor is on', () => {
  const ours = { slug: S, ownHost: false };
  const own = { slug: S, ownHost: true };
  it('keeps the club\'s name on ours and drops it on the club\'s own address', () => {
    assert.equal(orgHref(ours, '/teams'), '/lakeshore-lynx/teams');
    assert.equal(orgHref(own, '/teams'), '/teams');
    assert.equal(orgHref(ours, ''), '/lakeshore-lynx');
    assert.equal(orgHref(own, ''), '/');
    assert.equal(orgHref(ours, '/'), '/lakeshore-lynx');
    assert.equal(orgHref(own, '/'), '/');
    assert.equal(orgHref(own, '/teams/13u-aa/tryouts'), '/teams/13u-aa/tryouts');
  });
});
