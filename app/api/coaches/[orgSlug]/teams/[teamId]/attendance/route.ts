import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  getRepTeamAttendanceReliability,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewRoster } from '@/lib/coach-capabilities';

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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

const EMPTY_STAT = { attended: 0, known: 0, recorded: 0 };

/**
 * Season attendance reliability for the whole active roster (Coaches Portal Phase 4 F3).
 * Gated on roster view — attendance is not guardian PII. Active players with no recorded
 * attendance come back with zeroed stats so the view can show them as "not tracked yet".
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewRoster(assignment.capabilities), 'You do not have access to this team roster. Ask the head coach to grant it.');
  if (denied) return denied;

  const [players, reliability] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamAttendanceReliability(programYear.id),
  ]);

  const rows = players
    .filter(p => p.status === 'active')
    .map(p => {
      const r = reliability.get(p.id);
      return {
        playerId: p.id,
        playerFirstName: p.playerFirstName,
        playerLastName: p.playerLastName,
        games: r?.games ?? EMPTY_STAT,
        practices: r?.practices ?? EMPTY_STAT,
      };
    });

  return NextResponse.json({ players: rows });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/attendance' });
