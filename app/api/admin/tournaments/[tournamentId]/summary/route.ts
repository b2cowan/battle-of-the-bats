import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';

type RouteParams = { params: Promise<{ tournamentId: string }> };

type TournamentRow = {
  id: string;
  name: string;
  slug: string | null;
  year: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  org_id: string | null;
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type DivisionRow = {
  id: string;
  name: string;
  capacity: number | null;
  display_order: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  status: 'pending' | 'accepted' | 'waitlist' | 'rejected' | null;
  payment_status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
  division_id: string | null;
  waitlist_position: number | null;
  registered_at: string | null;
};

type GameRow = {
  id: string;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  is_playoff: boolean | null;
  bracket_code: string | null;
  game_date: string | null;
};

type FeeRow = {
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type StandingRow = {
  teamId: string;
  teamName: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  rf: number;
  ra: number;
  rd: number;
};

function numberValue(value: unknown) {
  return value == null ? 0 : Number(value);
}

function effectiveFee(team: TeamRow, tournament: TournamentRow, divisions: Map<string, DivisionRow>): FeeRow {
  const group = team.division_id ? divisions.get(team.division_id) : null;
  if (tournament.fee_schedule_mode === 'division' && group?.total_fee_amount != null) return group;
  return tournament;
}

function isPastDue(team: TeamRow, fee: FeeRow, today: string) {
  const depositPaid = numberValue(team.deposit_paid);
  const totalPaid = numberValue(team.total_paid);
  const totalFee = numberValue(fee.total_fee_amount);
  if (totalFee <= 0 || totalPaid >= totalFee) return false;
  if (fee.total_fee_due_date && today > fee.total_fee_due_date) return true;
  return Boolean(fee.deposit_amount && fee.deposit_due_date && today > fee.deposit_due_date && depositPaid < numberValue(fee.deposit_amount));
}

function calculateStandings(teams: TeamRow[], games: GameRow[]): StandingRow[] {
  const acceptedTeams = teams.filter(team => team.status === 'accepted');
  return acceptedTeams
    .map(team => {
      const teamGames = games.filter(game =>
        (game.status === 'completed' || game.status === 'submitted') &&
        !game.is_playoff &&
        (game.home_team_id === team.id || game.away_team_id === team.id)
      );
      let w = 0;
      let l = 0;
      let t = 0;
      let rf = 0;
      let ra = 0;

      for (const game of teamGames) {
        const isHome = game.home_team_id === team.id;
        const own = numberValue(isHome ? game.home_score : game.away_score);
        const opp = numberValue(isHome ? game.away_score : game.home_score);
        rf += own;
        ra += opp;
        if (own > opp) w++;
        else if (own < opp) l++;
        else t++;
      }

      return {
        teamId: team.id,
        teamName: team.name,
        gp: teamGames.length,
        w,
        l,
        t,
        pts: w * 2 + t,
        rf,
        ra,
        rd: rf - ra,
      };
    })
    .sort((a, b) => b.pts - a.pts || b.rd - a.rd || b.rf - a.rf || a.ra - b.ra || a.teamName.localeCompare(b.teamName));
}

function championFromFinal(games: GameRow[], teamNames: Map<string, string>) {
  const final = games
    .filter(game => game.status === 'completed' && game.is_playoff && game.bracket_code === 'FIN')
    .sort((a, b) => String(b.game_date ?? '').localeCompare(String(a.game_date ?? '')))[0];
  if (!final || final.home_score == null || final.away_score == null || final.home_score === final.away_score) return null;

  const winnerId = final.home_score > final.away_score ? final.home_team_id : final.away_team_id;
  const runnerUpId = final.home_score > final.away_score ? final.away_team_id : final.home_team_id;
  return {
    championTeamId: winnerId,
    championTeamName: winnerId ? teamNames.get(winnerId) ?? 'Champion' : 'Champion',
    runnerUpTeamId: runnerUpId,
    runnerUpTeamName: runnerUpId ? teamNames.get(runnerUpId) ?? 'Runner-up' : 'Runner-up',
  };
}

async function trackSummaryEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  tournamentId: string;
  action?: string;
  status: 'attempted' | 'blocked' | 'completed';
}) {
  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'post_tournament_summary',
      action: input.action ?? 'view_post_tournament_summary',
      tournamentId: input.tournamentId,
      status: input.status,
    },
  });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action: 'view_post_tournament_summary',
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'post_tournament_summary')) {
    await trackSummaryEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      action: 'view_post_tournament_summary',
      status: 'blocked',
    });
    return NextResponse.json({ error: requiresTournamentPlusCopy('post_tournament_summary') }, { status: 403 });
  }

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, slug, year, status, start_date, end_date, org_id, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
    .eq('id', tournamentId)
    .maybeSingle<TournamentRow>();

  if (tournamentError) return NextResponse.json({ error: tournamentError.message }, { status: 500 });
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();
  if (!tournament.slug) return NextResponse.json({ error: 'Tournament slug is required to build public summary links.' }, { status: 500 });

  const [{ data: divisions, error: divisionsError }, { data: teams, error: teamsError }, { data: games, error: gamesError }, { data: archives, error: archivesError }] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name, capacity, display_order, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date')
      .eq('tournament_id', tournamentId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('teams')
      .select('id, name, status, payment_status, deposit_paid, total_paid, division_id, waitlist_position, registered_at')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('games')
      .select('id, division_id, home_team_id, away_team_id, home_score, away_score, status, is_playoff, bracket_code, game_date')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('tournament_archives')
      .select('id, sealed_at')
      .eq('tournament_id', tournamentId)
      .order('sealed_at', { ascending: false }),
  ]);

  if (divisionsError) return NextResponse.json({ error: divisionsError.message }, { status: 500 });
  if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
  if (gamesError) return NextResponse.json({ error: gamesError.message }, { status: 500 });
  if (archivesError) return NextResponse.json({ error: archivesError.message }, { status: 500 });

  const typedDivisions = (divisions ?? []) as DivisionRow[];
  const typedTeams = (teams ?? []) as TeamRow[];
  const typedGames = (games ?? []) as GameRow[];
  const divisionMap = new Map(typedDivisions.map(group => [group.id, group]));
  const teamNames = new Map(typedTeams.map(team => [team.id, team.name]));
  const today = new Date().toISOString().split('T')[0];

  const registrationTotals = {
    total: typedTeams.length,
    accepted: typedTeams.filter(team => team.status === 'accepted').length,
    pending: typedTeams.filter(team => team.status === 'pending').length,
    waitlist: typedTeams.filter(team => team.status === 'waitlist').length,
    rejected: typedTeams.filter(team => team.status === 'rejected').length,
  };

  const paymentTeams = typedTeams.filter(team => team.status === 'accepted');
  const paymentTotals = paymentTeams.reduce((acc, team) => {
    const fee = effectiveFee(team, tournament, divisionMap);
    const expected = numberValue(fee.total_fee_amount);
    const collected = numberValue(team.total_paid);
    const depositAmount = numberValue(fee.deposit_amount);
    acc.expected += expected;
    acc.collected += collected;
    acc.outstanding += Math.max(expected - collected, 0);
    if (expected > 0 && collected >= expected) acc.paidInFull++;
    if (depositAmount <= 0 || numberValue(team.deposit_paid) >= depositAmount) acc.depositComplete++;
    if (isPastDue(team, fee, today)) acc.pastDue++;
    return acc;
  }, { expected: 0, collected: 0, outstanding: 0, paidInFull: 0, depositComplete: 0, pastDue: 0 });

  const scheduleTotals = {
    total: typedGames.length,
    completed: typedGames.filter(game => game.status === 'completed').length,
    submitted: typedGames.filter(game => game.status === 'submitted').length,
    scheduled: typedGames.filter(game => game.status === 'scheduled').length,
    cancelled: typedGames.filter(game => game.status === 'cancelled').length,
    playoffGames: typedGames.filter(game => game.is_playoff).length,
  };

  const divisions = typedDivisions.map(group => {
    const groupTeams = typedTeams.filter(team => team.division_id === group.id);
    const groupGames = typedGames.filter(game => game.division_id === group.id);
    const standings = calculateStandings(groupTeams, groupGames);
    const champion = championFromFinal(groupGames, teamNames);
    return {
      id: group.id,
      name: group.name,
      capacity: group.capacity,
      registrations: {
        total: groupTeams.length,
        accepted: groupTeams.filter(team => team.status === 'accepted').length,
        pending: groupTeams.filter(team => team.status === 'pending').length,
        waitlist: groupTeams.filter(team => team.status === 'waitlist').length,
        rejected: groupTeams.filter(team => team.status === 'rejected').length,
      },
      games: {
        total: groupGames.length,
        completed: groupGames.filter(game => game.status === 'completed').length,
      },
      standingsLeader: standings[0] ?? null,
      champion,
    };
  });

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action: 'view_post_tournament_summary',
    status: 'completed',
  });

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      year: tournament.year,
      status: tournament.status,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
    },
    registrationTotals,
    paymentTotals,
    scheduleTotals,
    divisions,
    archive: {
      sealed: (archives ?? []).length > 0,
      sealedAt: archives?.[0]?.sealed_at ?? null,
      count: archives?.length ?? 0,
    },
    publicLinks: {
      home: `/${ctx.org.slug}/${tournament.slug}`,
      standings: `/${ctx.org.slug}/${tournament.slug}/standings`,
      schedule: `/${ctx.org.slug}/${tournament.slug}/schedule`,
      teams: `/${ctx.org.slug}/${tournament.slug}/teams`,
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const requestedAction = typeof body.action === 'string' ? body.action : '';
  const action = requestedAction === 'print'
    ? 'print_post_tournament_summary'
    : requestedAction === 'share_public_results'
      ? 'share_post_tournament_summary'
      : requestedAction === 'renewal_cta_clicked'
        ? 'click_post_event_renewal_cta'
      : null;

  if (!action) return NextResponse.json({ error: 'Unsupported summary action.' }, { status: 400 });

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action,
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'post_tournament_summary')) {
    await trackSummaryEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      tournamentId,
      action,
      status: 'blocked',
    });
    return NextResponse.json({ error: requiresTournamentPlusCopy('post_tournament_summary') }, { status: 403 });
  }

  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, org_id')
    .eq('id', tournamentId)
    .maybeSingle<{ id: string; org_id: string | null }>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  await trackSummaryEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    tournamentId,
    action,
    status: 'completed',
  });

  return NextResponse.json({ ok: true });
}
