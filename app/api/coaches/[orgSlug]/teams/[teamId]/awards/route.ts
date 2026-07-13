import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepTeam,
  getRepTeamPlayerAwardsHydrated,
  getRepRosterPlayers,
  getRepTeamAwardTypeLibrary,
  getRepTeamEventById,
  createRepPlayerAward,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageAwards } from '@/lib/coach-capabilities';
import { tournamentToday } from '@/lib/timezone';

async function resolveTeamCoachContext(orgSlug: string, teamId: string) {
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
  const denied = denyUnless(canManageAwards(assignment.capabilities), 'You do not have access to awards.');
  if (denied) return { error: denied };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear } = resolved;

  // `players` is a minimal, PII-free roster slice (id/name/number only) so the give-award
  // picker works for a schedule-only coach too, without widening the more tightly-scoped
  // `roster` capability that the full `/roster` endpoint requires.
  const [awards, roster] = await Promise.all([
    getRepTeamPlayerAwardsHydrated(teamId, ctx.org.id),
    getRepRosterPlayers(programYear.id),
  ]);
  const players = roster
    .filter(p => p.status === 'active')
    .map(p => ({
      id: p.id,
      name: [p.playerFirstName, p.playerLastName].filter(Boolean).join(' '),
      number: p.playerNumber,
    }));

  return NextResponse.json({ awards, players });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/awards' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear } = resolved;

  const body = await req.json().catch(() => ({}));

  const playerId = typeof body.playerId === 'string' ? body.playerId : '';
  const awardTypeId = typeof body.awardTypeId === 'string' ? body.awardTypeId : '';
  if (!playerId || !awardTypeId) {
    return NextResponse.json({ error: 'playerId and awardTypeId are required' }, { status: 400 });
  }

  const [roster, awardTypes] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    // Team's own + org-shared active types — a coach can give an org-shared award too.
    getRepTeamAwardTypeLibrary(teamId, ctx.org.id),
  ]);
  const player = roster.find(p => p.id === playerId && p.status === 'active');
  if (!player) {
    return NextResponse.json({ error: 'That player is not on the active roster' }, { status: 400 });
  }
  const awardType = awardTypes.find(t => t.id === awardTypeId);
  if (!awardType) {
    return NextResponse.json({ error: 'That award type is not available for this team' }, { status: 400 });
  }

  // A game must have a final score before it can carry an award — mirrors the schedule page's
  // own gating (can't award a game that hasn't been played).
  let eventId: string | null = null;
  let tournamentLabel: string | null = null;
  let awardedAt: string;
  if (typeof body.eventId === 'string' && body.eventId) {
    const event = await getRepTeamEventById(body.eventId);
    if (!event || event.teamId !== teamId) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (event.status === 'cancelled') {
      return NextResponse.json({ error: 'This game was cancelled' }, { status: 400 });
    }
    if (event.teamScore == null || event.opponentScore == null) {
      return NextResponse.json({ error: 'Enter a final score before giving an award for this game' }, { status: 400 });
    }
    eventId = event.id;
    awardedAt = event.startsAt.slice(0, 10);
  } else {
    tournamentLabel = typeof body.tournamentLabel === 'string' ? body.tournamentLabel.trim().slice(0, 80) || null : null;
    const requested = typeof body.awardedAt === 'string' ? body.awardedAt : '';
    awardedAt = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : tournamentToday();
  }

  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 200) || null : null;

  const award = await createRepPlayerAward({
    orgId: ctx.org.id,
    teamId,
    playerId,
    awardTypeId,
    eventId,
    tournamentLabel,
    awardedAt,
    note,
    createdBy: ctx.user.id,
  });
  return NextResponse.json({ award }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/awards' });
