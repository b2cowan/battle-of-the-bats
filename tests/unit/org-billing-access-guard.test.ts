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
  'lib/tournament-preview.ts': 'page resolver — opts out only to 404 a cancelled org SERVER-side (it does its own isOrgBillingSuspended check)',
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

/**
 * Every scanned source file, read ONCE. The assertions below each need to grep the tree, and
 * walking + re-reading ~1,500 files per assertion is pure waste — the coach-route check in
 * particular scans a subtree the full walk already covered.
 */
const SOURCE_FILES: { rel: string; src: string }[] = SCAN_ROOTS
  .flatMap(root => walk(join(REPO_ROOT, root)))
  .map(file => ({ rel: repoRelative(file), src: readFileSync(file, 'utf8') }));

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

  it('answers 402 with the flag client code keys on, and names the org', () => {
    const err = new OrgBillingSuspendedError('milton-bats');
    assert.ok(err instanceof Error);
    assert.equal(err.orgSlug, 'milton-bats');

    // The HTTP contract, not the class internals: 402 (never 401 — that reads as a dead session
    // and can bounce a signed-in person into a sign-in loop) and `billingSuspended: true`, which
    // is what the client keys on to show the cancelled state instead of an error.
    assert.equal(err.status, 402);
    const res = err.toResponse();
    assert.equal(res.status, 402);
    assert.equal(err.body().billingSuspended, true);
    assert.equal(err.body().orgSlug, 'milton-bats');
  });

  it('THE GUARD: only approved files may opt out of the rail', () => {
    const offenders = SOURCE_FILES
      // The rail's own module and this test define the flag; they are not call sites.
      .filter(f => f.rel !== 'lib/api-auth.ts' && f.rel !== 'lib/org-billing-access.ts')
      .filter(f => f.src.includes('allowSuspendedOrg'))
      .filter(f => !(f.rel in ALLOWED_SUSPENDED_ORG_FILES))
      .map(f => f.rel);

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

  it('THE INVERSE GUARD: every non-exempt caller can survive the throw', () => {
    // The rail throws. That is only safe because every caller either (a) opts out, (b) is wrapped
    // by `withObservability`, which turns the throw into a 402, or (c) catches it itself.
    //
    // Until now that invariant was verified ONCE, by hand, with a grep at build time — the single
    // asymmetry in an otherwise build-enforced design. A page added next quarter that calls
    // getAuthContext directly, forgets the opt-out AND forgets a catch, would throw uncaught during
    // SSR for a cancelled org: no 402, no wall, just an error boundary, reported to observability
    // as an unexpected crash rather than the expected event it is. This makes it fail the build.
    // Scoped to auth resolution reachable from a SERVER COMPONENT — that is where the danger
    // actually lives. API routes are provably safe (100% wrapped, asserted below). A `lib/`
    // resolver is dangerous only when a page or layout imports it, because then the throw happens
    // during SSR with no wrapper above it. That is exactly how lib/tournament-preview.ts was
    // caught: a helper, not a route, imported by the admin preview layout.
    const CALLS = /\bgetAuthContext(WithRole|WithScope)?\s*\(/;
    const serverComponents = SOURCE_FILES.filter(f =>
      f.rel.startsWith('app/') && (f.rel.endsWith('/page.tsx') || f.rel.endsWith('/layout.tsx')));

    const importedByServerComponent = (rel: string) => {
      const moduleName = rel.replace(/^lib\//, '').replace(/\.tsx?$/, '');
      return serverComponents.some(sc => sc.src.includes(`@/lib/${moduleName}`));
    };

    const unsafe = SOURCE_FILES
      .filter(f => f.rel !== 'lib/api-auth.ts' && f.rel !== 'lib/org-billing-access.ts')
      .filter(f => CALLS.test(f.src))
      // Only entry points that render, and the lib resolvers they pull in.
      .filter(f => serverComponents.includes(f) || (f.rel.startsWith('lib/') && importedByServerComponent(f.rel)))
      .filter(f => !(f.rel in ALLOWED_SUSPENDED_ORG_FILES))   // (a) opts out
      .filter(f => !f.src.includes('withObservability'))      // (b) wrapper answers 402
      .filter(f => !f.src.includes('.catch('))                // (c) catches it itself
      .map(f => f.rel);

    assert.deepEqual(
      unsafe, [],
      'These render during SSR and resolve auth without opting out, without a wrapper, and ' +
      'without catching. For a cancelled org the throw escapes uncaught and the person gets an ' +
      'error boundary instead of the billing redirect or the subscription-ended wall. Fix by ' +
      'catching the call, or — for a page layer that must render its own cancelled state — ' +
      'passing allowSuspendedOrg: true and adding it to ALLOWED_SUSPENDED_ORG_FILES.',
    );
  });

  it('a page-layer opt-out must still STOP a cancelled org, not just avoid the throw', () => {
    // The allow-list proves a file opted out deliberately. It says nothing about what the file
    // then DOES — and that gap bit us: lib/tournament-preview.ts opted out to avoid an error
    // boundary, then rendered admin-only tournament data (service-role reads) into SSR HTML for a
    // cancelled org, relying on a CLIENT-side redirect that fires after mount and never fires at
    // all without JS. Opting out is not permission to serve; it is permission to answer nicely.
    //
    // So: a page layer that opts out must visibly handle suspension itself — render the wall, or
    // check the predicate and notFound()/redirect. The two admin layouts are the ruled exception:
    // they host the resubscribe page and delegate to CancellationGuard by design.
    const DELEGATES_TO_CANCELLATION_GUARD = [
      'app/[orgSlug]/admin/layout.tsx',        // hosts the billing page; must render children
      'app/[orgSlug]/admin/org/layout.tsx',    // direct parent of the billing page
      'app/[orgSlug]/admin/rep-teams/layout.tsx', // its own module gate redirects out
    ];
    const HANDLES_SUSPENSION = /isOrgBillingSuspended|suspendedOrgWall|SubscriptionEndedWall/;

    const unhandled = Object.keys(ALLOWED_SUSPENDED_ORG_FILES)
      .filter(rel => !rel.startsWith('app/api/'))                 // API exemptions answer 200 on purpose
      .filter(rel => !DELEGATES_TO_CANCELLATION_GUARD.includes(rel))
      .filter(rel => {
        const file = SOURCE_FILES.find(f => f.rel === rel);
        return file ? !HANDLES_SUSPENSION.test(file.src) : true;
      });

    assert.deepEqual(
      unhandled, [],
      'These page layers opt out of the billing rail but never handle suspension themselves, so a ' +
      'cancelled org is served the page. Either check isOrgBillingSuspended and notFound()/render ' +
      'the wall, or — if the surface genuinely must render for a cancelled org — add it to ' +
      'DELEGATES_TO_CANCELLATION_GUARD with the reason.',
    );
  });

  it('the coach portal has no OTHER way in — every org-scoped coach route rides the rail', () => {
    // The original defect, restated as a rule: not one of the org-scoped coach routes consulted
    // billing. They are covered now because `getAuthContext` gates by default — so the thing worth
    // protecting is that they keep resolving the user THROUGH it rather than some private path.
    //
    // Seven rails are accepted. Six are shared resolvers/factories that each reach getAuthContext
    // with `requireOrgSlug: true` — verified individually, file:line, so this list is evidence
    // rather than assumption. A route riding any of them is on the rail transitively.
    const RAILS = [
      'getAuthContext',              // the chokepoint itself, incl. the ~53 hand-declared resolvers
      'resolveCoachTeamRead',        // lib/coach-team-read.ts:100      → getAuthContext
      'resolveCoachHistoryRead',     // lib/coach-team-read.ts:123      → getAuthContext
      'resolveLiveCoachTeamContext', // lib/coach-route-context.ts:49    → getAuthContext
      'resolveCoachTeamAssignment',  // lib/coach-route-context.ts:49    → getAuthContext
      'resolveFamilyCoachContext',   // lib/family-coach-route.ts:42     → getAuthContext
      'coach-tag-routes',            // the tag route FACTORY; rides the two resolvers above
      // M1 (2026-08-16): the staff routes' shared head-coach gate.
      'requireHeadCoachMembership',  // lib/coach-membership.ts          → getAuthContext (requireOrgSlug: true)
    ];

    // ⚠ SCOPE LIMIT, STATED SO IT IS NOT MISTAKEN FOR COVERAGE: only `[orgSlug]` routes. The FREE
    // (Basic) coach portal — /api/coaches/basic-teams, /teams/[basicTeamId], /tournaments — is
    // user-scoped, not org-scoped: those teams belong to a person, not to a paying organization,
    // so there is no subscription to cancel and the rail correctly does not apply. Keeping
    // basic_coach_* and rep_* separate is a standing architecture decision, not an oversight here.
    const orgScopedCoachRoutes = SOURCE_FILES.filter(f =>
      f.rel.startsWith('app/api/coaches/[orgSlug]/') && f.rel.endsWith('/route.ts'));
    assert.ok(
      orgScopedCoachRoutes.length > 80,
      `expected the org-scoped coach surface to be scanned, saw ${orgScopedCoachRoutes.length}`,
    );

    const unrailed = orgScopedCoachRoutes
      .filter(f => !RAILS.some(rail => f.src.includes(rail)))
      .map(f => f.rel);

    assert.deepEqual(
      unrailed, [],
      'These org-scoped coach routes resolve their user off-rail, so the billing gate never sees ' +
      'them — a cancelled club would keep using them. Route through getAuthContext, or through ' +
      'one of the shared coach resolvers that does.',
    );
  });
});
