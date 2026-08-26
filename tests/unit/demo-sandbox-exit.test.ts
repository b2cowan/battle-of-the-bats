import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDemoOrgByKind } from '../../lib/demo-org.ts';
import { SEE_IT_LIVE_PATH, SEE_IT_LIVE_COACHES_PATH } from '../../lib/sandbox-door.ts';
import {
  SANDBOX_MARKER_COOKIE, isSandboxSurfacePath, isSupabaseAuthCookieName, requestIsLeavingTheSandbox,
} from '../../lib/sandbox-exit-rule.ts';

/**
 * THE demo is self-contained (owner ruling 2026-08-26).
 *
 * A "See it live" session is a real session for a fictional account, so every "is anyone signed
 * in?" question outside the sandbox used to answer *yes, as the demo coach* — a workspace card and
 * a COACHES PORTAL door on Discover, a fictional person's /account, their follows in the visitor's
 * browser, and the demo's own "Start free" CTA landing on the sign-up form still carrying it.
 *
 * The rule that fixed it (`lib/sandbox-exit.ts`) is one line of behaviour — leaving the demo world
 * ends the demo — and every way it could quietly STOP firing is a way the leak comes back on a
 * screen nobody is looking at. That is what this file pins. Two of the three things it must never
 * do are unfalsifiable in a unit test (they are about a live Supabase session), so they are pinned
 * as source guards rather than left unpinned.
 */

const coachDemo = getDemoOrgByKind('coach')!;
const tournamentDemo = getDemoOrgByKind('tournament')!;

let exitSourceCache: string | null = null;
async function exitSource(): Promise<string> {
  exitSourceCache ??= await readFile(new URL('../../lib/sandbox-exit.ts', import.meta.url), 'utf8');
  return exitSourceCache;
}

const leaving = (over: Partial<Parameters<typeof requestIsLeavingTheSandbox>[0]> = {}) =>
  requestIsLeavingTheSandbox({
    method: 'GET', pathname: '/discover', hasSandboxMarker: true, isPrefetch: false,
    isNavigation: true, ...over,
  });

describe('what counts as inside the demo world', () => {
  test('a demo org own pages are inside — both sandboxes, fan side and operator side', () => {
    assert.equal(isSandboxSurfacePath(tournamentDemo.landingPath), true);
    assert.equal(isSandboxSurfacePath(coachDemo.landingPath), true);
    assert.equal(isSandboxSurfacePath(`/${coachDemo.slug}/coaches/teams/x/money`), true);
  });

  test('the doors are inside — pressing one must never end the session it just established', () => {
    assert.equal(isSandboxSurfacePath(SEE_IT_LIVE_PATH), true);
    assert.equal(isSandboxSurfacePath(SEE_IT_LIVE_COACHES_PATH), true);
    assert.equal(isSandboxSurfacePath('/see-it-live/coaches/switch'), true);
  });

  test('the main app is outside — including the surfaces that leaked', () => {
    for (const path of ['/discover', '/account', '/following', '/scores', '/chat', '/auth/signup', '/']) {
      assert.equal(isSandboxSurfacePath(path), false, `${path} must be outside the demo`);
    }
  });

  test('a percent-encoded demo slug is still inside — the ROUTER decodes, so this must too', () => {
    // The write block was fixed this way in the 2026-08-03 review; the leave-the-demo rule was
    // written three weeks later without it. Undecoded, "%72iverdale-ridge" reads as a stranger
    // and the demo ends under a visitor who never left it.
    assert.equal(isSandboxSurfacePath(`/${coachDemo.slug.replace('r', '%72')}/coaches`), true);
  });

  test('a REAL org whose slug merely starts like a demo slug is outside', () => {
    // Prefix matching would hand a live customer's org the sandbox's exemptions. Segment-keyed.
    assert.equal(isSandboxSurfacePath(`/${coachDemo.slug}-academy/coaches`), false);
  });
});

describe('when the rule fires', () => {
  test('a page visit outside the demo, carrying the marker, ends the demo', () => {
    assert.equal(leaving(), true);
    assert.equal(leaving({ pathname: '/auth/signup' }), true); // the demo's own CTA
  });

  test('a browser that never opened a sandbox is never touched', () => {
    assert.equal(leaving({ hasSandboxMarker: false }), false);
  });

  test('a link PREFETCH is not a visit', () => {
    // Next prefetches on hover: a sign-up link scrolling into view must not close the sandbox
    // under a visitor who is still standing in it.
    assert.equal(leaving({ isPrefetch: true }), false);
  });

  test('the demo own screens keep working — data calls never decide this', () => {
    assert.equal(leaving({ pathname: '/api/coaches/riverdale-ridge/teams' }), false);
    assert.equal(leaving({ pathname: '/api/sandbox/switch-coach', method: 'POST' }), false);
  });

  test('⚠ A FAVICON IS NOT A VISIT — the demo must not end its own session', () => {
    // The defect this pins was real and reproduced: every page pulls icons, a web manifest and
    // the service-worker script from the site ROOT, as same-origin GETs carrying the same
    // cookies. Judged by path alone each one looks like "outside the demo", so the demo tore its
    // own session down moments after the door opened, while the visitor sat on the page that had
    // just asked for its favicon. Only a NAVIGATION counts.
    for (const asset of ['/favicon.svg', '/sw.js', '/manifest.json', '/icons/pwa-192.png', '/robots.txt']) {
      assert.equal(leaving({ pathname: asset, isNavigation: false }), false, `${asset} is not a visit`);
    }
    // …and the same paths ARE a visit when the visitor actually typed one in.
    assert.equal(leaving({ pathname: '/robots.txt', isNavigation: true }), true);
  });

  test('only GET — the bounce would discard a POST body', () => {
    assert.equal(leaving({ method: 'POST' }), false);
  });

  test('standing INSIDE the demo never ends it', () => {
    assert.equal(leaving({ pathname: coachDemo.landingPath }), false);
    assert.equal(leaving({ pathname: SEE_IT_LIVE_COACHES_PATH }), false);
  });
});

describe('the three things the rule must never do', () => {
  test('never ends a session without checking the address against the allow-list first', async () => {
    const src = await exitSource();
    const checkAt = src.indexOf('isDemoOrganizerEmail(session?.email)');
    const expiryAt = src.indexOf('isSupabaseAuthCookieName(cookie.name)');
    assert.ok(checkAt > 0 && expiryAt > 0, 'both the check and the expiry must exist');
    assert.ok(checkAt < expiryAt, 'the allow-list check must precede any auth-cookie expiry');
  });

  test('never calls signOut — one auth user is shared by every visitor in the demo', async () => {
    // supabase-js defaults to scope 'global', which would eject every other prospect standing in
    // the sandbox at that moment. This rule forgets cookies in ONE browser and calls nothing.
    const src = await exitSource();
    // Matches a CALL, not the prose above it explaining why there isn't one.
    assert.ok(!src.includes('.signOut('), 'the exit rule must not sign anybody out server-side');
  });

  test('never reads the session unless the marker is there to justify it', async () => {
    // The read is the only cost this rule imposes; a real customer must never pay it.
    assert.equal(leaving({ hasSandboxMarker: false, pathname: '/account' }), false);
    const src = await exitSource();
    assert.ok(
      src.indexOf('if (!leaving) return null;') < src.indexOf('await currentSessionUser'),
      'the decision must gate the session read',
    );
  });
});

describe('the wiring that makes the rule reachable', () => {
  test('every door sets the marker, because the ONE place they all funnel through does', async () => {
    // A new door that forgot it would work perfectly and leak silently — the whole reason the
    // cookie is written where the session is written.
    const src = await readFile(new URL('../../lib/demo-session.ts', import.meta.url), 'utf8');
    assert.ok(src.includes('SANDBOX_MARKER_COOKIE'), 'attachDemoSession must set the marker');
  });

  test('the proxy sees EVERY route for a marked browser, by condition and not by list', async () => {
    // The rule is dead code on a route the proxy never sees, and the matcher is an ALLOW-LIST —
    // which is exactly how the leak reached Discover: the request layer did not run there. An
    // enumerated list of tabs would fix the screens that already leaked and leave the next one to
    // leak, so the reach is a cookie CONDITION over the whole app.
    const proxySrc = await readFile(new URL('../../proxy.ts', import.meta.url), 'utf8');
    const matcher = proxySrc.slice(proxySrc.indexOf('matcher: ['));
    const hasAt = matcher.indexOf("has: [{ type: 'cookie', key: '");
    const key = matcher.slice(hasAt).split("key: '")[1]?.split("'")[0];
    const source = matcher.slice(0, hasAt).split("source: '").pop()?.split("'")[0];
    assert.ok(hasAt > 0, 'the proxy must carry a marker-gated catch-all matcher entry');

    // ⚠ Next IGNORES a variable in matcher config (it must be statically analyzable) — so the
    // cookie name is a literal there, and a rename that missed it would not fail a build. It
    // would silently stop the rule from ever running. This is the pin.
    assert.equal(key, SANDBOX_MARKER_COOKIE, 'matcher cookie key must be the marker cookie');

    // Data routes keep their own fast path, and static assets are not visits.
    assert.ok(source?.includes('(?!api|_next/static|_next/image'), 'catch-all must skip data + static');

    // And the demo's own screens must not have been handed proxy work along the way.
    assert.ok(
      proxySrc.includes('isSandboxSurfacePath(pathname)'),
      'the proxy must short-circuit inside the sandbox rather than buying it a session round-trip',
    );
  });

  test('a NAVIGATION is a document request, and an RSC fetch is deliberately not one', async () => {
    // next@16.3.0 sends a background prefetch as an RSC fetch with NO prefetch header for one of
    // its strategies — indistinguishable from a real client-side navigation. Counting RSC as a
    // visit would let a link scrolling into view end a demo somebody is still using, so the
    // request layer owns full page loads only and the browser-side half owns route changes.
    const src = await exitSource();
    assert.ok(src.includes("request.headers.get('sec-fetch-dest')"), 'must judge by Sec-Fetch-Dest');
    assert.ok(src.includes("dest === 'document'"), 'only a document request is a navigation');
    const navFn = src.slice(src.indexOf('function isNavigationRequest'));
    assert.ok(!navFn.slice(0, navFn.indexOf('\n}')).includes("get('rsc')"), 'RSC must not count as a navigation');
  });

  test('every prefetch shape counts as a prefetch, not just the value 1', async () => {
    // Its segment cache sends '2' and '3' as well (verified in the installed package): an exact
    // match on '1' let a hover read as a visit.
    const src = await exitSource();
    const fn = src.slice(src.indexOf('function isPrefetchRequest'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    assert.ok(!body.includes("=== '1'"), 'must not match only the value 1');
    assert.ok(body.includes("get('next-router-prefetch')"), 'must read the prefetch header');
  });

  test('the marker is not a credential and is not confused for one', () => {
    assert.equal(SANDBOX_MARKER_COOKIE.startsWith('sb-'), false);
    assert.equal(isSupabaseAuthCookieName(SANDBOX_MARKER_COOKIE), false);
  });

  test('knows every shape @supabase/ssr names a session cookie, chunks included', () => {
    assert.equal(isSupabaseAuthCookieName('sb-qcttcboqysynwcdyghil-auth-token'), true);
    assert.equal(isSupabaseAuthCookieName('sb-qcttcboqysynwcdyghil-auth-token.0'), true);
    assert.equal(isSupabaseAuthCookieName('sb-qcttcboqysynwcdyghil-auth-token-code-verifier'), true);
    assert.equal(isSupabaseAuthCookieName('flhq-theme'), false);
  });
});
