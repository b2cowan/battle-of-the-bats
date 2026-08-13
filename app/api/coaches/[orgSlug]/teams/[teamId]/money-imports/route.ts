import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear, getRepTeamImportEvents,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

/**
 * GET /api/coaches/[orgSlug]/teams/[teamId]/money-imports
 *
 * "Recent imports" — the foot of the Money hub's `Import ▾` menu (owner ruling 2026-08-13; the
 * useful half of the coach Data Tools page that was declined). Receipts written by the budget /
 * payables importer, newest first.
 *
 * ⚠ DELIBERATELY NOT ON THE SEASON-READ RAIL. Importing is an instrument, not a record, so it is
 * live-season-only by the coaches-portal archive rule — and this route inherits that by NOT
 * opting in: it resolves the team's ACTIVE program year and cannot address a past season at all.
 * The menu that hosts it is write-gated and therefore already absent in an archive.
 *
 * ⚠ WRITE-GATED, not view-gated. A history of who changed the budget is not something a
 * read-only money assistant is offered, and the menu it lives in never renders for them.
 */

const MAX_EVENTS = 10;

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();

  const denied = denyUnless(
    canWriteMoney(assignment.capabilities),
    'You do not have permission to change team finances. Ask the head coach to grant it.',
  );
  if (denied) return denied;

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return NextResponse.json({ imports: [] });

  const imports = await getRepTeamImportEvents(team.id, programYear.id, MAX_EVENTS);
  return NextResponse.json({ imports });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/money-imports' });
