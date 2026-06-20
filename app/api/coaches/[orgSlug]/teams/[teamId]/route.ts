import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  updateRepTeam,
} from '@/lib/db';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import type { Organization } from '@/lib/types';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

/** Who may self-manage seasons + division: a head coach of a STANDALONE Team workspace (not an
 *  org-owned/adopted team — those stay under the club admin). `linked` still counts as standalone. */
function computeScope(
  org: Pick<Organization, 'accountKind' | 'planId' | 'teamWorkspaceStatus'>,
  coachRole: 'head_coach' | 'assistant_coach',
) {
  const isStandalone =
    isTeamWorkspaceOrg(org) &&
    org.teamWorkspaceStatus !== 'org_owned' &&
    org.teamWorkspaceStatus !== 'archived';
  const isHeadCoach = coachRole === 'head_coach';
  return {
    isStandalone,
    isHeadCoach,
    canManageSeasons: isStandalone && isHeadCoach,
    canEditDivision: isStandalone && isHeadCoach,
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId] — team identity + current season + scope (Settings page)
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;

  const scope = computeScope(ctx.org, assignment.coachRole);

  return NextResponse.json({
    team: { id: team.id, name: team.name, division: team.division, sport: team.sport },
    season: { id: programYear.id, name: programYear.name, year: programYear.year, status: programYear.status },
    nextYearDefault: programYear.year + 1,
    scope,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]' });

// PATCH /api/coaches/[orgSlug]/teams/[teamId] — coach edits team division (standalone head coach only)
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  const scope = computeScope(ctx.org, assignment.coachRole);
  if (!scope.canEditDivision) {
    return NextResponse.json(
      { error: 'Only the head coach of a standalone Premium team can change the division.' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  if (!('division' in body)) {
    return NextResponse.json({ error: 'division is required' }, { status: 400 });
  }
  const raw = body.division;
  if (raw != null && typeof raw !== 'string') {
    return NextResponse.json({ error: 'division must be a string or null' }, { status: 400 });
  }
  const division = typeof raw === 'string' ? raw.trim() : '';
  if (division.length > 30) {
    return NextResponse.json({ error: 'Division must be 30 characters or fewer.' }, { status: 400 });
  }

  const team = await updateRepTeam(teamId, { division: division || null });
  return NextResponse.json({ ok: true, division: team.division });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]' });
