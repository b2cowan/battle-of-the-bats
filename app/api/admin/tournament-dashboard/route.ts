import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

type GameRow = {
  status: string | null;
  is_playoff: boolean | null;
  bracket_code: string | null;
  age_group_id: string | null;
};

type AgeGroupRow = {
  id: string;
  name: string;
  is_closed: boolean | null;
  capacity: number | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

type TeamPaymentRow = {
  id: string;
  age_group_id: string;
  status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
};

type TournamentFeeRow = {
  start_date: string | null;
  end_date: string | null;
  contact_email: string | null;
  fee_schedule_mode: string | null;
  deposit_amount: number | null;
  deposit_due_date: string | null;
  total_fee_amount: number | null;
  total_fee_due_date: string | null;
};

const ROUND_ORDER = ['Quarterfinals', 'Semifinals', 'Finals'];

function roundLabel(code: string | null): string {
  if (!code) return 'Playoffs';
  const c = code.toUpperCase();
  if (c.includes('FIN')) return 'Finals';
  if (c.includes('SF')) return 'Semifinals';
  if (c.includes('QF')) return 'Quarterfinals';
  return 'Playoffs';
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_tournaments')) return forbidden();

  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) {
    return Response.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('start_date, end_date, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary')
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();

  if (tournamentError) {
    return Response.json({ error: tournamentError.message }, { status: 500 });
  }

  if (!tournament) {
    return Response.json({ error: 'Tournament not found' }, { status: 404 });
  }

  const t = tournament as TournamentFeeRow;

  const [ageGroupsRes, teamsRes, gamesRes, announcementsRes, teamPaymentsRes, venuesRes, rulesRes] = await Promise.all([
    supabaseAdmin
      .from('age_groups')
      .select('id, name, is_closed, capacity, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date', { count: 'exact' })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('games')
      .select('status, is_playoff, bracket_code, age_group_id')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id, age_group_id, status, deposit_paid, total_paid')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('diamonds')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('rules')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
  ]);

  const queryError = ageGroupsRes.error ?? teamsRes.error ?? gamesRes.error ?? announcementsRes.error ?? teamPaymentsRes.error ?? venuesRes.error ?? rulesRes.error;
  if (queryError) {
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const games = (gamesRes.data ?? []) as GameRow[];
  const ageGroups = (ageGroupsRes.data ?? []) as AgeGroupRow[];
  const teamPayments = (teamPaymentsRes.data ?? []) as TeamPaymentRow[];
  const today = new Date().toISOString().split('T')[0];

  const hasDates = Boolean(t.start_date && t.end_date);
  const hasDivisions = ageGroups.length > 0;
  const hasPublicContact = Boolean(t.contact_email || ctx.org.contactEmail);
  const hasOpenDivision = hasDivisions && ageGroups.some(group => !group.is_closed);
  const hasBranding = Boolean((t as any).logo_url || (t as any).hero_banner_url || (t as any).theme_preset || (t as any).theme_primary);
  const hasVenues   = (venuesRes.count ?? 0) > 0;
  const hasRules    = (rulesRes.count ?? 0) > 0;
  const hasFees     = t.fee_schedule_mode === 'age_group'
    ? ageGroups.some(g => g.total_fee_amount != null && g.total_fee_amount > 0)
    : Boolean(t.total_fee_amount && t.total_fee_amount > 0);

  const isTournamentDay = hasDates && today >= t.start_date! && today <= t.end_date!;

  // ── Game-day stats ────────────────────────────────────────────────
  const activeGames = games.filter(g => g.status !== 'cancelled');
  const poolGames   = activeGames.filter(g => !g.is_playoff);
  const playoffGames = activeGames.filter(g => g.is_playoff);

  const gameDayByDivision = ageGroups.map(g => {
    const divPool    = poolGames.filter(gm => gm.age_group_id === g.id);
    const divPlayoff = playoffGames.filter(gm => gm.age_group_id === g.id);

    const completedPlayoffRounds = divPlayoff
      .filter(gm => gm.status === 'completed')
      .map(gm => roundLabel(gm.bracket_code));
    const latestRound = completedPlayoffRounds.length > 0
      ? (ROUND_ORDER.filter(r => completedPlayoffRounds.includes(r)).pop() ?? completedPlayoffRounds[0])
      : null;

    const pendingPlayoffRounds = divPlayoff
      .filter(gm => gm.status !== 'completed')
      .map(gm => roundLabel(gm.bracket_code));
    const nextRound = pendingPlayoffRounds.length > 0
      ? (ROUND_ORDER.find(r => pendingPlayoffRounds.includes(r)) ?? pendingPlayoffRounds[0])
      : null;

    return {
      id: g.id,
      name: g.name,
      poolTotal:      divPool.length,
      poolCompleted:  divPool.filter(gm => gm.status === 'completed').length,
      playoffStarted: divPlayoff.length > 0,
      latestRound,
      nextRound,
    };
  });

  const totalGames     = activeGames.length;
  const completedGames = activeGames.filter(g => g.status === 'completed').length;
  const inProgressGames = activeGames.filter(g => g.status === 'submitted').length;
  const completedPct   = totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0;

  const gameDay = {
    totalGames,
    completed:            completedGames,
    inProgress:           inProgressGames,
    completedPct,
    poolGamesTotal:       poolGames.length,
    poolGamesCompleted:   poolGames.filter(g => g.status === 'completed').length,
    playoffStarted:       playoffGames.length > 0,
    playoffGamesTotal:    playoffGames.length,
    playoffGamesCompleted: playoffGames.filter(g => g.status === 'completed').length,
    byDivision: gameDayByDivision,
  };

  // ── Registration stats ────────────────────────────────────────────
  const byDivision = ageGroups.map(g => {
    const groupTeams = teamPayments.filter(tm => tm.age_group_id === g.id);
    return {
      id: g.id,
      name: g.name,
      capacity: g.capacity ?? null,
      accepted: groupTeams.filter(tm => tm.status === 'accepted').length,
      pending:  groupTeams.filter(tm => tm.status === 'pending').length,
      waitlist: groupTeams.filter(tm => tm.status === 'waitlist').length,
    };
  });

  const totalAccepted = byDivision.reduce((s, g) => s + g.accepted, 0);
  const totalPending  = byDivision.reduce((s, g) => s + g.pending, 0);
  const totalWaitlist = byDivision.reduce((s, g) => s + g.waitlist, 0);
  const totalCapacity = byDivision.reduce((s, g) => s + (g.capacity ?? 0), 0);

  // ── Payment stats — only accepted teams ───────────────────────────
  const acceptedTeams = teamPayments.filter(tm => tm.status === 'accepted');
  const feeMode = t.fee_schedule_mode ?? 'tournament';

  const paymentCounts = { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 };
  let totalExpected = 0;
  let totalCollected = 0;

  for (const tm of acceptedTeams) {
    const ag = ageGroups.find(g => g.id === tm.age_group_id);
    const fee = feeMode === 'age_group' && ag?.total_fee_amount != null
      ? { depositAmount: ag.deposit_amount, depositDueDate: ag.deposit_due_date, totalFeeAmount: ag.total_fee_amount, totalFeeDueDate: ag.total_fee_due_date }
      : { depositAmount: t.deposit_amount, depositDueDate: t.deposit_due_date, totalFeeAmount: t.total_fee_amount, totalFeeDueDate: t.total_fee_due_date };

    const totalFee   = fee.totalFeeAmount ?? 0;
    const depositAmt = fee.depositAmount ?? 0;
    const depDue     = fee.depositDueDate;
    const totDue     = fee.totalFeeDueDate;
    const depositPaid = Number(tm.deposit_paid ?? 0);
    const totalPaid   = Number(tm.total_paid ?? 0);

    if (!fee.totalFeeAmount) {
      paymentCounts.noSchedule++;
      continue;
    }

    totalExpected  += totalFee;
    totalCollected += totalPaid;

    if (totalPaid >= totalFee) {
      paymentCounts.paid++;
    } else if (totDue && today > totDue) {
      paymentCounts.pastDue++;
    } else if (depositAmt && depDue && today > depDue && depositPaid < depositAmt) {
      paymentCounts.pastDue++;
    } else if (depositAmt && depositPaid >= depositAmt) {
      paymentCounts.depositPaid++;
    } else {
      paymentCounts.pending++;
    }
  }

  return Response.json({
    ageGroups:     ageGroupsRes.count ?? ageGroups.length,
    teams:         teamsRes.count ?? 0,
    scheduled:     games.filter(game => game.status === 'scheduled').length,
    completed:     games.filter(game => game.status === 'completed').length,
    announcements: announcementsRes.count ?? 0,
    isTournamentDay,
    gameDay,
    publishChecklist: {
      hasDates,
      hasDivisions,
      hasPublicContact,
      hasOpenDivision,
      hasBranding,
      hasVenues,
      hasRules,
      hasFees,
      ready: hasDates && hasDivisions && hasPublicContact && hasOpenDivision,
    },
    registration: {
      totalCapacity,
      totalAccepted,
      totalPending,
      totalWaitlist,
      byDivision,
    },
    payment: {
      hasFeeSchedule: acceptedTeams.length > 0 && paymentCounts.noSchedule < acceptedTeams.length,
      totalExpected,
      totalCollected,
      counts: paymentCounts,
    },
  });
}
