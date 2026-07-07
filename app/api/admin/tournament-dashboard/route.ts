import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import {
  getTournamentRegistrationFieldAnswersForRegistrations,
  getTournamentRegistrationFields,
  getTeams,
  getGames,
  getDivisions,
  computeTournamentStandings,
} from '@/lib/db';
import type { TournamentSettings } from '@/lib/types';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { buildRegistrationAttentionSummary } from '@/lib/registration-attention';
import { hasCapability } from '@/lib/roles';
import { buildScheduleMetrics, type ScheduleMetricGame } from '@/lib/schedule-metrics';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { tournamentNow, zonedWallClockToUtc } from '@/lib/timezone';
import { scheduledWindowState, type ScheduledWindowState } from '@/lib/game-live-state';
import { decidedFinalFor, type ChampionGameInput } from '@/lib/champions';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { coachEmailsPaused } from '@/lib/email';
import { resolveTournamentChatParticipants } from '@/lib/chat-resolvers';
import { getTournamentChatRoom, getActiveMemberUserIds } from '@/lib/chat-service';

type GameRow = {
  id: string;
  status: string | null;
  is_playoff: boolean | null;
  bracket_code: string | null;
  bracket_id: string | null;
  bracket_label: string | null;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  game_date: string | null;
  game_time: string | null;
  duration_minutes: number | null;
  location: string | null;
  diamond_id: string | null;
  venue_facility_id: string | null;
  schedule_facility_lane_id?: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_slot_id: string | null;
  away_slot_id: string | null;
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
  playoff_config: { tieBreakers?: string[] } | null;
};

type TeamPaymentRow = {
  id: string;
  name: string | null;
  email: string | null;
  division_id: string;
  status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
  slot_id: string | null;
  waitlist_position: number | null;
  registered_at: string | null;
  check_in_status: string | null;
};

type DivPayCounts = { paid: number; depositPaid: number; pending: number; pastDue: number; total: number };

type TournamentFeeRow = {
  start_date: string | null;
  end_date: string | null;
  contact_email: string | null;
  default_contact_member_id: string | null;
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
  notify_teams_on_complete: boolean | null;
  results_notified_at: string | null;
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

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export const GET = withObservability(async (req: Request) => {
  const searchParams = new URL(req.url).searchParams;
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
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
    .select('start_date, end_date, contact_email, default_contact_member_id, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary, settings, status, notify_teams_on_complete, results_notified_at')
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

  const [divisionsRes, teamsRes, gamesRes, announcementsRes, teamPaymentsRes, poolSlotsRes, venuesRes, rulesRes] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name, is_closed, capacity, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, playoff_config', { count: 'exact' })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('games')
      .select('*')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('announcements')
      .select('id, title, published_at, channel_email, email_recipient_count')
      .eq('tournament_id', tournamentId)
      .is('deleted_at', null),
    supabaseAdmin
      .from('teams')
      .select('id, name, email, division_id, status, deposit_paid, total_paid, slot_id, waitlist_position, registered_at, check_in_status')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('pool_slots')
      .select('division_id')
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

  const namedErrors: [string, typeof divisionsRes.error][] = [
    ['divisions', divisionsRes.error],
    ['teams', teamsRes.error],
    ['games', gamesRes.error],
    ['announcements', announcementsRes.error],
    ['teamPayments', teamPaymentsRes.error],
    ['poolSlots', poolSlotsRes.error],
    ['venues', venuesRes.error],
    ['rules', rulesRes.error],
  ];
  const failedQuery = namedErrors.find(([, err]) => err != null);
  if (failedQuery) {
    const [queryName, queryError] = failedQuery;
    console.error(`[tournament-dashboard] query failed: ${queryName}`, queryError);
    return Response.json({ error: `${queryName}: ${queryError!.message}` }, { status: 500 });
  }

  const games = (gamesRes.data ?? []) as GameRow[];
  const divisions = (divisionsRes.data ?? []) as DivisionRow[];
  const teamPayments = (teamPaymentsRes.data ?? []) as TeamPaymentRow[];

  // ── Communications stats ──────────────────────────────────────────
  type AnnouncementRow = { id: string; title: string; published_at: string | null; channel_email: boolean | null; email_recipient_count: number | null };
  const announcements = (announcementsRes.data ?? []) as AnnouncementRow[];
  const emailAnnouncements = announcements.filter(a => a.channel_email);
  const latestAnnouncement = announcements
    .filter(a => a.published_at)
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0] ?? null;
  const communications = {
    total: announcements.length,
    emailsSent: emailAnnouncements.length,
    totalRecipients: emailAnnouncements.reduce((sum, a) => sum + (a.email_recipient_count ?? 0), 0),
    latestTitle: latestAnnouncement?.title ?? null,
    latestDate:  latestAnnouncement?.published_at ?? null,
  };
  const slotConfiguredDivisionIds = new Set((poolSlotsRes.data ?? [])
    .map(slot => slot.division_id as string | null)
    .filter((divisionId): divisionId is string => Boolean(divisionId)));
  const today = tournamentNow().date;

  const hasDates = Boolean(t.start_date && t.end_date);
  const hasDivisions = divisions.length > 0;
  // A contact is satisfied by a selected contact member, a tournament-level
  // contact email, OR the org fallback (the three sources resolveTournamentContactEmail
  // draws from) — kept in lockstep with the activation blocker so the checklist
  // never claims "ready" while activation 400s, or vice versa.
  const hasPublicContact = Boolean(t.default_contact_member_id || t.contact_email || ctx.org.contactEmail);
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

  // Game-day boundary: within event dates OR the first game has started
  // (any game submitted/completed, or its scheduled start time has passed).
  const nowTime = tournamentNow().time;
  const firstGameStarted = activeGames.some(g =>
    g.status === 'submitted' || g.status === 'completed' ||
    (g.game_date != null && (
      g.game_date < today ||
      (g.game_date === today && g.game_time != null && g.game_time <= nowTime)
    ))
  );
  const isGameDay = isTournamentDay || firstGameStarted;

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

  // ── Champions (resolved playoff finals) ───────────────────────────
  // TIER-AWARE via the shared lib/champions helper (single source of truth with the
  // public surfaces): a division's champion is the winner of its TOP tier's decided
  // final (GF2 → GF → FIN priority), never an arbitrary lower-tier/consolation final.
  // (Was a naive `bracket_code === 'FIN'` + latest-date scan that crowned the wrong
  // tier when a division had Tier 1 + Tier 2 brackets sharing final codes.)
  const teamNameById = new Map(teamPayments.map(tm => [tm.id, tm.name ?? 'Team'] as const));
  const champGames: ChampionGameInput[] = playoffGames.map(g => ({
    isPlayoff: g.is_playoff,
    divisionId: g.division_id,
    bracketId: g.bracket_id,
    bracketLabel: g.bracket_label,
    bracketCode: g.bracket_code,
    status: g.status,
    homeScore: g.home_score,
    awayScore: g.away_score,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
  }));
  const champions = divisions
    .map(div => {
      const final = decidedFinalFor(champGames, div.id);
      if (!final) return null;
      const winnerId = (final.homeScore ?? 0) > (final.awayScore ?? 0) ? final.homeTeamId : final.awayTeamId;
      if (!winnerId) return null;
      return { divisionId: div.id, divisionName: div.name, championTeamName: teamNameById.get(winnerId) ?? 'Champion' };
    })
    .filter((c): c is { divisionId: string; divisionName: string; championTeamName: string } => c !== null);

  const totalGames     = activeGames.length;
  const completedGames = activeGames.filter(g => g.status === 'completed').length;
  const forfeitGames   = activeGames.filter(g => g.status === 'forfeit').length;
  // "Resolved" = every terminal state (a forfeit is a finished game). Drives the
  // dashboard's "ready to finalize" prompt — a tournament that ends on a forfeit
  // must still count as done, so this is separate from the completed-only display.
  const resolvedGames  = completedGames + forfeitGames;
  const inProgressGames = activeGames.filter(g => g.status === 'submitted').length;
  const completedPct   = totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0;

  // ── Game-day sections: Now Playing / Up Next / Needs a Score (J1-085) ──
  // One pass classifies each game into three honest, mutually-exclusive buckets
  // via the SHARED window classifier (lib/game-live-state), so the dashboard and
  // the Schedule screen never disagree. Start instants are real UTC (DST-correct,
  // cross-midnight-safe) via zonedWallClockToUtc — never the raw UTC clock that
  // caused the "not-yet-started shows as LIVE" bug.
  const divisionNameById = new Map(divisions.map(d => [d.id, d.name] as const));
  const defaultDurationMin = positiveNumber(tSettings.game_duration_minutes) ?? 60;
  const nowMs = Date.now();

  // Per-game window state (scheduled games only), computed once. A game with a real
  // start time is classified by its play window (DST-correct via zonedWallClockToUtc).
  // A timeless game (date but no start time) has no window to test, so fall back to its
  // date: a past day is 'overdue' so it still surfaces in Needs a Score (the old
  // safety-net behaviour — never lose an unscored past game); today/future stays
  // 'future' (window unknown — never false-positive "live").
  const windowStateById = new Map<string, ScheduledWindowState>();
  for (const g of activeGames) {
    if (g.status !== 'scheduled') continue;
    const iso = zonedWallClockToUtc(g.game_date, g.game_time);
    if (iso) {
      windowStateById.set(g.id, scheduledWindowState(new Date(iso).getTime(), g.duration_minutes ?? defaultDurationMin, nowMs));
    } else {
      windowStateById.set(g.id, g.game_date != null && g.game_date < today ? 'overdue' : 'future');
    }
  }

  const toGameStat = (g: GameRow) => ({
    id: g.id,
    homeTeamName: g.home_team_id ? (teamNameById.get(g.home_team_id) ?? 'TBD') : 'TBD',
    awayTeamName: g.away_team_id ? (teamNameById.get(g.away_team_id) ?? 'TBD') : 'TBD',
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    time: g.game_time,
    location: g.location,
    divisionName: g.division_id ? (divisionNameById.get(g.division_id) ?? null) : null,
    isPlayoff: g.is_playoff,
  });
  const byStartAsc = (a: GameRow, b: GameRow) =>
    String(a.game_date ?? '').localeCompare(String(b.game_date ?? ''))
    || String(a.game_time ?? '').localeCompare(String(b.game_time ?? ''));

  // NOW PLAYING — being scored, or scheduled and inside its play window. In-review
  // (submitted) first, then by start time. Capped so the board strip stays compact.
  const allLiveGames = activeGames
    .filter(g => g.status === 'submitted' || (g.status === 'scheduled' && windowStateById.get(g.id) === 'live'))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'submitted' ? -1 : 1;
      return byStartAsc(a, b);
    });
  const liveGamesTotal = allLiveGames.length;
  const liveGames = allLiveGames.slice(0, 8).map(toGameStat);

  // UP NEXT — scheduled, not started yet, TODAY only (tournament-local), earliest first.
  const allUpNextGames = activeGames
    .filter(g => g.status === 'scheduled' && g.game_date === today && windowStateById.get(g.id) === 'future')
    .sort(byStartAsc);
  const upNextTotal = allUpNextGames.length;
  const upNextGames = allUpNextGames.slice(0, 8).map(toGameStat);

  // NEEDS A SCORE — scheduled but its window has fully elapsed (any day). The safety
  // net so a finished-but-unscored game is never hidden. Oldest (most overdue) first.
  const allNeedsScoreGames = activeGames
    .filter(g => g.status === 'scheduled' && windowStateById.get(g.id) === 'overdue')
    .sort(byStartAsc);
  const needsScoreTotal = allNeedsScoreGames.length;
  const needsScoreGames = allNeedsScoreGames.slice(0, 8).map(toGameStat);

  const gameDay = {
    totalGames,
    completed:            completedGames,
    resolved:             resolvedGames,
    inProgress:           inProgressGames,
    completedPct,
    poolGamesTotal:       poolGames.length,
    poolGamesCompleted:   poolGames.filter(g => g.status === 'completed').length,
    playoffStarted:       playoffGames.length > 0,
    playoffGamesTotal:    playoffGames.length,
    playoffGamesCompleted: playoffGames.filter(g => g.status === 'completed').length,
    // Playoff games in any terminal state (completed or forfeit) — drives the
    // "Playoffs complete" vs "Playoffs underway" By-Division footer.
    playoffResolved:      playoffGames.filter(g => g.status === 'completed' || g.status === 'forfeit').length,
    byDivision: gameDayByDivision,
    liveGames,
    liveGamesTotal,
    upNextGames,
    upNextTotal,
    needsScoreGames,
    needsScoreTotal,
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const acceptedTeams = teamPayments.filter(tm => tm.status === 'accepted');
  const registrationVelocity = acceptedTeams.filter(tm => tm.registered_at != null && tm.registered_at >= sevenDaysAgo).length;

  // 7-day daily registration counts (oldest → newest) — derived from existing data, no extra query
  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().split('T')[0];
    return acceptedTeams.filter(tm => tm.registered_at != null && tm.registered_at.startsWith(dayStr)).length;
  });
  const feeMode = t.fee_schedule_mode ?? 'tournament';
  const scheduleMetricGames: ScheduleMetricGame[] = activeGames
    .filter(game => game.game_date && game.game_time)
    .map(game => ({
      id: game.id,
      divisionId: game.division_id ?? '',
      homeTeamId: game.home_team_id,
      awayTeamId: game.away_team_id,
      homeSlotId: game.home_slot_id,
      awaySlotId: game.away_slot_id,
      homePlaceholder: game.home_placeholder,
      awayPlaceholder: game.away_placeholder,
      date: game.game_date,
      time: game.game_time,
      venueId: game.diamond_id,
      venueFacilityId: game.venue_facility_id,
      scheduleFacilityLaneId: game.schedule_facility_lane_id ?? null,
      location: game.location,
      status: game.status,
      isPlayoff: game.is_playoff,
    }));
  const savedHealthRules = (tSettings as TournamentSettings).schedule_health_rules;
  const scheduleMetrics = buildScheduleMetrics({
    games: scheduleMetricGames,
    teams: acceptedTeams.map(team => ({
      id: team.id,
      name: team.name ?? 'Team',
      divisionId: team.division_id,
      status: team.status,
    })),
    gameDurationMinutes: positiveNumber(tSettings.game_duration_minutes),
    bufferMinutes: positiveNumber(tSettings.buffer_minutes),
    // Organizer-defined Schedule Health rules so the dashboard score/tone match the Schedule panel.
    maxGamesPerDay: positiveNumber(savedHealthRules?.maxGamesPerDay),
    minRestMinutes: nonNegativeNumber(savedHealthRules?.minRestMinutes),
    expectedGamesPerParticipant: positiveNumber(savedHealthRules?.targetGamesPerTeam ?? undefined),
    manualTravelBuffers: {
      venueChangeMinutes: positiveNumber(tSettings.schedule_travel_venue_buffer_minutes),
      facilityChangeMinutes: positiveNumber(tSettings.schedule_travel_facility_buffer_minutes),
    },
    includePlayoffs: false,
  });
  const scheduleHealth = {
    score: scheduleMetrics.healthScore,
    tone: scheduleMetrics.healthTone,
    issueCount: scheduleMetrics.issues.length,
    topIssue: scheduleMetrics.issues[0]?.title ?? null,
    totalGames: activeGames.length,
    timedGames: scheduleMetrics.totalGames,
    participantCount: scheduleMetrics.participantCount,
    backToBack: scheduleMetrics.backToBackCount,
    maxGamesInDay: scheduleMetrics.maxGamesInDay,
    maxGamesPerDay: scheduleMetrics.maxGamesPerDay,
    venueChanges: scheduleMetrics.venueChangeCount,
    facilityChanges: scheduleMetrics.facilityChangeCount,
    conflicts: scheduleMetrics.venueConflictCount + scheduleMetrics.bufferConflictCount,
    travelBufferWarnings: scheduleMetrics.travelBufferWarningCount,
    unresolvedFacilities: scheduleMetrics.unresolvedFacilityLaneCount,
    minGamesPerParticipant: scheduleMetrics.minGamesPerParticipant,
    maxGamesPerParticipant: scheduleMetrics.maxGamesPerParticipant,
    averageGamesPerParticipant: scheduleMetrics.averageGamesPerParticipant,
  };

  const paymentCounts = { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 };
  let totalExpected = 0;
  let totalCollected = 0;

  const divPayMap = new Map<string, DivPayCounts>();
  for (const div of divisions) {
    divPayMap.set(div.id, { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, total: 0 });
  }

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

    const divCounts = divPayMap.get(tm.division_id);

    if (!fee.totalFeeAmount) {
      paymentCounts.noSchedule++;
      continue;
    }

    totalExpected  += totalFee;
    totalCollected += totalPaid;

    let bucket: 'paid' | 'depositPaid' | 'pending' | 'pastDue';
    if (totalPaid >= totalFee) {
      bucket = 'paid';
    } else if (totDue && today > totDue) {
      bucket = 'pastDue';
    } else if (depositAmt && depDue && today > depDue && depositPaid < depositAmt) {
      bucket = 'pastDue';
    } else if (depositAmt && depositPaid >= depositAmt) {
      bucket = 'depositPaid';
    } else {
      bucket = 'pending';
    }

    paymentCounts[bucket]++;
    if (divCounts) {
      divCounts[bucket]++;
      divCounts.total++;
    }
  }

  const paymentByDivision = divisions.map(div => ({
    id: div.id,
    name: div.name,
    ...(divPayMap.get(div.id) ?? { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, total: 0 }),
  }));

  const [registrationFields, registrationAnswers] = await Promise.all([
    getTournamentRegistrationFields(tournamentId),
    getTournamentRegistrationFieldAnswersForRegistrations(teamPayments.map(team => team.id)),
  ]);
  const answersByRegistration = new Map<string, Array<{
    fieldId: string;
    valueText: string | null;
    valueJson: unknown;
    fileUrl: string | null;
  }>>();

  for (const answer of registrationAnswers) {
    const list = answersByRegistration.get(answer.registrationId) ?? [];
    list.push({
      fieldId: answer.fieldId,
      valueText: answer.valueText,
      valueJson: answer.valueJson,
      fileUrl: answer.fileUrl,
    });
    answersByRegistration.set(answer.registrationId, list);
  }

  const registrationAttention = buildRegistrationAttentionSummary(
    teamPayments.map(team => ({
      id: team.id,
      divisionId: team.division_id,
      status: team.status,
      depositPaid: team.deposit_paid,
      totalPaid: team.total_paid,
      slotId: team.slot_id,
      waitlistPosition: team.waitlist_position,
      customAnswers: answersByRegistration.get(team.id) ?? [],
    })),
    {
      divisions: divisions.map(group => ({
        id: group.id,
        name: group.name,
        depositAmount: group.deposit_amount,
        depositDueDate: group.deposit_due_date,
        totalFeeAmount: group.total_fee_amount,
        totalFeeDueDate: group.total_fee_due_date,
      })),
      requiredFields: registrationFields
        .filter(field => field.required)
        .map(field => ({
          id: field.id,
          label: field.label,
          fieldType: field.fieldType,
          required: field.required,
        })),
      feeMode,
      feeSchedule: {
        depositAmount: t.deposit_amount,
        depositDueDate: t.deposit_due_date,
        totalFeeAmount: t.total_fee_amount,
        totalFeeDueDate: t.total_fee_due_date,
      },
      slotConfiguredDivisionIds,
      today,
    },
  );

  // ── Coin-toss nudge ───────────────────────────────────────────────
  // Surface divisions where a tied group is still awaiting an admin coin toss.
  // Only runs when 'coin' is actually configured somewhere (cheap guard), then
  // ranks each such division in-memory via the pure standings engine.
  const coinTossNeeded: { divisionId: string; divisionName: string; teamNames: string[] }[] = [];
  const tournamentUsesCoin = Array.isArray(tSettings.tie_breakers) && tSettings.tie_breakers.includes('coin');
  const anyDivisionUsesCoin = divisions.some(d => Array.isArray(d.playoff_config?.tieBreakers) && d.playoff_config!.tieBreakers!.includes('coin'));
  if (tournamentUsesCoin || anyDivisionUsesCoin) {
    try {
      const [domainTeams, domainGames, domainDivisions] = await Promise.all([
        getTeams(tournamentId, { admin: true }),
        getGames(tournamentId, { admin: true }),
        getDivisions(tournamentId, { admin: true }),
      ]);
      for (const d of domainDivisions) {
        const effectiveBreakers = d.playoffConfig?.tieBreakers ?? tSettings.tie_breakers;
        if (!Array.isArray(effectiveBreakers) || !effectiveBreakers.includes('coin')) continue;
        const rows = computeTournamentStandings(d.id, domainTeams, domainGames, d.playoffConfig, tSettings as TournamentSettings);
        const flagged = rows.filter(r => r.needsCoinToss).map(r => r.teamName);
        if (flagged.length > 0) {
          coinTossNeeded.push({ divisionId: d.id, divisionName: d.name, teamNames: flagged });
        }
      }
    } catch (e) {
      console.error('[tournament-dashboard] coin-toss check failed', e);
    }
  }

  // ── Tournament Chat adoption funnel ───────────────────────────────
  // Turns "teams registered" into the next goal: how many teams have a coach who signed up
  // for their portal (the prerequisite for Tournament Chat), and how many are in the room.
  // Reuses the CANONICAL resolver (lib/chat-resolvers) so the numbers never drift from chat
  // itself. Only computed for plan tiers that include the feature — a free org gets the
  // locked-upsell shape instead. Chat-table reads (room + members, tournament_plus feature)
  // are wrapped so a missing/degraded chat surface degrades to roomOpen=false without failing
  // the funnel (the funnel's own tables are all always-live).
  type ChatAdoption = {
    eligible: boolean;
    roomOpen: boolean;
    teamsTotal: number;
    teamsWithEmail: number;
    coachesSignedUp: number;
    notJoined: number;
    notJoinedRemindable: number;
    inChat: number;
    upsellCopy: string | null;
  };
  let chatAdoption: ChatAdoption | null = null;
  if (hasPlanFeature(ctx.org.planId, 'tournament_chat')) {
    try {
      const { userIds, pending } = await resolveTournamentChatParticipants(tournamentId);
      // Match the resolver's team universe EXACTLY: its Supabase `.neq('status','rejected')` excludes
      // rejected AND null-status rows (SQL `<> 'rejected'` is null on NULL). teams.status is nullable
      // on prod (NOT NULL only on dev — a documented drift), so filtering out null here too keeps
      // teamsTotal and `notJoined` (pending) counted over the same set — otherwise a null-status team
      // would inflate coachesSignedUp.
      const nonRejected = teamPayments.filter(tm => tm.status != null && tm.status !== 'rejected');
      const teamsTotal = nonRejected.length;
      const teamsWithEmail = nonRejected.filter(tm => (tm.email ?? '').trim() !== '').length;
      const notJoined = pending.length;
      const notJoinedRemindable = pending.filter(p => (p.email ?? '').trim() !== '').length;
      const coachesSignedUp = Math.max(0, teamsTotal - notJoined);

      let roomOpen = false;
      let inChat = 0;
      try {
        const room = await getTournamentChatRoom(tournamentId);
        if (room) {
          roomOpen = true;
          const activeIds = await getActiveMemberUserIds(room.id);
          const coachSet = new Set(userIds); // coaches only — never count org moderators as "in chat"
          inChat = activeIds.filter(id => coachSet.has(id)).length;
        }
      } catch (e) {
        console.error('[tournament-dashboard] chat room read failed (non-fatal)', e);
      }

      chatAdoption = {
        eligible: true,
        roomOpen,
        teamsTotal,
        teamsWithEmail,
        coachesSignedUp,
        notJoined,
        notJoinedRemindable,
        inChat,
        upsellCopy: null,
      };
    } catch (e) {
      // Funnel compute failed entirely — leave chatAdoption null so the panel simply omits itself
      // rather than showing zeros that read as "nobody signed up".
      console.error('[tournament-dashboard] chat adoption compute failed (non-fatal)', e);
      chatAdoption = null;
    }
  } else {
    chatAdoption = {
      eligible: false,
      roomOpen: false,
      teamsTotal: 0,
      teamsWithEmail: 0,
      coachesSignedUp: 0,
      notJoined: 0,
      notJoinedRemindable: 0,
      inChat: 0,
      upsellCopy: requiresPlanCopy('tournament_chat'),
    };
  }

  return Response.json({
    coinTossNeeded,
    chatAdoption,
    divisions:      divisionsRes.count ?? divisions.length,
    teams:          teamsRes.count ?? 0,
    scheduled:      games.filter(game => game.status === 'scheduled').length,
    totalGames:     activeGames.length,
    completed:      games.filter(game => game.status === 'completed').length,
    communications,
    scheduleHealth,
    isTournamentDay,
    isGameDay,
    gameDay,
    champions,
    // Whether marking complete will ACTUALLY email a results summary to team contacts,
    // mirroring every suppression the server-side sender applies (set-status → completed):
    // the per-event toggle on, org-wide coach emails not paused, not already sent once, and
    // the plan includes post-event summaries. Keeps the one-click complete confirm honest
    // (e.g. a reopen→re-complete won't re-email, so it must not promise one).
    notifyTeamsOnComplete: Boolean(t.notify_teams_on_complete)
      && !coachEmailsPaused(t.settings)
      && !t.results_notified_at
      && hasPlanFeature(ctx.org.planId, 'post_tournament_summary'),
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
      // Fees are OPTIONAL to activate (owner decision 2026-06-16, J1-030/032):
      // the server activation blocker never enforced fee_scope, and the wizard
      // never asks for it — so the "ready" gate no longer requires it either.
      // hasFees is still surfaced as an optional checklist item below.
      // Opening public registration is OPTIONAL to activate (owner decision
      // 2026-06-16): organizers who load/invite teams privately never open a
      // division, so hasOpenDivision is surfaced as an optional item below
      // rather than gating activation.
      ready: hasDates && hasDivisions,
    },
    registration: {
      totalCapacity,
      totalAccepted,
      totalPending,
      totalWaitlist,
      byDivision,
      velocity: registrationVelocity,
      weeklyTrend,
    },
    checkIn: {
      accepted: acceptedTeams.length,
      checkedIn: acceptedTeams.filter(tm => tm.check_in_status === 'checked_in').length,
      noShow: acceptedTeams.filter(tm => tm.check_in_status === 'no_show').length,
    },
    payment: {
      hasFeeSchedule: acceptedTeams.length > 0 && paymentCounts.noSchedule < acceptedTeams.length,
      totalExpected,
      totalCollected,
      counts: paymentCounts,
      byDivision: paymentByDivision,
    },
    registrationAttention,
  });
}, { route: '/api/admin/tournament-dashboard' });
