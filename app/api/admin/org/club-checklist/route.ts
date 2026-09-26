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
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();
  if (!planCarriesModule(ctx.org, 'module_rep_teams')) {
    return NextResponse.json({ error: 'This checklist is for clubs.', code: 'not_a_club' }, { status: 404 });
  }
  try {
    return NextResponse.json(await computeClubChecklist(ctx.org));
  } catch (error) {
    return captureAndJson(error, { error: 'We couldn’t read the setup checklist. Try again.' }, 500);
  }
}, { route: '/api/admin/org/club-checklist' });
