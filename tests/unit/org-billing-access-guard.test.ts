/**
 * "A cancelled account stops working" — enforced as a RULE over the source tree, not screen by
 * screen. Owner ruling 2026-08-06.
 *
 * Why this test exists, precisely: the platform-admin cancel dialog has ALWAYS promised that a
 * cancelled org loses its coach portal and its score entry. It never did. The write landed in
 * `subscription_status`, an audit row appeared, the screen said success — and not one of the ~150
 * coach API routes, nor the tournament write routes, ever read that column. The failure was
 * invisible because every surface reported success.
 *
 * The rail (lib/org-billing-access.ts) now fails CLOSED at the one chokepoint every authenticated
 * org route passes through, so a route added next year is covered by doing nothing. The one way to
 * escape it is `allowSuspendedOrg: true` — so THAT is what this test pins. Adding a call site
 * fails the build until the list below is edited, which is the decision point.
 *
 * Before adding an entry, answer: would this still be honest if the cancel dialog listed it under
 * "will shut down"?
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isOrgBillingSuspended, OrgBillingSuspendedError } from '../../lib/org-billing-access.ts';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

/**
 * THE ALLOW-LIST. Every file permitted to reach an authenticated org route while that org's
 * subscription is cancelled, and the reason it earns the exemption.
 *
 * Two shapes, deliberately kept in ONE list so the whole exemption surface is readable at a glance:
 *   • API routes  — answer real requests for a cancelled org.
 *   • Page layers — resolve the org so a SERVER COMPONENT can render the cancelled state instead of
 *     a 500. These grant no data: the API rail stays closed underneath them.
 */
const ALLOWED_SUSPENDED_ORG_FILES: Record<string, string> = {
  // ── The comeback path. Without these a cancelled org can never pay us again. ──────────────
  'app/api/billing/cancel/confirm/route.ts': 'billing — comeback path',
  'app/api/billing/cancel/preflight/route.ts': 'billing — comeback path',
  'app/api/billing/create-checkout/route.ts': 'billing — THE resubscribe call',
  'app/api/billing/downgrade/confirm/route.ts': 'billing — comeback path',
  'app/api/billing/downgrade/preflight/route.ts': 'billing — comeback path',
  'app/api/billing/mock-apply/route.ts': 'billing — dev/mock checkout parity',
  'app/api/billing/portal/route.ts': 'billing — Stripe portal door',
  'app/api/billing/setup-payment-method/route.ts': 'billing — card re-entry',
  'app/api/admin/members/count/route.ts': 'read the billing PAGE itself makes',
  'app/api/admin/org/founding-season-status/route.ts': 'read the billing PAGE itself makes',

  // ── Identity / nav. The app shell cannot render at all without these, including the shell
  //    that hosts the billing page. Neither returns org DATA — only who and where you are. ──
  'app/api/auth/me/route.ts': 'identity — app shell cannot render without it',
  'app/api/org-context/route.ts': 'identity — app shell cannot render without it',

  // ── A cancelled customer must still be able to reach us. ──────────────────────────────────
  'app/api/feedback/route.ts': 'support door — never close the way to contact us',

  // ── Page layers: render the cancelled state instead of a 500. No data granted. ────────────
  // (the coaches LAYOUT is not listed: it opts out via getCoachPortalAuth below, not directly)
  'lib/coach-portal-request.ts': 'page resolver — coaches layout renders SubscriptionEndedWall',
  'app/[orgSlug]/scorekeeper/layout.tsx': 'page layer — renders SubscriptionEndedWall',
  'app/[orgSlug]/check-in/layout.tsx': 'page layer — renders SubscriptionEndedWall',
  'app/[orgSlug]/admin/layout.tsx': 'page layer — HOSTS the billing page; CancellationGuard redirects',
  'app/[orgSlug]/admin/org/layout.tsx': 'page layer — direct parent of the billing page',
  'app/[orgSlug]/admin/rep-teams/layout.tsx': 'page layer — its own module gate redirects out',
};

const SCAN_ROOTS = ['app', 'lib', 'components'];
const SCAN_EXTENSIONS = ['.ts', '.tsx'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.some(ext => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

function repoRelative(absolute: string): string {
  return absolute.slice(REPO_ROOT.length + 1).split('\\').join('/');
}

describe('billing rail — a cancelled subscription stops working', () => {
  it('suspends exactly on canceled, and never on past_due', () => {
    assert.equal(isOrgBillingSuspended({ subscriptionStatus: 'canceled' }), true);

    // ⚠ LOAD-BEARING. A failed payment writes 'past_due', never 'canceled' — only Stripe giving up
    // after its full retry window produces 'canceled'. That is precisely what makes an immediate
    // hard-block safe: the dunning path gets a real grace window at past_due first. If this
    // assertion is ever "fixed" to suspend past_due, a customer whose card merely expired is
    // locked out of a product they are still paying for.
    for (const status of ['active', 'trialing', 'past_due'] as const) {
      assert.equal(
        isOrgBillingSuspended({ subscriptionStatus: status }), false,
        `${status} must keep working — only 'canceled' suspends`,
      );
    }
  });

  it('carries the org slug on the thrown error so 402s are attributable', () => {
    const err = new OrgBillingSuspendedError('milton-bats');
    assert.equal(err.billingSuspended, true);
    assert.equal(err.orgSlug, 'milton-bats');
    assert.ok(err instanceof Error);
  });

  it('THE GUARD: only approved files may opt out of the rail', () => {
    const offenders: string[] = [];
    for (const root of SCAN_ROOTS) {
      for (const file of walk(join(REPO_ROOT, root))) {
        const rel = repoRelative(file);
        // The rail's own module and this test define the flag; they are not call sites.
        if (rel === 'lib/api-auth.ts' || rel === 'lib/org-billing-access.ts') continue;
        if (!readFileSync(file, 'utf8').includes('allowSuspendedOrg')) continue;
        if (!(rel in ALLOWED_SUSPENDED_ORG_FILES)) offenders.push(rel);
      }
    }

    assert.deepEqual(
      offenders, [],
      'These files opt out of the billing rail without approval. A cancelled organization would ' +
      'keep using them — which is exactly the defect this rail exists to close. If the exemption ' +
      'is genuinely right, add it to ALLOWED_SUSPENDED_ORG_FILES with the reason. Ask first: ' +
      'would this still be honest if the cancel dialog listed it under "will shut down"?',
    );
  });

  it('the allow-list has no stale entries (every approved file still opts out)', () => {
    // A stale entry is not harmless: it silently pre-approves a future file at that exact path.
    const stale = Object.keys(ALLOWED_SUSPENDED_ORG_FILES).filter(rel => {
      try {
        return !readFileSync(join(REPO_ROOT, rel), 'utf8').includes('allowSuspendedOrg');
      } catch {
        return true; // deleted or moved
      }
    });
    assert.deepEqual(stale, [], 'Remove these from ALLOWED_SUSPENDED_ORG_FILES — they no longer opt out.');
  });

  it('the coach portal has no OTHER way in — every org-scoped coach route rides the rail', () => {
    // The original defect, restated as a rule: not one of the org-scoped coach routes consulted
    // billing. They are covered now because `getAuthContext` gates by default — so the thing worth
    // protecting is that they keep resolving the user THROUGH it rather than some private path.
    //
    // Six rails are accepted. Five are shared resolvers/factories that each reach getAuthContext
    // with `requireOrgSlug: true` — verified individually, file:line, so this list is evidence
    // rather than assumption. A route riding any of them is on the rail transitively.
    const RAILS = [
      'getAuthContext',              // the chokepoint itself, incl. the ~53 hand-declared resolvers
      'resolveCoachSeasonRead',      // lib/coach-season-read.ts:66      → getAuthContext
      'resolveLiveCoachTeamContext', // lib/coach-route-context.ts:49    → getAuthContext
      'resolveCoachTeamAssignment',  // lib/coach-route-context.ts:49    → getAuthContext
      'resolveFamilyCoachContext',   // lib/family-coach-route.ts:42     → getAuthContext
      'coach-tag-routes',            // the tag route FACTORY; rides the two resolvers above
    ];

    // ⚠ SCOPE LIMIT, STATED SO IT IS NOT MISTAKEN FOR COVERAGE: only `[orgSlug]` routes. The FREE
    // (Basic) coach portal — /api/coaches/basic-teams, /teams/[basicTeamId], /tournaments — is
    // user-scoped, not org-scoped: those teams belong to a person, not to a paying organization,
    // so there is no subscription to cancel and the rail correctly does not apply. Keeping
    // basic_coach_* and rep_* separate is a standing architecture decision, not an oversight here.
    const orgScopedCoachRoutes = walk(join(REPO_ROOT, 'app', 'api', 'coaches', '[orgSlug]'))
      .filter(f => f.endsWith('route.ts'));
    assert.ok(
      orgScopedCoachRoutes.length > 80,
      `expected the org-scoped coach surface to be scanned, saw ${orgScopedCoachRoutes.length}`,
    );

    const unrailed = orgScopedCoachRoutes
      .filter(f => {
        const src = readFileSync(f, 'utf8');
        return !RAILS.some(rail => src.includes(rail));
      })
      .map(repoRelative);

    assert.deepEqual(
      unrailed, [],
      'These org-scoped coach routes resolve their user off-rail, so the billing gate never sees ' +
      'them — a cancelled club would keep using them. Route through getAuthContext, or through ' +
      'one of the shared coach resolvers that does.',
    );
  });
});
