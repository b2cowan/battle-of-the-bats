/**
 * CLUB TIER 4e, PART 4a: a club's own address at the door. The host cache (never a read per request), what each path on a
 * club's host means, the proxy's answer, and the matcher that keeps www's pages out of it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import { createClubHostCache, routeClubHostPath, type ClubHostEntry } from '../../lib/club-host.ts';
import { clubHostResponse } from '../../lib/club-host-response.ts';
import { OWN_HOST_PATTERN } from '../../lib/own-hosts.ts';

const lynx: ClubHostEntry = { host: 'www.lakeshorelynx.ca', orgId: 'org-1', slug: 'lakeshore-lynx', status: 'connected' };
const bats: ClubHostEntry = { host: 'www.miltonbats.ca', orgId: 'org-2', slug: 'milton-bats', status: 'waiting' };

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe('the host cache reads the table rarely, never per request', () => {
  it('reads once, then answers from memory for every request inside the time-to-live', async () => {
    const c = clock();
    let reads = 0;
    const cache = createClubHostCache({ load: async () => { reads++; return [lynx, bats]; }, now: c.now });
    for (let i = 0; i < 50; i++) assert.equal((await cache.lookup('www.lakeshorelynx.ca'))?.valueOf() === lynx, true);
    assert.equal(reads, 1);
    assert.equal((await cache.lookup('WWW.LakeshoreLynx.ca:443')) === lynx, true, 'port and case do not matter');
  });

  it('reads again after the time-to-live, and only once for a burst', async () => {
    const c = clock();
    let reads = 0;
    const cache = createClubHostCache({ load: async () => { reads++; return [lynx]; }, now: c.now, ttlMs: 60_000 });
    await cache.lookup('www.lakeshorelynx.ca');
    c.advance(61_000);
    await Promise.all(Array.from({ length: 20 }, () => cache.lookup('www.lakeshorelynx.ca')));
    assert.equal(reads, 2);
  });

  it('looks again for an unknown host, but never more often than the gap (a new club is served within seconds; a crawler costs nothing)', async () => {
    const c = clock();
    let rows: ClubHostEntry[] = [bats];
    let reads = 0;
    const cache = createClubHostCache({ load: async () => { reads++; return rows; }, now: c.now, missGapMs: 15_000 });
    assert.equal(await cache.lookup('www.lakeshorelynx.ca'), null);
    assert.equal(reads, 1);
    for (let i = 0; i < 30; i++) await cache.lookup('www.lakeshorelynx.ca'); // all inside the gap
    assert.equal(reads, 1, 'unknown hosts within the gap are answered from memory');
    rows = [bats, lynx];
    c.advance(16_000);
    assert.equal(await cache.lookup('www.lakeshorelynx.ca'), lynx, 'once the gap has passed, the new club is found');
    assert.equal(reads, 2);
  });

  it('keeps serving what it remembers when a read fails, and says "unavailable" only when it knows nothing', async () => {
    const c = clock();
    let fail = false;
    const cache = createClubHostCache({ load: async () => { if (fail) throw new Error('down'); return [lynx]; }, now: c.now, ttlMs: 60_000, missGapMs: 1000 });
    assert.equal(await cache.lookup('www.lakeshorelynx.ca'), lynx);
    fail = true;
    c.advance(120_000);
    assert.equal(await cache.lookup('www.lakeshorelynx.ca'), lynx, 'a stale answer beats taking every club down for a blip');

    const cold = createClubHostCache({ load: async () => { throw new Error('down'); }, now: c.now });
    assert.equal(await cold.lookup('www.lakeshorelynx.ca'), 'unavailable');
  });

  it('answers by slug for the page layer', async () => {
    const cache = createClubHostCache({ load: async () => [lynx, bats] });
    assert.equal(await cache.forSlug('lakeshore-lynx'), lynx);
    assert.equal(await cache.forSlug('nobody'), null);
  });
});

describe('what a path on a club\'s own address means', () => {
  const S = 'lakeshore-lynx';
  const r = (p: string) => routeClubHostPath(S, p);

  it('serves the club\'s own pages from under its name', () => {
    assert.deepEqual(r('/'), { kind: 'rewrite', to: '/lakeshore-lynx' });
    assert.deepEqual(r('/teams'), { kind: 'rewrite', to: '/lakeshore-lynx/teams' });
    assert.deepEqual(r('/teams/13u-aa/tryouts'), { kind: 'rewrite', to: '/lakeshore-lynx/teams/13u-aa/tryouts' });
    assert.deepEqual(r('/spring-classic/schedule'), { kind: 'rewrite', to: '/lakeshore-lynx/spring-classic/schedule' });
    for (const section of ['about', 'archives', 'league', 'news', 'register', 'results', 'rules', 'schedule', 'standings', 'teams', 'tryouts']) {
      assert.equal(r(`/${section}`).kind, 'rewrite', section);
    }
  });

  it('never serves an operator or platform surface, whatever follows', () => {
    for (const p of ['/admin', '/admin/org/settings', '/coaches', '/coaches/teams/1', '/scorekeeper', '/check-in', '/official',
      '/auth/login', '/platform-admin', '/my', '/account', '/discover', '/scores', '/start/tournament', '/pricing', '/help/own-address']) {
      assert.deepEqual(r(p), { kind: 'notfound' }, p);
    }
    assert.deepEqual(r('/spring-classic/admin'), { kind: 'notfound' }, 'an operator word under a tournament slug');
    assert.deepEqual(r('/teams/coaches'), { kind: 'notfound' });
  });

  it('drops the club\'s own name from the path, so a link that still carries it keeps working', () => {
    assert.deepEqual(r('/lakeshore-lynx'), { kind: 'redirect', to: '/' });
    assert.deepEqual(r('/lakeshore-lynx/teams/13u-aa'), { kind: 'redirect', to: '/teams/13u-aa' });
    assert.deepEqual(r('/Lakeshore-Lynx/teams'), { kind: 'redirect', to: '/teams' });
  });

  it('leaves static files and the public data routes alone, and shuts the operator ones', () => {
    for (const p of ['/_next/static/chunks/a.js', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/manifest.json', '/sw.js',
      '/icons/fl-192.png', '/stock-logos/x.svg', '/api/register', '/api/consumer/follows', '/api/public/anything']) {
      assert.deepEqual(r(p), { kind: 'pass' }, p);
    }
    for (const p of ['/api/admin/org-settings', '/api/platform-admin/x', '/api/billing/portal', '/api/coaches/basic-teams', '/api/dev/seed']) {
      assert.deepEqual(r(p), { kind: 'notfound' }, p);
    }
  });

  it('a tournament\'s manifest.webmanifest is the club\'s route, not a static file', () => {
    assert.deepEqual(r('/spring-classic/manifest.webmanifest'), { kind: 'rewrite', to: '/lakeshore-lynx/spring-classic/manifest.webmanifest' });
  });
});

describe('the proxy\'s answer', () => {
  const cache = createClubHostCache({ load: async () => [lynx] });
  const req = (host: string, path: string) =>
    new NextRequest(`https://${host}${path}`, { headers: { host } });

  it('rewrites the club\'s pages and sends no session work anywhere', async () => {
    const res = await clubHostResponse(req('www.lakeshorelynx.ca', '/teams'), cache);
    assert.equal(res.headers.get('x-middleware-rewrite'), 'https://www.lakeshorelynx.ca/lakeshore-lynx/teams');
    assert.ok(res.headers.get('x-request-id'));
  });

  it('is a 404 for a host nobody holds, a 308 for the club\'s name in the path, a 404 for the operator surface', async () => {
    assert.equal((await clubHostResponse(req('www.nobody.ca', '/'), cache)).status, 404);
    const redirect = await clubHostResponse(req('www.lakeshorelynx.ca', '/lakeshore-lynx/teams'), cache);
    assert.equal(redirect.status, 308);
    assert.equal(new URL(redirect.headers.get('location')!).pathname, '/teams');
    const withQuery = await clubHostResponse(req('www.lakeshorelynx.ca', '/lakeshore-lynx/teams?year=2026'), cache);
    assert.equal(new URL(withQuery.headers.get('location')!).search, '?year=2026', 'the query survives the hop');
    assert.equal(new URL(withQuery.headers.get('location')!).host, 'www.lakeshorelynx.ca', 'the hop stays on the club\'s own host');
    assert.equal((await clubHostResponse(req('www.lakeshorelynx.ca', '/admin'), cache)).status, 404);
  });

  it('is a 503 with a retry hint when the table cannot be read and nothing is remembered', async () => {
    const cold = createClubHostCache({ load: async () => { throw new Error('down'); } });
    const res = await clubHostResponse(req('www.lakeshorelynx.ca', '/'), cold);
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('retry-after'), '30');
  });
});

describe('the matcher keeps www\'s own pages out of the proxy', () => {
  it('carries the own-host pattern as a literal, identical to OWN_HOST_PATTERN, and sits after the sandbox cookie entry', async () => {
    const src = await readFile(new URL('../../proxy.ts', import.meta.url), 'utf8');
    const matcher = src.slice(src.indexOf('matcher: ['));
    const at = matcher.indexOf("missing: [{ type: 'host', value: ");
    assert.ok(at > 0, 'the matcher must carry a club-host entry');
    const literal = matcher.slice(at).split("value: ")[1].split(" }]")[0];
    const value = new Function(`return ${literal}`)() as string;
    assert.equal(value, OWN_HOST_PATTERN, 'the matcher\'s host literal must equal OWN_HOST_PATTERN');
    assert.ok(at > matcher.indexOf("has: [{ type: 'cookie', key: '"), 'it must come after the cookie entry (the sandbox test slices the matcher up to it)');
  });

  it('the proxy answers a club host before any session work', async () => {
    const src = await readFile(new URL('../../proxy.ts', import.meta.url), 'utf8');
    const branch = src.indexOf('clubHostResponse(request)');
    assert.ok(branch > 0);
    for (const later of ['createServerClient(', 'sandboxExitResponse(request)', 'demoOrgSlugForBlockedWrite(']) {
      assert.ok(src.indexOf(later, branch) > branch, `${later} must come after the club-host branch`);
    }
  });
});
