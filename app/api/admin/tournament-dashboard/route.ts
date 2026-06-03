import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import {
  getTournamentRegistrationFieldAnswersForRegistrations,
  getTournamentRegistrationFields,
} from '@/lib/db';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { buildRegistrationAttentionSummary } from '@/lib/registration-attention';
import { hasCapability } from '@/lib/roles';
import { buildScheduleMetrics, type ScheduleMetricGame } from '@/lib/schedule-metrics';
import { supabaseAdmin } from '@/lib/supabase-admin';

type GameRow = {
  id: string;
  status: string | null;
  is_playoff: boolean | null;
  bracket_code: string | null;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  game_date: string | null;
  game_time: string | null;
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
};

type TeamPaymentRow = {
  id: string;
  name: string | null;
  division_id: string;
  status: string | null;
  deposit_paid: number | null;
  total_paid: number | null;
  slot_id: string | null;
  waitlist_position: number | null;
  registered_at: string | null;
};

type DivPayCounts = { paid: number; depositPaid: number; pending: number; pastDue: number; total: number };

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

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
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

  const [divisionsRes, teamsRes, gamesRes, announcementsRes, teamPaymentsRes, poolSlotsRes, venuesRes, rulesRes] = await Promise.all([
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
      .select('*')
      .eq('tournament_id', tournamentId),
    supabaseAdmin
      .from('announcements')
      .select('id, title, published_at, channel_email, email_recipient_count')
      .eq('tournament_id', tournamentId)
      .is('deleted_at', null),
    supabaseAdmin
      .from('teams')
      .select('id, name, division_id, status, deposit_paid, total_paid, slot_id, waitlist_position, registered_at')
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const acceptedTeams = teamPayments.filter(tm => tm.status === 'accepted');
  const registrationVelocity = acceptedTeams.filter(tm => tm.registered_at != null && tm.registered_at >= sevenDaysAgo).length;
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

  return Response.json({
    divisions:      divisionsRes.count ?? divisions.length,
    teams:          teamsRes.count ?? 0,
    scheduled:      games.filter(game => game.status === 'scheduled').length,
    totalGames:     activeGames.length,
    completed:      games.filter(game => game.status === 'completed').length,
    communications,
    scheduleHealth,
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
      ready: hasDates && hasDivisions && hasOpenDivision && hasFees,
    },
    registration: {
      totalCapacity,
      totalAccepted,
      totalPending,
      totalWaitlist,
      byDivision,
      velocity: registrationVelocity,
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
}
