/**
 * THE PUBLIC DEMOS ARE RETIRED (owner 2026-11-25; plan docs/projects/active/RETIRE_PUBLIC_DEMOS_PLAN.md, Phase 3).
 *
 * What stays is small and deliberate: the two old club names stay reserved (a real club must never be handed a stranger's
 * traffic), robots.txt keeps crawlers off them, and the old public addresses forward to pricing. What must NOT come back is
 * the sandbox machinery: the proxy's write block and cookie matcher, and the files that ran it. These pins fail the build
 * the day one returns, which is the decision point.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readCode, sourceExists } from './_source-code.ts';
import { RESERVED_ORG_SLUGS, RETIRED_DEMO_ORG_SLUGS, isReservedOrgSlug } from '../../lib/reserved-slugs.ts';
import { robotsFor } from '../../lib/robots-rules.ts';
import nextConfig from '../../next.config.ts';

describe('the two retired club names stay unassignable and out of robots.txt', () => {
  it('both are refused by isReservedOrgSlug, in any case and with stray spaces, without joining the route set', () => {
    assert.deepEqual([...RETIRED_DEMO_ORG_SLUGS].sort(), ['riverdale-minor-ball', 'riverdale-ridge']);
    for (const slug of RETIRED_DEMO_ORG_SLUGS) {
      assert.equal(isReservedOrgSlug(slug), true, slug);
      assert.equal(isReservedOrgSlug(` ${slug.toUpperCase()} `), true, `${slug} normalised`);
      assert.equal(RESERVED_ORG_SLUGS.has(slug), false, `${slug} is a name, not a route: RESERVED_ORG_SLUGS is unchanged`);
    }
    assert.equal(isReservedOrgSlug('lakeshore-lynx'), false, 'an ordinary club name is still free');
  });

  it('robots.txt disallows both forms of both names, and no longer names /see-it-live', () => {
    const rules = robotsFor('www.fieldlogichq.ca', 'https://www.fieldlogichq.ca').rules;
    const disallow = (Array.isArray(rules) ? rules[0] : rules).disallow as string[];
    for (const slug of RETIRED_DEMO_ORG_SLUGS) {
      assert.ok(disallow.includes(`/${slug}`), `/${slug}`);
      assert.ok(disallow.includes(`/${slug}/`), `/${slug}/`);
    }
    assert.ok(!disallow.some(p => p.includes('see-it-live')), 'no /see-it-live line');
  });
});

describe('the old public addresses forward to pricing for good', () => {
  it('/demos and /see-it-live/:path* are permanent redirects to /pricing', async () => {
    const redirects = await nextConfig.redirects!();
    for (const source of ['/demos', '/see-it-live/:path*']) {
      const rule = redirects.find(r => r.source === source);
      assert.ok(rule, `${source} is redirected`);
      assert.equal(rule.destination, '/pricing', source);
      assert.equal(rule.permanent, true, source);
    }
  });
});

describe('the sandbox machinery stays gone', () => {
  it('the proxy has no sandbox cookie, write block or exit rule', () => {
    const proxy = readCode('proxy.ts');
    assert.doesNotMatch(proxy, /flhq-in-sandbox|sandboxExitResponse|demoOrgSlugForBlockedWrite|isDemoOrgSlug|X-Sandbox-Blocked/);
  });

  it('the demo libraries, the sandbox chrome, the see-it-live pages and the tick routes are deleted', () => {
    for (const gone of [
      'lib/demo-org.ts', 'lib/demo-org-server.ts', 'lib/demo-guard.ts', 'lib/demo-session.ts', 'lib/demo-tournament.ts',
      'lib/demo-moments.ts', 'lib/demo-sandbox-heartbeat.ts', 'lib/sandbox-chrome.ts', 'lib/sandbox-curation.ts',
      'lib/sandbox-door.ts', 'lib/sandbox-exit.ts', 'lib/sandbox-exit-rule.ts', 'lib/coach-sandbox-refusal.ts',
      'components/sandbox', 'app/see-it-live', 'app/api/sandbox', 'app/demos',
      'app/api/platform-admin/demo-sandbox-tick', 'app/api/platform-admin/coach-sandbox-tick',
    ]) {
      assert.equal(sourceExists(gone), false, `${gone} is back`);
    }
  });
});
