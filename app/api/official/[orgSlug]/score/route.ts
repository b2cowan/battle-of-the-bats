import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AgeGroup, Diamond, Game, GameStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgSlug: string }> };

type TournamentRow = {
  id: string;
  name: string;
  year: number;
  status: string | null;
  require_score_finalization: boolean | null;
};

type GameRow = {
  id: string;
  tournament_id: string;
  age_group_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  game_date: string;
  game_time: string | null;
  location: string | null;
  diamond_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  is_playoff: boolean | null;
  bracket_id: string | null;
  bracket_code: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_slot_id: string | null;
  away_slot_id: string | null;
  notes: string | null;
  score_submitted_by_user_id: string | null;
  score_submitted_by_email: string | null;
  score_submitted_at: string | null;
  score_submission_source: Game['scoreSubmissionSource'] | null;
};

type TeamRow = {
  id: string;
  name: string;
};

type DiamondRow = {
  id: string;
  tournament_id: string;
  name: string;
  address: string | null;
  notes: string | null;
};

type AgeGroupRow = {
  id: string;
  tournament_id: string;
  name: string;
  min_age: number | null;
  max_age: number | null;
  display_order: number | null;
};

interface OfficialScoreCard {
  game: Game;
  homeName: string;
  awayName: string;
  diamond: Diamond | null;
  divisionName: string;
  tournamentName: string | null;
}

type OfficialScoreEmptyReason =
  | 'access_denied'
  | 'no_tournament_access'
  | 'no_active_tournaments'
  | 'no_games_today';

interface OfficialScoreEmptyState {
  reason: OfficialScoreEmptyReason;
  title: string;
  message: string;
}

interface OfficialScorePayload {
  date: string;
  tournamentIds: string[];
  scorePolicyByTournamentId: Record<string, boolean>;
  cards: OfficialScoreCard[];
  diamonds: Diamond[];
  ageGroups: AgeGroup[];
  emptyMessage: string;
  emptyState: OfficialScoreEmptyState | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyState(reason: OfficialScoreEmptyReason, title: string, message: string): OfficialScoreEmptyState {
  return { reason, title, message };
}

function emptyPayload(
  date: string,
  tournamentIds: string[],
  state: OfficialScoreEmptyState,
  scorePolicyByTournamentId: Record<string, boolean> = {},
): OfficialScorePayload {
  return {
    date,
    tournamentIds,
    scorePolicyByTournamentId,
    cards: [],
    diamonds: [],
    ageGroups: [],
    emptyMessage: state.message,
    emptyState: state,
  };
}

function accessDeniedResponse(message: string) {
  return NextResponse.json({
    error: message,
    emptyState: emptyState(
      'access_denied',
      'Scorekeeper access unavailable',
      message,
    ),
  }, { status: 403 });
}

function toGameStatus(value: string | null): GameStatus {
  if (value === 'submitted' || value === 'completed' || value === 'cancelled') return value;
  return 'scheduled';
}

function mapGame(row: GameRow): Game {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    ageGroupId: row.age_group_id ?? '',
    homeTeamId: row.home_team_id ?? '',
    awayTeamId: row.away_team_id ?? '',
    date: row.game_date,
    time: row.game_time ?? '',
    location: row.location ?? '',
    diamondId: row.diamond_id ?? undefined,
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: toGameStatus(row.status),
    isPlayoff: row.is_playoff ?? false,
    bracketId: row.bracket_id ?? undefined,
    bracketCode: row.bracket_code ?? undefined,
    homePlaceholder: row.home_placeholder ?? undefined,
    awayPlaceholder: row.away_placeholder ?? undefined,
    homeSlotId: row.home_slot_id ?? undefined,
    awaySlotId: row.away_slot_id ?? undefined,
    notes: row.notes ?? undefined,
    scoreSubmittedByUserId: row.score_submitted_by_user_id,
    scoreSubmittedByEmail: row.score_submitted_by_email,
    scoreSubmittedAt: row.score_submitted_at,
    scoreSubmissionSource: row.score_submission_source,
  };
}

function mapDiamond(row: DiamondRow): Diamond {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    address: row.address ?? '',
    notes: row.notes ?? undefined,
  };
}

function mapAgeGroup(row: AgeGroupRow): AgeGroup {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    minAge: row.min_age,
    maxAge: row.max_age,
    order: row.display_order ?? 0,
  };
}

export async function GET(req: Request, { params }: Params) {
  const { orgSlug } = await params;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  if (ctx.org.slug !== orgSlug) {
    return accessDeniedResponse('This scorekeeper link belongs to another organization.');
  }
  if (!hasCapability(ctx.role, ctx.capabilities, 'submit_scores')) {
    return accessDeniedResponse('You do not have scorekeeper access for this organization.');
  }

  const requestedDate = new URL(req.url).searchParams.get('date')?.trim();
  const date = requestedDate || new Date().toISOString().slice(0, 10);
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: 'Invalid scorekeeper date.' }, { status: 400 });
  }

  let tournamentQuery = supabaseAdmin
    .from('tournaments')
    .select('id, name, year, status, require_score_finalization')
    .eq('organization_id', ctx.org.id)
    .neq('status', 'archived')
    .order('year', { ascending: false })
    .order('name', { ascending: true });

  if (ctx.assignedTournamentIds !== null) {
    if (ctx.assignedTournamentIds.length === 0) {
      return NextResponse.json(emptyPayload(
        date,
        [],
        emptyState(
          'no_tournament_access',
          'No tournament access',
          'No tournaments are available for your scorekeeper account. Contact your organization admin for access.',
        ),
      ));
    }
    tournamentQuery = tournamentQuery.in('id', ctx.assignedTournamentIds);
  } else {
    tournamentQuery = tournamentQuery.eq('status', 'active');
  }

  const { data: tournamentRows, error: tournamentError } = await tournamentQuery;
  if (tournamentError) {
    return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  }

  const tournaments = (tournamentRows ?? []) as TournamentRow[];
  const tournamentIds = tournaments.map(tournament => tournament.id);
  const scorePolicyByTournamentId = Object.fromEntries(
    tournaments.map(tournament => [
      tournament.id,
      tournament.require_score_finalization ?? ctx.org.requireScoreFinalization ?? false,
    ]),
  );
  if (tournamentIds.length === 0) {
    const state = ctx.assignedTournamentIds === null
      ? emptyState(
          'no_active_tournaments',
          'No active tournaments',
          'There are no active tournaments available for scorekeeping right now.',
        )
      : emptyState(
          'no_tournament_access',
          'No tournament access',
          'No assigned tournaments are available for your scorekeeper account. Contact your organization admin for access.',
        );

    return NextResponse.json(emptyPayload(date, [], state));
  }

  const { data: gameRows, error: gameError } = await supabaseAdmin
    .from('games')
    .select(`
      id,
      tournament_id,
      age_group_id,
      home_team_id,
      away_team_id,
      game_date,
      game_time,
      location,
      diamond_id,
      home_score,
      away_score,
      status,
      is_playoff,
      bracket_id,
      bracket_code,
      home_placeholder,
      away_placeholder,
      home_slot_id,
      away_slot_id,
      notes,
      score_submitted_by_user_id,
      score_submitted_by_email,
      score_submitted_at,
      score_submission_source
    `)
    .in('tournament_id', tournamentIds)
    .eq('game_date', date)
    .order('game_time', { ascending: true });

  if (gameError) {
    return NextResponse.json({ error: gameError.message }, { status: 500 });
  }

  const games = ((gameRows ?? []) as GameRow[]).map(mapGame);
  if (games.length === 0) {
    return NextResponse.json(emptyPayload(
      date,
      tournamentIds,
      emptyState(
        'no_games_today',
        'No assigned games today',
        'Your tournament access is set, but there are no games scheduled for today.',
      ),
      scorePolicyByTournamentId,
    ));
  }

  const [teamsResult, diamondsResult, ageGroupsResult] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name')
      .in('tournament_id', tournamentIds),
    supabaseAdmin
      .from('diamonds')
      .select('id, tournament_id, name, address, notes')
      .in('tournament_id', tournamentIds)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('age_groups')
      .select('id, tournament_id, name, min_age, max_age, display_order')
      .in('tournament_id', tournamentIds)
      .order('display_order', { ascending: true }),
  ]);

  if (teamsResult.error) {
    return NextResponse.json({ error: teamsResult.error.message }, { status: 500 });
  }
  if (diamondsResult.error) {
    return NextResponse.json({ error: diamondsResult.error.message }, { status: 500 });
  }
  if (ageGroupsResult.error) {
    return NextResponse.json({ error: ageGroupsResult.error.message }, { status: 500 });
  }

  const teams = (teamsResult.data ?? []) as TeamRow[];
  const diamonds = ((diamondsResult.data ?? []) as DiamondRow[]).map(mapDiamond);
  const ageGroups = ((ageGroupsResult.data ?? []) as AgeGroupRow[]).map(mapAgeGroup);

  const teamNameById = new Map(teams.map(team => [team.id, team.name]));
  const diamondById = new Map(diamonds.map(diamond => [diamond.id, diamond]));
  const ageGroupNameById = new Map(ageGroups.map(ageGroup => [ageGroup.id, ageGroup.name]));
  const tournamentNameById = new Map(tournaments.map(tournament => [
    tournament.id,
    `${tournament.name} (${tournament.year})`,
  ]));

  const cards: OfficialScoreCard[] = games.map(game => ({
    game,
    homeName: teamNameById.get(game.homeTeamId) ?? game.homePlaceholder ?? 'TBD',
    awayName: teamNameById.get(game.awayTeamId) ?? game.awayPlaceholder ?? 'TBD',
    diamond: game.diamondId ? diamondById.get(game.diamondId) ?? null : null,
    divisionName: ageGroupNameById.get(game.ageGroupId) ?? '-',
    tournamentName: tournamentNameById.get(game.tournamentId) ?? null,
  }));

  cards.sort((a, b) => (
    (a.game.time ?? '').localeCompare(b.game.time ?? '')
    || (a.tournamentName ?? '').localeCompare(b.tournamentName ?? '')
    || a.divisionName.localeCompare(b.divisionName)
  ));

  return NextResponse.json({
    date,
    tournamentIds,
    scorePolicyByTournamentId,
    cards,
    diamonds,
    ageGroups,
    emptyMessage: '',
    emptyState: null,
  } satisfies OfficialScorePayload);
}
