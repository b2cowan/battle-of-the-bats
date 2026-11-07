import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { planCarriesModule } from '@/lib/module-entitlements';
import { computeClubChecklist } from '@/lib/club-checklist';
import { withObservability, captureAndJson } from '@/lib/observability';

/**
 * GET /api/admin/org/club-checklist — the club's setup checklist (A11, Stage 1 specimen 10), computed
 * from the club's own data. Shape and done-conditions: lib/club-checklist.ts.
 *
 * The OWNER's page, like the onboarding it replaces (a non-owner is never routed there). Only a club
 * — an org whose plan carries Rep Teams — has one; anything else is answered 404 rather than a
 * checklist of steps it cannot take.
 *
 * ⚖ Stage 13b, A2 (Ask 11, F-A1-4): a club ADMIN may READ it, so their Overview can show the owner's open steps as "Still to do".
 * READ only — this route has no write, and the checklist's steps are unchanged; reading it lets no one tick or change a step.
 * A treasurer, the league roles and a coach are still refused.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  // The checklist is the whole club's (every team's coach gap, the board, the first uncovered team's door): an admin limited to
  // some team groups is not shown the rest of the club's setup.
  if (ctx.role === 'admin' && ctx.repGroupIds) return forbidden();
  if (!planCarriesModule(ctx.org, 'module_rep_teams')) {
    return NextResponse.json({ error: 'This checklist is for clubs.', code: 'not_a_club' }, { status: 404 });
  }
  try {
    return NextResponse.json(await computeClubChecklist(ctx.org));
  } catch (error) {
    return captureAndJson(error, { error: 'We couldn’t read the setup checklist. Try again.' }, 500);
  }
}, { route: '/api/admin/org/club-checklist' });
