import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepRosterPlayers,
  getRepTeam,
  getRepTeamEventAttendance,
  getRepTeamEventById,
  getRepTeamLineupEntries,
  getRepTeamLineupForEvent,
  replaceRepTeamLineupEntries,
  upsertRepTeamLineup,
} from '@/lib/db';
import type { RepLineupMode } from '@/lib/types';
import { withObservability } from '@/lib/observability';

const VALID_LINEUP_MODES: RepLineupMode[] = ['nine_player', 'everyone_bats'];
const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
const VALID_POSITIONS = new Set([
  'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH', 'EH', 'Bench',
]);

type RawLineupEntry = {
  playerId?: unknown;
  battingOrder?: unknown;
  starter?: unknown;
  inningPositions?: unknown;
  notes?: unknown;
};

async function resolveCoachContext(orgSlug: string, teamId: string, eventId: string) {
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

  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }

  if (!GAME_EVENT_TYPES.includes(event.eventType)) {
    return { error: NextResponse.json({ error: 'Lineups are available for games and scrimmages' }, { status: 400 }) };
  }

  return { ctx, team, assignment, programYear, event };
}

function normalizeInningPositions(raw: unknown, inningCount: number): Record<string, string> {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const next: Record<string, string> = {};

  for (let inning = 1; inning <= inningCount; inning += 1) {
    const value = source[String(inning)];
    if (typeof value !== 'string') continue;
    const position = value.trim();
    if (!position) continue;
    if (!VALID_POSITIONS.has(position)) {
      throw new Error(`Invalid position for inning ${inning}`);
    }
    next[String(inning)] = position;
  }

  return next;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

  const [players, attendance, lineup] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamEventAttendance(eventId),
    getRepTeamLineupForEvent(eventId),
  ]);
  const entries = lineup ? await getRepTeamLineupEntries(lineup.id) : [];

  return NextResponse.json({
    players: players.filter(player => player.status === 'active'),
    attendance,
    lineup,
    entries,
    programYear,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/lineup' });

export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear, event } = resolved;

  const body = await req.json();
  const lineupMode = body.lineupMode as RepLineupMode;
  const inningCount = Number(body.inningCount);
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const entries = Array.isArray(body.entries) ? body.entries : null;

  if (!VALID_LINEUP_MODES.includes(lineupMode)) {
    return NextResponse.json({ error: 'Invalid lineup mode' }, { status: 400 });
  }
  if (!Number.isInteger(inningCount) || inningCount < 1 || inningCount > 12) {
    return NextResponse.json({ error: 'Inning count must be between 1 and 12' }, { status: 400 });
  }
  if (notes.length > 1000) {
    return NextResponse.json({ error: 'Lineup notes must be 1000 characters or less' }, { status: 400 });
  }
  if (!entries) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
  }

  const players = (await getRepRosterPlayers(programYear.id)).filter(player => player.status === 'active');
  const activePlayerIds = new Set(players.map(player => player.id));
  const seenPlayers = new Set<string>();
  const seenOrders = new Set<number>();
  let starterCount = 0;

  let rows: {
    playerId: string;
    battingOrder: number | null;
    starter: boolean;
    inningPositions: Record<string, string>;
    notes: string | null;
  }[];

  try {
    rows = (entries as RawLineupEntry[]).map(entry => {
      const playerId = typeof entry?.playerId === 'string' ? entry.playerId : '';
      if (!activePlayerIds.has(playerId)) {
        throw new Error('Lineups can only include active roster players');
      }
      if (seenPlayers.has(playerId)) {
        throw new Error('Each player can only appear once in a lineup');
      }
      seenPlayers.add(playerId);

      const rawOrder = entry?.battingOrder;
      const battingOrder = rawOrder === null || rawOrder === undefined || rawOrder === ''
        ? null
        : Number(rawOrder);
      if (battingOrder !== null && (!Number.isInteger(battingOrder) || battingOrder < 1 || battingOrder > 99)) {
        throw new Error('Batting order must be a positive whole number');
      }
      if (battingOrder !== null) {
        if (seenOrders.has(battingOrder)) throw new Error('Batting order cannot contain duplicates');
        seenOrders.add(battingOrder);
      }

      const starter = lineupMode === 'nine_player' ? Boolean(entry?.starter) : true;
      if (starter) starterCount += 1;
      if (lineupMode === 'nine_player' && starter && battingOrder !== null && battingOrder > 9) {
        throw new Error('9 player ball starters must bat in spots 1-9');
      }
      if (lineupMode === 'everyone_bats' && battingOrder === null) {
        throw new Error('Everyone bats lineups need a batting order for each hitter');
      }

      return {
        playerId,
        battingOrder,
        starter,
        inningPositions: normalizeInningPositions(entry?.inningPositions, inningCount),
        notes: typeof entry?.notes === 'string' ? entry.notes.trim().slice(0, 500) : null,
      };
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid lineup entries' },
      { status: 400 },
    );
  }

  if (lineupMode === 'nine_player' && starterCount > 9) {
    return NextResponse.json({ error: '9 player ball can only have 9 starters' }, { status: 400 });
  }

  try {
    const lineup = await upsertRepTeamLineup({
      eventId,
      programYearId: programYear.id,
      teamId,
      orgId: ctx.org.id,
      lineupMode,
      inningCount,
      notes: notes || null,
      updatedBy: ctx.user.id,
    });
    const savedEntries = await replaceRepTeamLineupEntries(lineup.id, rows);
    return NextResponse.json({ lineup, entries: savedEntries, event });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lineup save failed' },
      { status: 400 },
    );
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/lineup' });
