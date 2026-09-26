/**
 * UAT Suite: Plan Gating
 *
 * Verifies plan- and capability-based gating in the admin UI:
 * - Free (tournament) plan shows an upgrade prompt on the auto-schedule generator
 * - Plus-only tournament pages load on tournament_plus/league/club
 * - Module pages: an org-admin opens every program the plan carries (ruling D8, 2026-09-25);
 *   Families stays an explicit grant, so an admin without it is refused
 * - Org billing is owner-managed: an org-admin can view it but sees a read-only notice
 *
 * Orgs used (slugs from env, with dev defaults):
 *   UAT_ORG_SLUG       - tournament (free) tier
 *   UAT_PLUS_ORG_SLUG  - tournament_plus tier
 *   UAT_CLUB_ORG_SLUG  - club tier (non-tournament, so /admin/org/* is reachable)
 *
 * NOTE: module access and org billing are gated by CAPABILITY/ROLE, not by plan
 * (proxy.ts only tier-redirects /admin/org/* away from tournament tiers). Owners hold
 * every capability; admins hold every program module but never billing (D8). These tests assert that model.
 */

import { test, expect } from '../helpers/fixtures';
import { supabaseAdmin } from '../../../lib/supabase-admin';

const PLUS_ORG_SLUG = process.env.UAT_PLUS_ORG_SLUG ?? process.env.UAT_ORG_SLUG!;
const CLUB_ORG_SLUG = process.env.UAT_CLUB_ORG_SLUG ?? 'uat-club-org';

// A zero-game tournament on the free org, seeded once, so the schedule page renders its
// free-plan gate callout deterministically (the callout only shows when a tournament is
// selected and has no games yet).
let freeTournamentId: string | null = null;

test.beforeAll(async () => {
  const orgSlug = process.env.UAT_ORG_SLUG ?? 'uat-test-org';
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .maybeSingle();
  if (orgError) throw orgError;
  if (!org) throw new Error(`UAT organization ${orgSlug} was not found.`);

  // The free-plan gate callout only renders on a genuine 'tournament' plan; ensure the
  // org is there (it can drift to a higher plan via other flows / billing specs). And keep
  // the shared club org active so billing + module tests on it aren't bounced by the
  // CancellationGuard (the Stripe billing spec can leave it 'canceled').
  await supabaseAdmin.from('organizations').update({ plan_id: 'tournament' }).eq('id', org.id);
  await supabaseAdmin.from('organizations').update({ subscription_status: 'active' }).eq('slug', CLUB_ORG_SLUG);

  const suffix = `plan-gating-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date().toISOString().slice(0, 10);
  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .insert({
      org_id: org.id,
      year: new Date().getFullYear(),
      name: `UAT Plan Gating ${suffix}`,
      slug: `uat-plan-gating-${suffix}`,
      status: 'active',
      is_active: true,
      start_date: today,
      end_date: today,
    })
    .select('id')
    .single();
  if (error) throw error;
  freeTournamentId = tournament.id;
});

test.afterAll(async () => {
  if (freeTournamentId) {
    await supabaseAdmin.from('tournaments').delete().eq('id', freeTournamentId);
  }
});

// ── Free-plan gates ──────────────────────────────────────────────────────────

test.describe('Plan gating / free plan (tournament tier)', () => {
  test('schedule page loads on free plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/schedule`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    // Page should render — even if some features are locked
    await expect(ownerPage.locator('main, [class*="main"]').first()).toBeVisible();
  });

  test('registrations page loads on free plan', async ({ ownerPage, orgSlug }) => {
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/registrations`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main, [class*="main"]').first()).toBeVisible();
  });

  test('auto-schedule generator is gated on free plan', async ({ ownerPage, orgSlug }) => {
    // Point the admin shell at the seeded zero-game tournament so the schedule page
    // renders its empty-state gate callout for the free plan.
    await ownerPage.addInitScript(
      ([key, id]) => window.localStorage.setItem(key, id),
      [`botb_admin_tournament_id:${orgSlug}`, freeTournamentId!] as const,
    );
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/schedule`);
    // Free plan: the Round-Robin Generator / Playoff Bracket Builder are gated behind
    // Tournament Plus (schedule/page.tsx empty-state callout).
    await expect(
      ownerPage.getByText(/available with Tournament Plus or higher/i),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('PDF export is gated on free plan', async ({ ownerPage, orgSlug }) => {
    // Navigate to a page with export controls (registrations or results)
    await ownerPage.goto(`/${orgSlug}/admin/tournaments/registrations`);
    // PDF option should either be absent or show a locked state
    const pdfLockedOrAbsent = ownerPage.locator(
      '[class*="locked"][aria-label*="pdf" i], [data-feature="pdf_exports"], [class*="upgrade"]:has-text("PDF")'
    );
    // Either present as locked, or genuinely absent from the DOM on free plan
    const count = await pdfLockedOrAbsent.count();
    const isLocked = count > 0;
    const pdfButton = ownerPage.locator('button:has-text("PDF"), [role="menuitem"]:has-text("PDF")');
    const pdfCount = await pdfButton.count();
    // If a PDF button exists, it must be disabled or show a gate
    if (pdfCount > 0) {
      const isDisabled = await pdfButton.first().isDisabled();
      expect(isDisabled || isLocked).toBe(true);
    }
    // If neither locked indicator nor button exists, that's also acceptable (feature hidden entirely)
  });
});

// ── Tournament Plus feature access ───────────────────────────────────────────

test.describe('Plan gating / tournament_plus features', () => {
  test('results page loads on plus org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${PLUS_ORG_SLUG}/admin/tournaments/results`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main, [class*="main"]').first()).toBeVisible();
  });

  test('communication page loads on plus org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${PLUS_ORG_SLUG}/admin/tournaments/communication`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible();
  });

  test('branding page loads on plus org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${PLUS_ORG_SLUG}/admin/tournaments/branding`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage.locator('main').first()).toBeVisible();
  });
});

// ── Module access: an admin opens every program the plan carries (⚖ ruling D8) ────────────────
// Until 2026-09-25 this block asserted the OPPOSITE — that a club's admin met "Access Restricted" on
// every program — and so codified the defect A01 (a club's vice-president treated as a
// tournament-only user). D8 ruled it: an admin gets every module the plan carries by default, and
// Families stays an explicit grant. Both halves are asserted here, on the club org (every program
// entitled at the plan level). The unit-level twin is tests/unit/role-defaults-guard.test.ts.

test.describe('Plan gating / an admin opens every program the plan carries (D8)', () => {
  const MODULES = [
    { label: 'house league', segment: 'house-league', heading: 'House League' },
    { label: 'accounting', segment: 'accounting', heading: 'Accounting Overview' },
    { label: 'rep teams', segment: 'rep-teams', heading: 'Rep Teams' },
  ] as const;

  for (const { label, segment, heading } of MODULES) {
    test(`${label} opens for an org-admin`, async ({ adminPage }) => {
      await adminPage.goto(`/${CLUB_ORG_SLUG}/admin/${segment}`);
      await expect(adminPage).not.toHaveURL(/\/auth\/login/);
      // The program's own title is the positive signal (a refusal would be "Access Restricted",
      // and a refused Rep Teams layout redirects to the hub, which this URL check also catches).
      await expect(adminPage.getByRole('heading', { name: heading, level: 1 })).toBeVisible({ timeout: 20_000 });
      await expect(adminPage).toHaveURL(new RegExp(`/${CLUB_ORG_SLUG}/admin/${segment}`));
      await expect(adminPage.getByRole('heading', { name: 'Access Restricted' })).toHaveCount(0);
    });
  }

  test('Families stays an explicit grant: an org-admin without it is refused', async ({ adminPage }) => {
    await adminPage.goto(`/${CLUB_ORG_SLUG}/admin/families`);
    await expect(adminPage).not.toHaveURL(/\/auth\/login/);
    await expect(
      adminPage.getByRole('heading', { name: /needs the Families permission/ }),
    ).toBeVisible({ timeout: 20_000 });
  });
});

// ── Org billing is owner-managed ─────────────────────────────────────────────
// /admin/org/* is only reachable on non-tournament tiers, so these run on the club org.
// Owners can manage billing; admins can view it but see a read-only notice.

test.describe('Plan gating / org billing access', () => {
  test('owner can manage billing on a club org', async ({ ownerPage }) => {
    await ownerPage.goto(`/${CLUB_ORG_SLUG}/admin/org/billing`);
    await expect(ownerPage).not.toHaveURL(/\/auth\/login/);
    await expect(ownerPage).toHaveURL(new RegExp(`/${CLUB_ORG_SLUG}/admin/org/billing`));
    // Owner holds the billing capability → the manage control is enabled.
    await expect(ownerPage.locator('#billing-manage-btn')).toBeEnabled({ timeout: 20_000 });
  });

  test('org-admin sees billing as read-only on a club org', async ({ adminPage }) => {
    await adminPage.goto(`/${CLUB_ORG_SLUG}/admin/org/billing`);
    await expect(adminPage).not.toHaveURL(/\/auth\/login/);
    // Admin can view billing but cannot manage it (owner-only) → manage control disabled.
    await expect(adminPage.locator('#billing-manage-btn')).toBeDisabled({ timeout: 20_000 });
  });

  test('org-admin can access registrations', async ({ adminPage, orgSlug }) => {
    await adminPage.goto(`/${orgSlug}/admin/tournaments/registrations`);
    await expect(adminPage).not.toHaveURL(/\/auth\/login/);
    await expect(adminPage.locator('main').first()).toBeVisible();
  });
});
