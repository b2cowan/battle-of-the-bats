/**
 * CLUB TIER 4e, PART 4b: the club's name comes from the route, never from the address, so every parser that expects
 * `/{club}/…` sees it on a club's own address too; and a link is spelled in the address the visitor is on.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clubBaseFor, clubOwnUrl, internalPath, orgHref, stripClubPrefix, wwwHref } from '../../lib/club-base.ts';

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

describe('a path with the club\'s name taken off', () => {
  it('spells a preview card for the club\'s own address, and leaves any other path as it is', () => {
    assert.equal(stripClubPrefix('/lakeshore-lynx/opengraph-image', S), '/opengraph-image');
    assert.equal(stripClubPrefix('/lakeshore-lynx/teams/13u-aa/opengraph-image', S), '/teams/13u-aa/opengraph-image');
    assert.equal(stripClubPrefix('/lakeshore-lynx', S), '/');
    assert.equal(stripClubPrefix('/lakeshore-lynx-extra/x', S), '/lakeshore-lynx-extra/x');
    assert.equal(stripClubPrefix('/somewhere/else', S), '/somewhere/else');
  });
});

describe('a page of the club, as an absolute address on its own host', () => {
  const O = 'https://www.lakeshorelynx.ca';
  it('keeps the club\'s own pages and drops every other club\'s', () => {
    assert.equal(clubOwnUrl(O, S, '/lakeshore-lynx'), `${O}/`);
    assert.equal(clubOwnUrl(O, S, '/lakeshore-lynx/teams/13u-aa'), `${O}/teams/13u-aa`);
    assert.equal(clubOwnUrl(O, S, '/lakeshore-lynx/spring-classic'), `${O}/spring-classic`);
    assert.equal(clubOwnUrl(O, S, '/milton-bats/teams'), null);
    assert.equal(clubOwnUrl(O, S, '/lakeshore-lynx-extra'), null);
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

describe('a page that lives only on FieldLogicHQ', () => {
  const O = 'https://www.fieldlogichq.ca';
  it("is a plain path on our hosts and an absolute address on a club's own address", () => {
    assert.equal(wwwHref({ slug: S, ownHost: false }, O, '/auth/login?next=%2Flakeshore-lynx'), '/auth/login?next=%2Flakeshore-lynx');
    assert.equal(wwwHref(null, O, '/coaches/join'), '/coaches/join');
    assert.equal(wwwHref({ slug: S, ownHost: true }, O, '/auth/login?next=%2Flakeshore-lynx%2Fteams'), 'https://www.fieldlogichq.ca/auth/login?next=%2Flakeshore-lynx%2Fteams');
    assert.equal(wwwHref({ slug: S, ownHost: true }, `${O}/`, '/coaches'), 'https://www.fieldlogichq.ca/coaches');
  });
});
