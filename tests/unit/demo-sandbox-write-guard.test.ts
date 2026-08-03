import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldBlockSandboxWrite, demoOrgSlugFromRequest, isWriteMethod,
  assertNotDemoOrg, sandboxRejectionResponse, SANDBOX_REJECTION_BODY,
} from '../../lib/demo-guard.ts';
import { DEMO_ORGS, isDemoOrgSlug, isDemoOrganizerEmail, getDemoOrgByKind } from '../../lib/demo-org.ts';

/**
 * The sandbox write block is the promise the whole "See it live" demo rests on: a stranger with
 * no login is handed a real organizer session, and the only thing standing between them and our
 * data is this guard. So it gets a contract test, not a smoke test.
 *
 * These tests deliberately assert the guard's behaviour through the SAME entry point proxy.ts
 * calls, using real request shapes taken from the app's routing table.
 */

const DEMO_SLUG = getDemoOrgByKind('tournament')!.slug;
const REAL_SLUG = 'some-real-club';

const url = (path: string) => new URL(`https://app.fieldlogichq.ca${path}`);

describe('demo org allow-list', () => {
  test('is hardcoded and non-empty', () => {
    assert.ok(DEMO_ORGS.length >= 1);
  });

  test('recognises its own slugs and nothing else', () => {
    assert.equal(isDemoOrgSlug(DEMO_SLUG), true);
    assert.equal(isDemoOrgSlug(REAL_SLUG), false);
    assert.equal(isDemoOrgSlug(''), false);
    assert.equal(isDemoOrgSlug(null), false);
    assert.equal(isDemoOrgSlug(undefined), false);
  });

  test('normalises case and whitespace, because slugs arrive from URLs', () => {
    assert.equal(isDemoOrgSlug(DEMO_SLUG.toUpperCase()), true);
    assert.equal(isDemoOrgSlug(`  ${DEMO_SLUG}  `), true);
  });

  test('a near-miss slug is NOT treated as the demo org', () => {
    assert.equal(isDemoOrgSlug(`${DEMO_SLUG}-2`), false);
    assert.equal(isDemoOrgSlug(DEMO_SLUG.slice(0, -1)), false);
  });

  test('every demo contact is an unreachable example.com address', () => {
    for (const org of DEMO_ORGS) {
      assert.match(org.organizerEmail, /@example\.com$/);
    }
  });

  test('only the registered demo account is recognised as a demo organizer', () => {
    assert.equal(isDemoOrganizerEmail(getDemoOrgByKind('tournament')!.organizerEmail), true);
    assert.equal(isDemoOrganizerEmail('owner@a-real-club.ca'), false);
    assert.equal(isDemoOrganizerEmail(null), false);
  });
});

describe('write-method classification', () => {
  test('reads pass, everything else is a write', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get', 'head']) {
      assert.equal(isWriteMethod(method), false, `${method} should read`);
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post', 'delete']) {
      assert.equal(isWriteMethod(method), true, `${method} should be a write`);
    }
  });
});

describe('org identification from a request URL', () => {
  test('org page routes — slug in the first segment', () => {
    assert.equal(demoOrgSlugFromRequest(url(`/${DEMO_SLUG}/admin/tournaments/schedule`)), DEMO_SLUG);
    assert.equal(demoOrgSlugFromRequest(url(`/${REAL_SLUG}/admin/tournaments/schedule`)), null);
  });

  test('admin API — slug in the orgSlug query parameter', () => {
    assert.equal(demoOrgSlugFromRequest(url(`/api/admin/games?orgSlug=${DEMO_SLUG}`)), DEMO_SLUG);
    assert.equal(demoOrgSlugFromRequest(url(`/api/admin/games?orgSlug=${REAL_SLUG}`)), null);
  });

  test('org-scoped API families — slug in the path, whatever the family', () => {
    // These are real route shapes; the guard must not depend on knowing the family name.
    for (const path of [
      `/api/coaches/${DEMO_SLUG}/teams`,
      `/api/scorekeeper/${DEMO_SLUG}/games`,
      `/api/official/${DEMO_SLUG}/assignments`,
      `/api/some-family-invented-next-year/${DEMO_SLUG}/thing`,
    ]) {
      assert.equal(demoOrgSlugFromRequest(url(path)), DEMO_SLUG, path);
    }
  });

  test('a real org in the path is never mistaken for the demo org', () => {
    assert.equal(demoOrgSlugFromRequest(url(`/api/coaches/${REAL_SLUG}/teams`)), null);
  });

  test('naming a real org alongside the demo org does not dodge the block', () => {
    assert.equal(
      demoOrgSlugFromRequest(url(`/${DEMO_SLUG}/admin/x?orgSlug=${REAL_SLUG}`)),
      DEMO_SLUG,
    );
    assert.equal(
      demoOrgSlugFromRequest(url(`/${REAL_SLUG}/admin/x?orgSlug=${DEMO_SLUG}`)),
      DEMO_SLUG,
    );
  });
});

describe('the block itself', () => {
  test('blocks every write method against the demo org', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(
        shouldBlockSandboxWrite(method, url(`/api/admin/games?orgSlug=${DEMO_SLUG}`)),
        true,
        `${method} must be blocked`,
      );
    }
  });

  test('never blocks a read — the sandbox is fully browsable', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      assert.equal(
        shouldBlockSandboxWrite(method, url(`/api/admin/games?orgSlug=${DEMO_SLUG}`)),
        false,
        `${method} must pass`,
      );
    }
  });

  test('never blocks a real org — a customer is untouched by any of this', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(
        shouldBlockSandboxWrite(method, url(`/api/admin/games?orgSlug=${REAL_SLUG}`)),
        false,
      );
      assert.equal(
        shouldBlockSandboxWrite(method, url(`/${REAL_SLUG}/admin/tournaments/schedule`)),
        false,
      );
    }
  });

  /**
   * ⚠ REGRESSION PIN — this was a live bypass, found by the 2026-08-03 adversarial review.
   *
   * `URL.pathname` keeps `%XX` exactly as sent, but Next decodes each dynamic segment before a
   * handler sees it. So an encoded slug read as "not the demo org" here and as the real demo org
   * there, and the write sailed through the only chokepoint. Verified live at the time: the encoded
   * form returned the route's own 401 instead of this module's 403.
   *
   * Any future change to segment matching must keep every one of these blocked.
   */
  test('cannot be dodged by percent-encoding the slug', () => {
    const encodedVariants = [
      '%72iverdale-minor-ball',   // leading letter encoded
      'riverdale-minor-bal%6C',   // trailing letter encoded
      'riverdale%2Dminor%2Dball', // the hyphens encoded
      'RIVERDALE-MINOR-BALL',     // and casing, which was always handled
    ];
    for (const variant of encodedVariants) {
      assert.equal(
        shouldBlockSandboxWrite('POST', url(`/api/coaches/${variant}/teams/x/dues`)),
        true,
        `${variant} must be blocked`,
      );
    }
  });

  test('a malformed escape cannot crash the guard, and still does not pass as the demo org', () => {
    // decodeURIComponent throws on these; the guard must fall back to the raw segment, which is
    // also what the router will fail to decode — so the two still cannot disagree.
    for (const variant of ['%', '%zz', 'riverdale-minor-ball%']) {
      assert.doesNotThrow(() => shouldBlockSandboxWrite('POST', url(`/api/coaches/${variant}/x`)));
    }
    assert.equal(shouldBlockSandboxWrite('POST', url('/api/coaches/%zz/x')), false);
  });

  test('blocks writes to routes that do not exist yet', () => {
    // The point of a request-layer chokepoint: default-closed for future routes.
    assert.equal(
      shouldBlockSandboxWrite('POST', url(`/api/admin/a-feature-built-next-year?orgSlug=${DEMO_SLUG}`)),
      true,
    );
  });
});

describe('the rejection contract with the client', () => {
  test('carries sandbox:true — the flag the nudge keys off', () => {
    assert.equal(SANDBOX_REJECTION_BODY.sandbox, true);
    assert.ok(SANDBOX_REJECTION_BODY.message.length > 0);
  });

  test('never says "error" or "failed" to the visitor', () => {
    // Nothing failed. The change was never going to be kept, and the banner already said so.
    const message = SANDBOX_REJECTION_BODY.message.toLowerCase();
    assert.ok(!message.includes('error'), message);
    assert.ok(!message.includes('failed'), message);
  });

  test('responds 403 with the sandbox marker header and no caching', async () => {
    const res = sandboxRejectionResponse();
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('X-Sandbox-Blocked'), '1');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    const body = await res.json();
    assert.equal(body.sandbox, true);
  });
});

describe('the body-identified guard (public writes the proxy cannot see)', () => {
  test('refuses a demo org and lets every real org through', async () => {
    const blocked = assertNotDemoOrg(DEMO_SLUG);
    assert.ok(blocked, 'demo org must be refused');
    assert.equal(blocked!.status, 403);
    assert.equal((await blocked!.json()).sandbox, true);

    assert.equal(assertNotDemoOrg(REAL_SLUG), null);
    assert.equal(assertNotDemoOrg(null), null);
    assert.equal(assertNotDemoOrg(undefined), null);
  });

  /**
   * The proxy chokepoint identifies the org from the URL. A handful of PUBLIC write endpoints
   * name their org in the request BODY instead, which middleware cannot read without consuming
   * it — so those routes have to call the guard themselves, and they are the one place the
   * "blocked by default" property does not hold.
   *
   * This list is therefore a DECISION POINT, in the same spirit as the archive allow-lists: a new
   * body-identified public write must be added here deliberately, and the test fails until the
   * route actually carries the guard. Both entries below were found by asking "what can an
   * anonymous visitor POST that names its org in the body?" — registration (found while building
   * the block) and following (found when the owner asked what two simultaneous visitors could do
   * to each other).
   */
  const BODY_IDENTIFIED_PUBLIC_WRITES = [
    'app/api/register/route.ts',
    'app/api/consumer/follows/route.ts',
  ] as const;

  for (const routeFile of BODY_IDENTIFIED_PUBLIC_WRITES) {
    test(`${routeFile} calls the sandbox guard itself`, async () => {
      const { readFile } = await import('node:fs/promises');
      const source = await readFile(new URL(`../../${routeFile}`, import.meta.url), 'utf8');
      assert.ok(
        source.includes('assertNotDemoOrg'),
        `${routeFile} identifies its org from the body, so it must call assertNotDemoOrg — the proxy cannot see it`,
      );
    });
  }

  /**
   * The same decision point, for routes that cannot be guarded by ORG at all.
   *
   * `/api/events/league` takes its org from the body AND falls back to attributing the row to the
   * ACTOR alone — so there is no org for `assertNotDemoOrg` to refuse. The honest invariant there is
   * about the actor: the demo organizer's session must never write anything, anywhere, whatever it
   * names in a body. Found by the 2026-08-03 adversarial review, which reached it with a demo
   * session and wrote a real platform_events row.
   *
   * Adding a route here means the same deliberate decision as the list above.
   */
  const ACTOR_IDENTIFIED_WRITES = [
    'app/api/events/league/route.ts',
  ] as const;

  for (const routeFile of ACTOR_IDENTIFIED_WRITES) {
    test(`${routeFile} refuses the demo organizer as an actor`, async () => {
      const { readFile } = await import('node:fs/promises');
      const source = await readFile(new URL(`../../${routeFile}`, import.meta.url), 'utf8');
      assert.ok(
        source.includes('isDemoOrganizerEmail'),
        `${routeFile} writes on behalf of the ACTOR, so it must refuse the demo organizer — no org exists for the proxy or assertNotDemoOrg to match on`,
      );
    });
  }
});
