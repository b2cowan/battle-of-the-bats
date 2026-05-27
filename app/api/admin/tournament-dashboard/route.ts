import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

type GameRow = {
  status: string | null;
  is_playoff: boolean | null;
  bracket_code: string | null;
  division_id: string | null;
};

type DivisionRow = {
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
  division_id: string;
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
  logo_url: string | null;
  hero_banner_url: string | null;
  theme_preset: string | null;
  theme_primary: string | null;
  settings: Record<string, unknown> | null;
  status: string | null;
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
    .select('start_date, end_date, contact_email, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary, settings, status')
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

  const [divisionsRes, teamsRes, gamesRes, announcementsRes, teamPaymentsRes, venuesRes, rulesRes] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name, is_closed, capacity, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date', { count: 'exact' })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('games')
      .select('status, is_playoff, bracket_code, division_id')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id, division_id, status, deposit_paid, total_paid')
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

  const queryError = divisionsRes.error ?? teamsRes.error ?? gamesRes.error ?? announcementsRes.error ?? teamPaymentsRes.error ?? venuesRes.error ?? rulesRes.error;
  if (queryError) {
    return Response.json({ error: queryError.message }, { status: 500 });
  }

  const games = (gamesRes.data ?? []) as GameRow[];
  const divisions = (divisionsRes.data ?? []) as DivisionRow[];
  const teamPayments = (teamPaymentsRes.data ?? []) as TeamPaymentRow[];
  const today = new Date().toISOString().split('T')[0];

  const hasDates = Boolean(t.start_date && t.end_date);
  const hasDivisions = divisions.length > 0;
  const hasPublicContact = Boolean(t.contact_email || ctx.org.contactEmail);
  const hasOpenDivision = hasDivisions && divisions.some(group => !group.is_closed);
  const hasBranding = Boolean(t.logo_url || t.hero_banner_url || t.theme_preset || t.theme_primary);
  const hasVenues   = (venuesRes.count ?? 0) > 0;
  const hasRules    = (rulesRes.count ?? 0) > 0;

  // Grandfathering: active/completed tournaments skip the new scope-gate requirements
  const isGrandfathered = t.status === 'active' || t.status === 'completed';
  const tSettings = (t.settings && typeof t.settings === 'object') ? t.settings : {};

  // hasFees: repurposed — now means "fee approach explicitly configured" (fee_scope set, or free)
  // Grandfathered tournaments auto-pass. New draft tournaments must set fee_scope.
  const hasFees = isGrandfathered || tSettings.fee_scope != null;

  // hasGameTiming: game_timing_scope explicitly set (not null)
  const hasGameTiming = isGrandfathered || tSettings.game_timing_scope != null;

  // hasTieBreakers: tie_breaker_scope explicitly set; if not per_division, tie_breakers array should also be present
  const hasTieBreakers = isGrandfathered || (
    tSettings.tie_breaker_scope != null &&
    (tSettings.tie_breaker_scope === 'per_division' || Array.isArray(tSettings.tie_breakers))
  );

  const isTournamentDay = hasDates && today >= t.start_date! && today <= t.end_date!;

  // ── Game-day stats ────────────────────────────────────────────────
  const activeGames = games.filter(g => g.status !== 'cancelled');
  const poolGames   = activeGames.filter(g => !g.is_playoff);
  const playoffGames = activeGames.filter(g => g.is_playoff);

  const gameDayByDivision = divisions.map(g => {
    const divPool    = poolGames.filter(gm => gm.division_id === g.id);
    const divPlayoff = playoffGames.filter(gm => gm.division_id === g.id);

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
  const byDivision = divisions.map(g => {
    const groupTeams = teamPayments.filter(tm => tm.division_id === g.id);
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
    const ag = divisions.find(g => g.id === tm.division_id);
    const fee = feeMode === 'division' && ag?.total_fee_amount != null
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
    divisions:     divisionsRes.count ?? divisions.length,
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
      hasGameTiming,
      hasTieBreakers,
      ready: hasDates && hasDivisions && hasPublicContact && hasOpenDivision && hasFees && hasGameTiming && hasTieBreakers,
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
