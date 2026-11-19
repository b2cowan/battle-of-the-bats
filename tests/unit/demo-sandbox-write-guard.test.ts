import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldBlockSandboxWrite, demoOrgSlugFromRequest, isWriteMethod,
  assertNotDemoOrg, sandboxRejectionResponse, SANDBOX_REJECTION_BODY, demoBillingRefusal,
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

  // (Routes that write on behalf of the ACTOR alone, with no org to match, were once pinned here — the free League's event route.
  //  That route left with the free League 2026-11-19; the billing writes are a family of their own, swept route by route
  //  below ("every billing write refuses the demo organizer"). A new actor-only write is a deliberate decision to add back.)

  /**
   * The same decision point, for TOKEN-identified writes.
   *
   * `/api/tryout-score/[token]` is a no-account scoring endpoint: the URL names no org and there
   * is no session — the capability token IS the credential, and it resolves to an org id only
   * after a DB lookup. The proxy cannot see it and `assertNotDemoOrg` has no slug to take, so the
   * route resolves the org itself and refuses the demo org via `isDemoOrgId` (fail-closed).
   * Found by the coach-sandbox build (2026-08-04): the coach demo is the first sandbox with a
   * tryout, so it is the first org this route could ever have written to.
   */
  const TOKEN_IDENTIFIED_WRITES = [
    'app/api/tryout-score/[token]/route.ts',
  ] as const;

  for (const routeFile of TOKEN_IDENTIFIED_WRITES) {
    test(`${routeFile} refuses the demo org via its resolved org id`, async () => {
      const { readFile } = await import('node:fs/promises');
      const source = await readFile(new URL(`../../${routeFile}`, import.meta.url), 'utf8');
      assert.ok(
        source.includes('demoOrgSlugForId') && source.includes('sandboxRejectionResponse'),
        `${routeFile} identifies its org from a capability token, so it must resolve and refuse the demo org itself — the proxy cannot see it (slug-resolving, so the rejection carries that sandbox's own copy)`,
      );
    });
  }
});

describe('billing writes and the demo organizer (Board Ready W2 fix D)', () => {
  /**
   * The billing POSTs name their club in the BODY, so the proxy's URL match cannot see them, and the demo organizer holds the
   * billing power: a "See it live" visitor could reach portal, checkout, add-a-card, move, cancel and downgrade on a public
   * demo club (Stripe test objects and demo state only, but real calls). ONE shared refusal, `demoBillingRefusal`, is what
   * every billing write calls. This sweeps `app/api/billing/**` so a billing route written next year fails the build until
   * it refuses — the same default-closed property the proxy gives every other write.
   *
   * The two lists below are DECISION POINTS: a route joins one only by a deliberate call, with its reason.
   */
  const READ_ONLY_POSTS: Record<string, string> = {
    'move/preview': 'a POST only because it carries a body: it prices a move and changes nothing',
    'downgrade/preflight': 'a POST only because it carries a body: it reports what a downgrade would remove and changes nothing',
  };
  const SIGNED_BY_STRIPE: Record<string, string> = {
    webhook: 'Stripe calls it, verified by the webhook signature: no signed-in actor exists to be a demo organizer',
  };

  async function billingRoutes(): Promise<string[]> {
    const { readdir } = await import('node:fs/promises');
    const root = new URL('../../app/api/billing/', import.meta.url);
    const out: string[] = [];
    async function walk(dir: URL, prefix: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) await walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`);
        else if (entry.name === 'route.ts') out.push(prefix.slice(0, -1));
      }
    }
    await walk(root, '');
    return out.sort();
  }

  test('there are billing routes to sweep (the sweep itself is not empty)', async () => {
    const routes = await billingRoutes();
    assert.ok(routes.length >= 15, `found ${routes.length}`);
    for (const name of [...Object.keys(READ_ONLY_POSTS), ...Object.keys(SIGNED_BY_STRIPE)]) {
      assert.ok(routes.includes(name), `${name} is listed as an exception but is not a billing route any more — drop the entry`);
    }
  });

  /** Money routes OUTSIDE app/api/billing that also name their club only in the body (the Stripe Connect payouts setup). */
  const BODY_NAMED_MONEY_ROUTES = [
    'app/api/admin/payouts/route.ts',
    'app/api/admin/payouts/return/route.ts',
  ] as const;

  /** The source without its comments, so a mention in prose can never count as a refusal. */
  function code(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  }
  /** The first thing a handler may do that changes something or talks to Stripe. */
  const SIDE_EFFECT = /\b(supabaseAdmin|stripe|createCheckout|onboardingLink|syncPayoutsAccount)\b|\.(?:insert|update|delete|upsert)\(/;

  /** One failure line per write handler that does not refuse the demo organizer BEFORE it can change anything. */
  function refusalFailures(file: string, source: string): string[] {
    const src = code(source);
    const failures: string[] = [];
    if (/export\s*\{[^}]*\b(?:POST|PUT|PATCH|DELETE)\b/.test(src)) {
      failures.push(`${file} exports a write handler in a form this sweep cannot read — declare it as "export const POST = …"`);
    }
    const starts = [...src.matchAll(/export (?:const|async function|function) (POST|PUT|PATCH|DELETE)\b/g)];
    starts.forEach((m, i) => {
      const body = src.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index : undefined);
      const at = body.search(/\bdemoBillingRefusal\(/);
      if (at < 0) return failures.push(`${file}: ${m[1]} never calls demoBillingRefusal`);
      if (!/if \(demoRefusal\) return demoRefusal;|if \(demoBillingRefusal\(/.test(body)) failures.push(`${file}: ${m[1]} calls demoBillingRefusal but does not return its answer`);
      const effect = body.search(SIDE_EFFECT);
      if (effect >= 0 && effect < at) failures.push(`${file}: ${m[1]} changes something or asks Stripe before it refuses the demo organizer`);
    });
    return failures;
  }

  test('every billing write refuses the demo organizer — returned, and before it can change anything', async () => {
    const { readFile } = await import('node:fs/promises');
    const failures: string[] = [];
    for (const route of await billingRoutes()) {
      if (route in READ_ONLY_POSTS || route in SIGNED_BY_STRIPE) continue;
      const file = `app/api/billing/${route}/route.ts`;
      failures.push(...refusalFailures(file, await readFile(new URL(`../../${file}`, import.meta.url), 'utf8')));
    }
    for (const file of BODY_NAMED_MONEY_ROUTES) {
      const source = await readFile(new URL(`../../${file}`, import.meta.url), 'utf8');
      failures.push(...refusalFailures(file, source));
      // The payouts return is a GET (the proxy lets reads through) that still asks Stripe and writes the account back.
      if (file.endsWith('return/route.ts')) assert.match(code(source), /demoBillingRefusal\(ctx\.user\)/, `${file} must refuse the demo organizer`);
    }
    assert.deepEqual(failures, [], 'every write must call demoBillingRefusal(<the signed-in user>) and return it right after it authenticates');
  });

  test('the sweep itself bites: it rejects a late, an unreturned, a commented-out and a missing refusal', () => {
    const ok = 'export const POST = async () => {\n  const a = await getAuthContext();\n  const demoRefusal = demoBillingRefusal(a.user);\n  if (demoRefusal) return demoRefusal;\n  await supabaseAdmin.from("x").insert({});\n};\n';
    assert.deepEqual(refusalFailures('ok.ts', ok), []);
    assert.equal(refusalFailures('late.ts', 'export const POST = async () => {\n  await stripe.thing();\n  const demoRefusal = demoBillingRefusal(u);\n  if (demoRefusal) return demoRefusal;\n};\n').length, 1);
    assert.equal(refusalFailures('unreturned.ts', 'export const POST = async () => {\n  const demoRefusal = demoBillingRefusal(u);\n  await supabaseAdmin.from("x").insert({});\n};\n').length, 1);
    assert.equal(refusalFailures('comment.ts', 'export const POST = async () => {\n  // demoBillingRefusal(u) goes here\n  await supabaseAdmin.from("x").insert({});\n};\n').length, 1);
    assert.equal(refusalFailures('async.ts', 'export async function PUT() {\n  await supabaseAdmin.from("x").update({});\n}\n').length, 1);
    assert.equal(refusalFailures('named.ts', 'const POST = () => null;\nexport { POST };\n').length, 1);
    // Two handlers: the second must refuse on its own.
    assert.equal(refusalFailures('two.ts', ok + 'export const DELETE = async () => {\n  await supabaseAdmin.from("x").delete();\n};\n').length, 1);
  });

  test('no billing route keeps its own ad-hoc demo check any more (one shared refusal)', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const route of await billingRoutes()) {
      const source = await readFile(new URL(`../../app/api/billing/${route}/route.ts`, import.meta.url), 'utf8');
      assert.ok(!source.includes('isDemoOrganizerEmail'), `app/api/billing/${route}/route.ts — call demoBillingRefusal instead`);
    }
  });

  test("the refusal is the sandbox 403, in that sandbox's own words, for each demo organizer", async () => {
    for (const org of DEMO_ORGS) {
      const res = demoBillingRefusal({ email: org.organizerEmail });
      assert.ok(res, `${org.slug} organizer must be refused`);
      assert.equal(res!.status, 403);
      assert.equal(res!.headers.get('X-Sandbox-Blocked'), '1');
      const body = await res!.json();
      assert.equal(body.sandbox, true);
      assert.match(body.message, org.kind === 'coach' ? /start your own team/ : /start your own tournament/);
    }
    // Case and spaces do not dodge it.
    assert.ok(demoBillingRefusal({ email: `  ${DEMO_ORGS[0].organizerEmail.toUpperCase()} ` }));
  });

  test('everyone else passes untouched', () => {
    assert.equal(demoBillingRefusal({ email: 'owner@a-real-club.ca' }), null);
    assert.equal(demoBillingRefusal({ email: null }), null);
    assert.equal(demoBillingRefusal({}), null);
    assert.equal(demoBillingRefusal(null), null);
    assert.equal(demoBillingRefusal(undefined), null);
  });
});
