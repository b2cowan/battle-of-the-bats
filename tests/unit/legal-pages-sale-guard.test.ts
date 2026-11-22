/**
 * A SALE WITHOUT THE TERMS FAILS VISIBLY — the rule and the census of every route that sells League Plus, Club or
 * Club · Association (On-sale pages S2 `/legal` review; S4 Part 2 added the move and its preview).
 *
 * With the legal pages off, the Terms check passes everyone, so a live sale of the three would take money with no tick and
 * no record. The census fails when a route that sells (opens a Stripe checkout, or moves or prices a move on a subscription)
 * does not ask `legalPagesSaleRefusal` — and, on the move routes, when it asks after the address work.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LEGAL_PAGES_MOVE_ERROR, LEGAL_PAGES_SALE_ERROR, LEGAL_PAGES_UNPUBLISHED, legalPagesSaleRefusal } from '../../lib/legal-pages-sale-guard.ts';

const LIVE = 'sk_live_example';
const TEST = 'sk_test_example';

describe('the rule', () => {
  it('refuses League Plus, Club and Club · Association on a live key while the legal pages are off: 503, checkout’s words', async () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      for (const plan of ['league', 'club', 'club_large']) {
        const refused = legalPagesSaleRefusal(plan, 'test', { mode: 'off', stripeKey: LIVE });
        assert.ok(refused, plan);
        assert.equal(refused.status, 503);
        assert.deepEqual(await refused.json(), { error: LEGAL_PAGES_SALE_ERROR, code: LEGAL_PAGES_UNPUBLISHED });
      }
      // A key that is neither test nor live counts as live here: only a test key is dev.
      assert.ok(legalPagesSaleRefusal('club', 'test', { mode: 'off', stripeKey: '' }));
    } finally {
      console.error = quiet;
    }
    assert.equal(LEGAL_PAGES_SALE_ERROR, 'We can’t start a plan right now. Nothing has been charged. Please try again later or email support@fieldlogichq.ca.');
    // Under a "Move to {plan}?" window it says move (`/marketing`, S4 Part 2); the promise after it is the same.
    const quiet2 = console.error;
    console.error = () => {};
    try {
      const moved = legalPagesSaleRefusal('league', 'test', { mode: 'off', stripeKey: LIVE, sale: 'move' });
      assert.deepEqual(await moved?.json(), { error: LEGAL_PAGES_MOVE_ERROR, code: LEGAL_PAGES_UNPUBLISHED });
    } finally {
      console.error = quiet2;
    }
    assert.equal(LEGAL_PAGES_MOVE_ERROR, 'We can’t move your plan right now. Nothing has been charged. Please try again later or email support@fieldlogichq.ca.');
  });

  it('lets everything else through: the pages published or in preview, a test key, Tournament Plus and the Coaches Portal', () => {
    for (const mode of ['published', 'preview'] as const) assert.equal(legalPagesSaleRefusal('club', 'test', { mode, stripeKey: LIVE }), null, mode);
    assert.equal(legalPagesSaleRefusal('league', 'test', { mode: 'off', stripeKey: TEST }), null, 'a test key is dev');
    for (const plan of ['tournament_plus', 'team', 'tournament', undefined, 'nonsense']) {
      assert.equal(legalPagesSaleRefusal(plan, 'test', { mode: 'off', stripeKey: LIVE }), null, String(plan));
    }
  });
});

/** Every route.ts under app/api, as repo-relative paths. */
function routes(dir = 'app/api'): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routes(path);
    return name === 'route.ts' ? [path.replaceAll('\\', '/')] : [];
  });
}

/** What a selling route looks like: it opens a Stripe checkout, makes or changes a subscription, or moves or prices a move. */
const SELLS = /checkout\.sessions\.create|subscriptions\.(?:create|update)\(|subscriptionSchedules\.(?:create|update)\(|\bapplyMove\(|\bpreviewMove\(/;

/**
 * The shared modules that make or change a subscription, each with why it is not a sale of the three plans or which listed
 * route asks the rule for it. A new one fails the census: decide whether its callers must ask.
 */
const SELLING_LIBS: Record<string, string> = {
  'lib/plan-move.ts': 'the move itself: its customer-facing callers are the move and preview routes, which ask',
  'lib/plan-ending-server.ts': 'cancels, keeps and restores a move down (restore: true) — never sells a plan',
  'lib/billing-setup.ts': 'a setup-mode session that saves a payment method only',
  'lib/stripe-connect.ts': 'families paying a club on the club’s connected account — not a FieldLogicHQ plan',
  'lib/team-org-billing.ts': 'the Premium Coaches Portal’s team add-on — never League Plus or Club',
};

function libFiles(dir = 'lib'): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return libFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path.replaceAll('\\', '/')] : [];
  });
}

/** The routes that sell the three plans, and the call each makes. */
const MUST_ASK: Record<string, RegExp> = {
  'app/api/billing/create-checkout/route.ts': /legalPagesSaleRefusal\(planKey, 'create-checkout'\)/,
  // A move DOWN (Club · Association → Club) sells nothing and is let through; every other move or start asks.
  'app/api/billing/move/route.ts': /moveDirection\(ownPlanOf\(authorized\.org\), toPlan\) === 'down' \? null : legalPagesSaleRefusal\(toPlan, 'billing-move', \{ sale: 'move' \}\)/,
  'app/api/billing/move/preview/route.ts': /moveDirection\(ownPlanOf\(authorized\.org\), toPlan\) === 'down' \? null : legalPagesSaleRefusal\(toPlan, 'billing-move-preview', \{ sale: 'move' \}\)/,
};

/** Routes that sell, but never one of the three — each with its reason. */
const SELLS_NONE_OF_THE_THREE: Record<string, string> = {
  'app/api/billing/create-team-checkout/route.ts': 'sells the Premium Coaches Portal only (planKey is always team)',
};

describe('the census: every route that sells the three plans asks the rule', () => {
  it('a route that sells is either in the list that asks, or named as selling none of the three', () => {
    const selling = routes().filter(path => SELLS.test(readFileSync(path, 'utf8')));
    assert.ok(selling.length >= 3, 'the census found the selling routes');
    for (const path of selling) {
      assert.ok(path in MUST_ASK || path in SELLS_NONE_OF_THE_THREE, `${path} sells a plan: add it to MUST_ASK (and ask legalPagesSaleRefusal) or explain why it never sells League Plus or Club`);
    }
    for (const path of Object.keys(MUST_ASK)) assert.ok(selling.includes(path), `${path} is listed but no longer sells: re-check the census`);
  });

  it('a shared module that makes or changes a subscription is named, with why its sale is covered or is not one of the three', () => {
    const STRIPE_WRITES = /checkout\.sessions\.create|subscriptions\.(?:create|update)\(|subscriptionSchedules\.(?:create|update)\(/;
    const found = libFiles().filter(path => STRIPE_WRITES.test(readFileSync(path, 'utf8')));
    assert.ok(found.includes('lib/plan-move.ts'), 'the census sees the move module');
    for (const path of found) assert.ok(path in SELLING_LIBS, `${path} makes or changes a subscription: add it to SELLING_LIBS with its reason, and make its selling callers ask legalPagesSaleRefusal`);
  });

  it('each one asks it, and returns its answer', () => {
    for (const [path, call] of Object.entries(MUST_ASK)) {
      const code = readFileSync(path, 'utf8');
      assert.match(code, new RegExp(`const unpublished = ${call.source};\\s*if \\(unpublished\\) return unpublished;`), path);
    }
  });

  it('the Coaches Portal checkout really sells only the portal', () => {
    const code = readFileSync('app/api/billing/create-team-checkout/route.ts', 'utf8');
    assert.doesNotMatch(code, /planKey:\s*(?!\s|'team')/, 'every planKey it writes is team');
  });

  it('checkout, the move and its preview ask it before the address work and before Stripe (nothing is touched for a refused sale)', () => {
    for (const path of Object.keys(MUST_ASK)) {
      const code = readFileSync(path, 'utf8');
      const asked = code.indexOf('legalPagesSaleRefusal(', code.indexOf('export const POST'));
      assert.ok(asked > 0, path);
      let seen = 0;
      for (const later of ['requireBillingLocation(', 'checkBillingLocation(', 'ensureStripeCustomer(', 'checkout.sessions.create', 'applyMove(', 'previewMove(']) {
        const at = code.indexOf(later, code.indexOf('export const POST'));
        if (at > 0) { seen += 1; assert.ok(asked < at, `${path}: asked before ${later}`); }
      }
      assert.ok(seen >= 2, `${path}: the address work and the sale were found after the rule (the census lost its landmarks)`);
    }
  });
});
