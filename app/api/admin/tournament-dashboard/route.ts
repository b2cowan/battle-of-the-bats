import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import {
  getTournamentRegistrationFieldAnswersForRegistrations,
  getTournamentRegistrationFields,
  getTeams,
  getGames,
  getDivisions,
} from '@/lib/db';
import type { Division, Tournament, TournamentSettings } from '@/lib/types';
import { pendingCoinTosses, type PendingToss } from '@/lib/coin-toss';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { ourTournamentTeamIds } from '@/lib/club-own-tournament-team';
import { buildRegistrationAttentionSummary } from '@/lib/registration-attention';
import { buildRegistrationCapacity, buildRegistrationHealth, countRegistrationHealthTeams, registrationDaysUntilStart } from '@/lib/registration-health';
import { hasCapability } from '@/lib/roles';
import { buildEventScheduleHealth, scheduleMetricGameFromRow } from '@/lib/schedule-metrics';
import { getOrgOwnerEmail, supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { tournamentNow } from '@/lib/timezone';
import { gameWindowState, type ScheduledWindowState } from '@/lib/game-live-state';
import { gameLengthMinutes } from '@/lib/booking-length';
import { decidedFinalFor, type ChampionGameInput } from '@/lib/champions';
import { loadEventRecap } from '@/lib/event-recap-read';
import { hasFirstGameStarted, isGameDay as isGameDayRule } from '@/lib/tournament-phase';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { willEmailResultsOnComplete } from '@/lib/coach-email-rules';
import { resolveTournamentChatParticipants } from '@/lib/chat-resolvers';
import { getTournamentChatRoom, getActiveMemberUserIds } from '@/lib/chat-service';
import { CHAT_PAUSED } from '@/lib/chat-pause';
import { activationMissing, contactSourceOf } from '@/lib/tournament-activation';
import type { BoardFees, DraftSetup } from '@/lib/tournament-board-words';
import { normalizeTieBreakers } from '@/lib/tie-breakers';
import { normalizeHiddenPublicPages, visiblePublicPages, PUBLIC_PAGE_OPTIONS } from '@/lib/public-pages';
import { DEFAULT_SPORT } from '@/lib/sports';
import { tournamentTracksPayments } from '@/lib/tournament-payments-tracked';
import { lowerEntry } from '@/lib/tournament-teams';

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
  settings: { game_duration_minutes?: unknown } | null;
  /** Its pools — the invite-only event's Teams card counts them ("8 teams · 2 pools", the free tournament tier). */
  pools?: Array<{ id: string }> | null;
};

type TeamPaymentRow = {
  id: string;
  /** 12c (mig 382): the entry lowered by part refunds. */
  entry_lowered: number | null;
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
  seed: number | null;
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
  sport: string | null;
  public_hidden_pages: unknown;
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
    .select('start_date, end_date, contact_email, default_contact_member_id, fee_schedule_mode, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, logo_url, hero_banner_url, theme_preset, theme_primary, settings, status, sport, public_hidden_pages, notify_teams_on_complete, results_notified_at, chat_reminder_last_sent_at')
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

  const [divisionsRes, teamsRes, gamesRes, announcementsRes, teamPaymentsRes, poolSlotsRes, venuesRes, rulesRes, lanesRes] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name, is_closed, capacity, deposit_amount, deposit_due_date, total_fee_amount, total_fee_due_date, playoff_config, settings, pools(id)', { count: 'exact' })
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
      .select('id, name, email, division_id, status, deposit_paid, total_paid, entry_lowered, slot_id, waitlist_position, registered_at, check_in_status, seed')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('pool_slots')
      .select('division_id')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('diamonds')
      .select('id, name', { count: 'exact' })
      .eq('tournament_id', tournamentId)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('rules')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId),
    // The draft's Venues row counts the lanes ("Lions Park · 3 diamonds").
    supabaseAdmin
      .from('venue_facilities')
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
    ['lanes', lanesRes.error],
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
  // The one rule Activate reads (lib/tournament-activation, F82).
  const activationFacts = {
    startDate: t.start_date,
    endDate: t.end_date,
    divisionCount: divisions.length,
  };
  // Never missing: with nobody chosen it is the organization's owner (owner ruling 2026-10-19).
  const contactSource = contactSourceOf({
    defaultContactMemberId: t.default_contact_member_id,
    contactEmail: t.contact_email,
    orgContactEmail: ctx.org.contactEmail,
  });
  const hasPublicContact = true;
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

  // Game-day boundary: within event dates OR the first game has started — THE rule in
  // lib/tournament-phase, which the event header's chip reads too (G1: one chip, one rule).
  const nowTime = tournamentNow().time;
  const firstGameStarted = hasFirstGameStarted(
    activeGames.map(g => ({ status: g.status, date: g.game_date, time: g.game_time })),
    { date: today, time: nowTime },
  );
  const isGameDay = isGameDayRule({ startDate: t.start_date, endDate: t.end_date, firstGameStarted, today });

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

    // A forfeit is a finished game (the summary card's "games final" counts it), so it neither
    // keeps a round "to play" nor goes missing from a pool's final count.
    const pendingPlayoff = divPlayoff.filter(gm => gm.status !== 'completed' && gm.status !== 'forfeit');
    const pendingPlayoffRounds = pendingPlayoff.map(gm => roundLabel(gm.bracket_code));
    const nextRound = pendingPlayoffRounds.length > 0
      ? (ROUND_ORDER.find(r => pendingPlayoffRounds.includes(r)) ?? pendingPlayoffRounds[0])
      : null;
    const nextRoundGames = nextRound ? pendingPlayoff.filter(gm => roundLabel(gm.bracket_code) === nextRound) : [];

    return {
      id: g.id,
      name: g.name,
      poolTotal:      divPool.length,
      poolCompleted:  divPool.filter(gm => gm.status === 'completed' || gm.status === 'forfeit').length,
      playoffStarted: divPlayoff.length > 0,
      latestRound,
      nextRound,
      // The board's division line names ONE game by its own round ("Final", "Semifinal") and
      // several by the group ("Semifinals").
      nextRoundLabel: nextRoundGames.length === 1 ? bracketRoundLabel(nextRoundGames[0].bracket_code) : nextRound,
      nextRoundGameIds: nextRoundGames.map(gm => gm.id),
      // A next-round game already played and waiting for the organizer is under way, not "to play".
      nextRoundSubmitted: nextRoundGames.some(gm => gm.status === 'submitted'),
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
  // A game's length is THE chain (A39, lib/booking-length.ts): its own, its division's, the tournament's, the one
  // booking length. Playing now lasts exactly that long (it used to skip the division and default to 60).
  const divisionMinutesById = new Map(divisions.map(d => [d.id, d.settings?.game_duration_minutes] as const));
  const lengthOf = (g: { duration_minutes: number | null; division_id: string | null }) =>
    gameLengthMinutes(g.duration_minutes, g.division_id ? divisionMinutesById.get(g.division_id) : undefined, tSettings.game_duration_minutes);
  const nowMs = Date.now();

  // Per-game window state (scheduled games only), computed once — the shared rule Results' bands read
  // too (a timeless game on a past day is 'overdue', so it still surfaces in Needs a score).
  const windowStateById = new Map<string, ScheduledWindowState>();
  for (const g of activeGames) {
    if (g.status !== 'scheduled') continue;
    windowStateById.set(g.id, gameWindowState({
      date: g.game_date,
      time: g.game_time,
      durationMinutes: lengthOf(g),
      nowMs,
      today,
    }));
  }

  const toGameStat = (g: GameRow) => ({
    id: g.id,
    homeTeamName: g.home_team_id ? (teamNameById.get(g.home_team_id) ?? 'TBD') : 'TBD',
    awayTeamName: g.away_team_id ? (teamNameById.get(g.away_team_id) ?? 'TBD') : 'TBD',
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    date: g.game_date,
    time: g.game_time,
    location: g.location,
    divisionName: g.division_id ? (divisionNameById.get(g.division_id) ?? null) : null,
    isPlayoff: g.is_playoff,
    // The row's caption names a playoff game's round ("Semifinal") — the admin's singular label.
    round: g.is_playoff ? bracketRoundLabel(g.bracket_code) : null,
  });
  const byStartAsc = (a: GameRow, b: GameRow) =>
    String(a.game_date ?? '').localeCompare(String(b.game_date ?? ''))
    || String(a.game_time ?? '').localeCompare(String(b.game_time ?? ''));

  // TO FINALIZE — a score a scorekeeper submitted, waiting for the organizer (Pending review).
  // Its own list since Stage 1 (G2): it used to sit under Now Playing as "IN REVIEW", so the board
  // opened on scores nobody was playing, filed as live games.
  const allToFinalizeGames = activeGames.filter(g => g.status === 'submitted').sort(byStartAsc);
  const toFinalizeTotal = allToFinalizeGames.length;
  const toFinalizeGames = allToFinalizeGames.slice(0, 8).map(toGameStat);

  // NOW PLAYING — scheduled and inside its play window, earliest first. Capped so the board stays compact.
  const allLiveGames = activeGames
    .filter(g => g.status === 'scheduled' && windowStateById.get(g.id) === 'live')
    .sort(byStartAsc);
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

  // The division line's "in progress": a game of the division's next round is inside its play window,
  // or already played and waiting to be finalized.
  const liveIds = new Set(allLiveGames.map(g => g.id));
  const byDivisionWithLive = gameDayByDivision.map(({ nextRoundGameIds, nextRoundSubmitted, ...d }) => ({
    ...d,
    nextRoundLive: nextRoundSubmitted || nextRoundGameIds.some(id => liveIds.has(id)),
  }));

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
    byDivision: byDivisionWithLive,
    toFinalizeGames,
    toFinalizeTotal,
    liveGames,
    liveGamesTotal,
    upNextGames,
    upNextTotal,
    needsScoreGames,
    needsScoreTotal,
    // The rain-delay tool works on unplayed games from today on; with none left, its door is not shown.
    hasGamesToShift: activeGames.some(g => g.status === 'scheduled' && g.game_date != null && g.game_date >= today),
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
      pools: g.pools?.length ?? 0,
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
  // "Not tracked here": no team owes anything and no payment figure counts — whatever amount was typed before.
  const tracksPayments = tournamentTracksPayments(tSettings);
  // THE event's health, the Schedule page's own call (owner 2026-10-19): every game, pool and playoff, each division's
  // timing, the bracket wiring and the saved rules, so the board and the Schedule show one number.
  const scheduleMetrics = buildEventScheduleHealth({
    games: games.map(scheduleMetricGameFromRow),
    teams: teamPayments.map(team => ({
      id: team.id,
      name: team.name ?? 'Team',
      divisionId: team.division_id,
      status: team.status,
      seed: team.seed ?? null,
    })),
    divisions: divisions.map(d => ({
      id: d.id,
      settings: d.settings as Division['settings'],
      playoffConfig: d.playoff_config as Division['playoffConfig'],
    })),
    tournament: { settings: tSettings as Tournament['settings'] },
  });
  const scheduleHealth = {
    score: scheduleMetrics.healthScore,
    tone: scheduleMetrics.healthTone,
    issueCount: scheduleMetrics.issues.length,
    topIssue: scheduleMetrics.issues[0]?.title ?? null,
    totalGames: activeGames.length,
    timedGames: scheduleMetrics.timedGames,
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

  // The host club's own team (linked to one of its rep teams) pays no entry fee, on every plan — the one answer
  // (lib/club-own-tournament-team.ts) — so it is never owed, never past due, and its fee never lands in Expected.
  const clubOwnTeamIds = await ourTournamentTeamIds(tournamentId);

  const paymentCounts = { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 };
  let totalExpected = 0;
  let totalCollected = 0;

  const divPayMap = new Map<string, DivPayCounts>();
  for (const div of divisions) {
    divPayMap.set(div.id, { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, total: 0 });
  }

  // 12c Part 6: teams with a bank debit on its way (never past due while it clears).
  const { data: clearingRows } = await supabaseAdmin.from('online_payments').select('team_id').eq('status', 'clearing')
    .in('team_id', acceptedTeams.map(t => t.id as string));
  const clearingTeams = new Set(((clearingRows ?? []) as Array<{ team_id: string | null }>).map(r => r.team_id).filter(Boolean) as string[]);
  for (const tm of acceptedTeams) {
    const ag = divisions.find(g => g.id === tm.division_id);
    // 12c: the team's entry, lowered by its part refunds.
    const fee = lowerEntry(feeMode === 'division' && ag?.total_fee_amount != null
      ? { depositAmount: ag.deposit_amount, depositDueDate: ag.deposit_due_date, totalFeeAmount: ag.total_fee_amount, totalFeeDueDate: ag.total_fee_due_date }
      : { depositAmount: t.deposit_amount, depositDueDate: t.deposit_due_date, totalFeeAmount: t.total_fee_amount, totalFeeDueDate: t.total_fee_due_date }, tm.entry_lowered);

    const totalFee   = fee.totalFeeAmount ?? 0;
    const depositAmt = fee.depositAmount ?? 0;
    const depDue     = fee.depositDueDate;
    const totDue     = fee.totalFeeDueDate;
    const depositPaid = Number(tm.deposit_paid ?? 0);
    const totalPaid   = Number(tm.total_paid ?? 0);

    const divCounts = divPayMap.get(tm.division_id);

    if (!tracksPayments || !fee.totalFeeAmount || clubOwnTeamIds.has(tm.id)) {
      paymentCounts.noSchedule++;
      continue;
    }

    totalExpected  += totalFee;
    totalCollected += totalPaid;

    let bucket: 'paid' | 'depositPaid' | 'pending' | 'pastDue';
    // 12c Part 6 (words §3.7): a team whose bank debit is clearing is never past due — the same rule as the Teams list.
    const clearingNow = clearingTeams.has(tm.id as string);
    if (totalPaid >= totalFee) {
      bucket = 'paid';
    } else if (!clearingNow && totDue && today > totDue) {
      bucket = 'pastDue';
    } else if (!clearingNow && depositAmt && depDue && today > depDue && depositPaid < depositAmt) {
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

  // A finished event's board reads "How it finished" and the event's figures from the ONE recap read
  // Summary returns too (Stage 4, Part 0) — never from this route's own rows.
  const isFinished = t.status === 'completed' || t.status === 'archived';
  const [registrationFields, registrationAnswers, recap] = await Promise.all([
    getTournamentRegistrationFields(tournamentId),
    getTournamentRegistrationFieldAnswersForRegistrations(teamPayments.map(team => team.id)),
    isFinished ? loadEventRecap(tournamentId, ctx.org.slug) : Promise.resolve(null),
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
      entryLowered: team.entry_lowered,
      slotId: team.slot_id,
      waitlistPosition: team.waitlist_position,
      customAnswers: answersByRegistration.get(team.id) ?? [],
      email: team.email,
      feeExempt: clubOwnTeamIds.has(team.id),
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
      tracksPayments,
      slotConfiguredDivisionIds,
      today,
    },
  );

  // Registration health — the Teams page's own call (owner 2026-10-21), so the board's row and the Teams button show ONE
  // number: the same attention summary, the same team counts, the same capacity gaps.
  const healthCounts = countRegistrationHealthTeams(teamPayments.map(team => ({ status: team.status, divisionId: team.division_id })));
  const healthCapacity = buildRegistrationCapacity({
    divisions: divisions.map(group => ({ id: group.id, name: group.name, capacity: group.capacity, isClosed: group.is_closed })),
    acceptedByDivision: healthCounts.acceptedByDivision,
    daysUntilStart: registrationDaysUntilStart(t.start_date),
  });
  const registrationHealth = {
    metrics: buildRegistrationHealth({
      attention: registrationAttention,
      teamsTotal: healthCounts.teamsTotal,
      accepted: healthCounts.accepted,
      paymentsTracked: hasPlanFeature(ctx.org.planId, 'payment_readiness_tools'),
      eventTracksPayments: tracksPayments,
      capacityGaps: healthCapacity.gaps,
    }),
    capacityTotal: healthCapacity.capacityTotal,
    capacityAccepted: healthCapacity.capacityAccepted,
  };

  // ── Coin-toss nudge ───────────────────────────────────────────────
  // Surface the tied groups still awaiting an admin coin toss — the one reading the schedule's Bracket view and
  // Results use (lib/coin-toss.ts, Stage 3 S7), so the three never name a different tie. Only runs when 'coin' is
  // actually configured somewhere (cheap guard).
  const coinTossNeeded: PendingToss[] = [];
  const tournamentUsesCoin = Array.isArray(tSettings.tie_breakers) && tSettings.tie_breakers.includes('coin');
  const anyDivisionUsesCoin = divisions.some(d => Array.isArray(d.playoff_config?.tieBreakers) && d.playoff_config!.tieBreakers!.includes('coin'));
  if (tournamentUsesCoin || anyDivisionUsesCoin) {
    try {
      const [domainTeams, domainGames, domainDivisions] = await Promise.all([
        getTeams(tournamentId, { admin: true }),
        getGames(tournamentId, { admin: true }),
        getDivisions(tournamentId, { admin: true }),
      ]);
      coinTossNeeded.push(...pendingCoinTosses({
        divisions: domainDivisions, teams: domainTeams, games: domainGames, settings: tSettings as TournamentSettings,
      }));
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
    /** ISO stamp of the last reminder batch, or null if never sent (S1-A/S1-B, 2026-07-29). */
    reminderLastSentAt: string | null;
    /** CH-1 — a finished event keeps its room readable but stops chasing sign-ups. */
    reminderRetired: boolean;
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
        // ⚖ While chat is paused (2026-10-18) only the room part is skipped: the sign-up counts above feed the Coaches
        // card, which stays as a sign-up tracker (ruling P5) — skipping the whole funnel would blank it.
        const room = CHAT_PAUSED ? null : await getTournamentChatRoom(tournamentId);
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
        reminderLastSentAt: (tournament?.chat_reminder_last_sent_at as string | null) ?? null,
        // CH-1 (owner, 2026-07-29): the room stays readable after the event, but a finished
        // tournament stops recruiting — the send route refuses these too.
        reminderRetired: tournament?.status === 'completed' || tournament?.status === 'archived',
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
      reminderLastSentAt: null,
      reminderRetired: false,
    };
  }

  // How the fees are set up — the draft's Fees row and the weeks-before Payments card say the true thing (F81): "not
  // set up" is never "free", and fees set with nobody accepted yet are still fees.
  const fees: BoardFees = {
    scope: typeof tSettings.fee_scope === 'string' ? tSettings.fee_scope : null,
    mode: t.fee_schedule_mode === 'division' ? 'division' : 'tournament',
    total: t.total_fee_amount,
    deposit: t.deposit_amount,
    divisionFees: divisions.filter(d => d.total_fee_amount != null && d.total_fee_amount > 0).length,
  };

  // The draft's board (Stage 5, E2): each row says what is set, in words. Read only for a draft.
  let setup: DraftSetup | null = null;
  if (t.status === 'draft') {
    // A chosen contact member's own address (the org's member, proved by org — this is an email on a screen), or the
    // owner's when nobody is chosen.
    let contactEmail: string | null = contactSource === 'tournament' ? t.contact_email : contactSource === 'org' ? ctx.org.contactEmail ?? null : null;
    if (contactSource === 'owner') contactEmail = (await getOrgOwnerEmail(ctx.org.id)) ?? null;
    if (contactSource === 'member' && t.default_contact_member_id) {
      const { data: member } = await supabaseAdmin
        .from('organization_members')
        .select('user_id')
        .eq('id', t.default_contact_member_id)
        .eq('organization_id', ctx.org.id)
        .maybeSingle();
      if (member?.user_id) {
        const { data: user } = await supabaseAdmin.auth.admin.getUserById(member.user_id as string);
        contactEmail = user?.user?.email ?? null;
      }
    }
    const minutes = positiveNumber(tSettings.game_duration_minutes) ?? null;
    const visible = visiblePublicPages({ publicHiddenPages: normalizeHiddenPublicPages(t.public_hidden_pages), settings: tSettings as TournamentSettings });
    setup = {
      contact: { source: contactSource, email: contactEmail },
      venues: { names: ((venuesRes.data ?? []) as Array<{ name: string | null }>).map(v => v.name ?? '').filter(Boolean), lanes: lanesRes.count ?? 0 },
      rules: rulesRes.count ?? 0,
      timing: {
        minutes,
        perDivision: tSettings.game_timing_scope === 'per_division',
        breakers: normalizeTieBreakers(tSettings.tie_breakers),
        breakersPerDivision: tSettings.tie_breaker_scope === 'per_division',
      },
      publicPages: visible.map(p => p.label),
      hasLogo: Boolean(t.logo_url),
      sport: t.sport ?? DEFAULT_SPORT,
      openDivisions: divisions.filter(d => !d.is_closed).map(d => d.name),
    };
  }

  return Response.json({
    coinTossNeeded,
    chatAdoption,
    fees,
    setup,
    publicPageCount: PUBLIC_PAGE_OPTIONS.length,
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
    // The game-day board's division lines (a live event): the champion's name once a final is decided.
    champions,
    // A finished event's board (null before): lib/event-recap-read.ts, the same object Summary returns.
    recap,
    // Whether marking complete will ACTUALLY email a results summary to team contacts,
    // mirroring every suppression the server-side sender applies (set-status → completed):
    // the per-event toggle on, org-wide coach emails not paused, not already sent once, and
    // the plan includes post-event summaries. Keeps the one-click complete confirm honest
    // (e.g. a reopen→re-complete won't re-email, so it must not promise one).
    notifyTeamsOnComplete: willEmailResultsOnComplete({
      notifyTeamsOnComplete: t.notify_teams_on_complete,
      settings: t.settings,
      resultsNotifiedAt: t.results_notified_at,
      planHasSummary: hasPlanFeature(ctx.org.planId, 'post_tournament_summary'),
    }),
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
      // "Ready" is exactly what Activate checks: dates and a division (lib/tournament-activation, F82).
      // Fees and an open division are OPTIONAL to activate (owner decisions 2026-06-16, J1-030/032): an organizer who
      // loads or invites teams privately never opens a division, and one who collects offline sets no fees.
      ready: activationMissing(activationFacts).length === 0,
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
    registrationHealth,
  });
}, { route: '/api/admin/tournament-dashboard' });
