/**
 * What Stripe's sign-up is handed already answered (walk 2026-10-25): the club's website only when Stripe's reviewers can
 * open it, else a description; never the industry; and nothing in it can block setting up payouts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reachableSiteUrl } from '../../lib/reachable-site-url';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

describe('the club website handed to Stripe', () => {
  it('a public https address goes, without a trailing slash', () => {
    assert.equal(reachableSiteUrl('https://www.fieldlogichq.ca/lakeshore-lynx'), 'https://www.fieldlogichq.ca/lakeshore-lynx');
    assert.equal(reachableSiteUrl('https://www.lakeshorelynx.ca/'), 'https://www.lakeshorelynx.ca');
  });

  it('a dev machine, a bare IP, plain http, a port, a login, a reserved name or junk never goes', () => {
    for (const bad of ['http://localhost:3000/uat-rep-club', 'https://localhost/x', 'http://www.lakeshorelynx.ca', 'https://192.168.1.4/x',
      'https://uat-rep-club.local', 'https://[::1]/x', 'https://www.lakeshorelynx.ca:8443/x', 'https://me:pw@www.lakeshorelynx.ca',
      'https://club.test', 'https://club.example', 'https://svc.internal', 'not a url', '', null, undefined]) {
      assert.equal(reachableSiteUrl(bad), null, String(bad));
    }
  });
});

describe('what Stripe’s form is handed', () => {
  const connect = read('lib/stripe-connect.ts');
  const profile = read('lib/online-payment-profile.ts');
  const route = read('app/api/admin/payouts/route.ts');
  const prefill = /export async function prefillClubProfile[\s\S]*?\n}\n/.exec(connect)?.[0] ?? '';

  it('the website when there is one, else the description; the industry is never filled in (owner 2026-10-25)', () => {
    assert.match(prefill, /profile\.businessUrl \? \{ business_url: profile\.businessUrl \} : \{ product_description: profile\.productDescription \}/);
    assert.doesNotMatch(connect, /\bmcc\b/);
  });

  it('a refused website falls back to the description, which is always to hand (/review 2026-10-25)', () => {
    assert.match(prefill, /await send\(\{ product_description: profile\.productDescription \}\)/);
    assert.match(profile, /productDescription: PAYOUTS_WORDS\.stripeProductDescription\(org\.name\) \}/);
  });

  it('nothing in it can block setting up payouts: every failure is caught', () => {
    assert.match(route, /stripeProfileFor\(ctx\.org, process\.env\.NEXT_PUBLIC_APP_URL \?\? ''\)\.catch\(\(\) => null\)/);
    assert.equal((prefill.match(/catch \(/g) ?? []).length, 2);
    assert.doesNotMatch(prefill, /throw/);
  });

  it('only an open public site on a plan that carries it, and a club address only while connected', () => {
    assert.match(profile, /if \(!isPublicClubSiteOpen\(org\) \|\| !hasModuleEntitlement\(org, 'module_public_site'\)\) return null;/);
    assert.match(profile, /host\.status === 'connected'/);
  });

  it('our own address comes from the app setting, never the request', () => {
    assert.doesNotMatch(route, /stripeProfileFor\([^)]*origin/);
  });
});
