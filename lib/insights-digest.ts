// ─────────────────────────────────────────────────────────────────────────────
// Insights weekly digest — the Sunday "week in review" bell + push for rep-team
// coaches (COACH_INSIGHTS_DIGEST_PLAN.md).
//
// Shape of the job:
//  • Enumerate every rep team with an ACTIVE program year (optionally narrowed
//    to one org/team for manual test runs).
//  • Per team: skip if a digest already went out inside the dedupe window, else
//    compose the SAME inputs the Insights dashboard uses — one shared findings
//    engine (lib/insight-findings.ts), so the push can never say something the
//    page wouldn't.
//  • Per coach on the team: filter the inputs down to what that coach's
//    capabilities allow (an assistant without money never hears about dues),
//    run the engine, and send ONE notify() per recipient (notify() is
//    one-body-per-call — per-recipient bodies require per-recipient calls).
//  • Quiet week ⇒ no send. formatInsightDigest() returns null when nothing
//    fired; silence is a feature, not a bug.
//
// Parity notes (deliberate, reviewed):
//  • Games scope = the dashboard's WLT DEFAULTS (league + tournament, no
//    scrimmage). The coach's personal scope toggle lives in localStorage and is
//    unreadable server-side; defaults are the shared baseline.
//  • Dues rows mirror the dues route's math (outstanding = schedule total −
//    paid installments; credits deliberately excluded, as on the dashboard).
//  • Attendance rows mirror the attendance route: active players only,
//    untracked players ride along as 0/0 (the engine never judges them).
//
// Scheduling: there is NO app-level cron in this codebase (pg_cron only runs
// SQL). This module is invoked by the platform-admin trigger route; wiring an
// automatic Sunday schedule is an explicit owner decision at handoff.
// ─────────────────────────────────────────────────────────────────────────────
import {
  getInsightsDigestTeams,
  hasRecentNotification,
  getRepTeamCoaches,
  getRepTeamEvents,
  getRepRosterPlayers,
  getRepTeamSeasonLineups,
  getRepTeamLineupTemplates,
  getRepPlayerDuesSchedules,
  getRepDuesInstallmentsBySchedules,
  getRepTeamAttendanceReliability,
  type InsightsDigestTeam,
} from './db';
import type { RepPlayerDuesInstallment } from './types';
import { notify } from './notify';
import { getSportPack, DEFAULT_SPORT } from './sports';
import { playerDisplayName } from './coach-roster-name';
import { computeSeasonLineupAnalytics } from './lineup-season-analytics';
import {
  computeInsightFindings,
  formatInsightDigest,
  summarizeDuesForFindings,
  type FindingsGameSummary,
  type FindingsAttendanceRow,
  type FindingsDuesRow,
} from './insight-findings';
import { resolveCoachCapabilities, canViewMoney, canViewRoster } from './coach-capabilities';
import type { RepTeamEvent } from './types';

/** One digest per team per window — just under a week so a Sunday job never
 *  skips a team because last Sunday's send was 7 days − a few minutes ago. */
export const DIGEST_DEDUPE_DAYS = 6;
export const DIGEST_EVENT_TYPE = 'coach_insights_digest' as const;

// Same category set + defaults as the dashboard scoreboard (WLT_DEFAULT there).
const DIGEST_GAME_SCOPE = new Set(['league_game', 'tournament_game']);

export interface InsightsDigestSweepOptions {
  /** Narrow the sweep to one org (manual/test runs). */
  orgId?: string;
  /** Narrow the sweep to one team (manual/test runs). */
  teamId?: string;
  /** Compute everything, send nothing; returns per-recipient previews. */
  dryRun?: boolean;
}

export interface InsightsDigestPreview {
  teamId: string;
  teamName: string;
  orgSlug: string;
  /** True when a real run would have skipped this team for the dedupe window. */
  wouldSkipDedupe: boolean;
  recipients: { userId: string; coachRole: string; title: string; body: string }[];
}

export interface InsightsDigestSweepResult {
  teamsConsidered: number;
  /** Teams skipped because a digest already went out inside the window. */
  teamsSkippedRecent: number;
  /** Teams where no coach had anything to hear (quiet week ⇒ no send). */
  teamsQuiet: number;
  digestsSent: number;
  errors: { teamId: string; message: string }[];
  /** Present only on dryRun. */
  previews?: InsightsDigestPreview[];
}

function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dashboard scoreboard math, server-side (WLT defaults; unscored games never count). */
function buildGamesSummary(events: RepTeamEvent[]): FindingsGameSummary | null {
  const scoped = events
    .filter(e => DIGEST_GAME_SCOPE.has(e.eventType) && e.status !== 'cancelled' && e.result)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  if (scoped.length === 0) return null;

  const tally = { win: 0, loss: 0, tie: 0 };
  for (const e of scoped) tally[e.result as 'win' | 'loss' | 'tie'] += 1;

  const streakType = (scoped[0]?.result ?? null) as 'win' | 'loss' | 'tie' | null;
  let streakCount = 0;
  for (const g of scoped) { if (g.result === streakType) streakCount += 1; else break; }

  const knownSide = scoped.filter(e => e.homeAway === 'home' || e.homeAway === 'away');
  const homeGames = knownSide.filter(e => e.homeAway === 'home');
  const homeTally = { win: 0, loss: 0, tie: 0 };
  for (const e of homeGames) homeTally[e.result as 'win' | 'loss' | 'tie'] += 1;

  return {
    wins: tally.win, losses: tally.loss, ties: tally.tie,
    streakType, streakCount,
    home: knownSide.length > 0
      ? { wins: homeTally.win, losses: homeTally.loss, ties: homeTally.tie, games: homeGames.length }
      : null,
    awayLosses: knownSide.filter(e => e.homeAway === 'away' && e.result === 'loss').length,
    recentResults: scoped.slice(0, 10).map(e => e.result as 'win' | 'loss' | 'tie'),
  };
}

/** One team's digest inputs + fan-out to its coaches. */
async function digestTeam(
  team: InsightsDigestTeam,
  todayISO: string,
  dryRun: boolean,
): Promise<{ sent: number; preview: InsightsDigestPreview }> {
  const coaches = await getRepTeamCoaches(team.programYearId);
  const preview: InsightsDigestPreview = {
    teamId: team.teamId, teamName: team.teamName, orgSlug: team.orgSlug,
    wouldSkipDedupe: false, recipients: [],
  };
  if (coaches.length === 0) return { sent: 0, preview };

  const [events, players, lineups, templates, schedules, reliability] = await Promise.all([
    getRepTeamEvents(team.programYearId),
    getRepRosterPlayers(team.programYearId),
    getRepTeamSeasonLineups(team.programYearId),
    getRepTeamLineupTemplates(team.teamId, team.programYearId),
    getRepPlayerDuesSchedules(team.programYearId),
    getRepTeamAttendanceReliability(team.programYearId),
  ]);

  // Dues rows — same per-player math as the dues route (credits excluded, like the
  // dashboard), but installments fetched in ONE batched query for the whole team.
  const scheduleMap = new Map(schedules.map(s => [s.playerId, s]));
  const allInstallments = await getRepDuesInstallmentsBySchedules(schedules.map(s => s.id));
  const installmentsBySchedule = new Map<string, RepPlayerDuesInstallment[]>();
  for (const i of allInstallments) {
    const list = installmentsBySchedule.get(i.scheduleId);
    if (list) list.push(i); else installmentsBySchedule.set(i.scheduleId, [i]);
  }
  const duesRows: FindingsDuesRow[] = players.map(p => {
    const schedule = scheduleMap.get(p.id) ?? null;
    const installments = schedule ? (installmentsBySchedule.get(schedule.id) ?? []) : [];
    const paidAmount = installments.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
    return {
      outstanding: schedule ? schedule.totalAmount - paidAmount : 0,
      installments: installments.map(i => ({ paidAt: i.paidAt, dueDate: i.dueDate, amount: i.amount })),
    };
  });
  const duesSummary = summarizeDuesForFindings(duesRows, todayISO);

  // Attendance rows — same shaping as the attendance route + dashboard mapping.
  const attendanceRows: FindingsAttendanceRow[] = players
    .filter(p => p.status === 'active')
    .map(p => {
      const r = reliability.get(p.id);
      return {
        name: `${p.playerFirstName} ${p.playerLastName}`.trim(),
        games: { attended: r?.games.attended ?? 0, known: r?.games.known ?? 0 },
        practices: { attended: r?.practices.attended ?? 0, known: r?.practices.known ?? 0 },
      };
    });

  // Lineup analytics — same composition as the lineup-analytics route.
  const sportPack = getSportPack(team.sport ?? DEFAULT_SPORT);
  const analytics = computeSeasonLineupAnalytics({
    lineups,
    scores: events.map(e => ({ eventId: e.id, teamScore: e.teamScore, opponentScore: e.opponentScore })),
    players: players.map(p => ({
      id: p.id,
      name: playerDisplayName(p),
      isPitcher: !!p.lineupProfile?.pitcher,
      pitcherCap: p.lineupProfile?.pitcher?.maxInnings ?? null,
    })),
    pitcherPosition: sportPack.pitcherPosition,
    seasonPitcherCap: team.seasonPitcherCap,
    templates: templates.map(t => ({
      name: t.name,
      battingOrderPlayerIds: t.entries
        .filter(e => e.battingOrder != null)
        .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
        .map(e => e.playerId),
    })),
    fieldPositions: sportPack.fieldPositions,
  });

  const gamesSummary = buildGamesSummary(events);
  const vocab = {
    periodsWord: sportPack.periodLabelPlural.toLowerCase(),
    scoreUnitWord: sportPack.score.unit.toLowerCase(),
  };

  let sent = 0;
  for (const coach of coaches) {
    const caps = resolveCoachCapabilities(coach.coachRole, coach.capabilities);
    // The same capability gates the dashboard applies before fetching each source.
    const findings = computeInsightFindings({
      vocab,
      analytics: caps.lineups ? analytics : null,
      games: caps.schedule ? gamesSummary : null,
      attendance: canViewRoster(caps) ? attendanceRows : null,
      dues: canViewMoney(caps) ? duesSummary : null,
      todayISO,
    });
    const digest = formatInsightDigest(findings);
    if (!digest) continue; // quiet week for THIS coach — silence is the feature

    const title = `${digest.title} — ${team.teamName}`;
    if (dryRun) {
      preview.recipients.push({ userId: coach.userId, coachRole: coach.coachRole, title, body: digest.body });
    } else {
      await notify({
        orgId: team.orgId,
        eventType: DIGEST_EVENT_TYPE,
        title,
        body: digest.body,
        link: `/${team.orgSlug}/coaches/teams/${team.teamId}/history`,
        userIds: [coach.userId],
        metadata: { teamId: team.teamId },
      });
    }
    sent += 1;
  }
  return { sent, preview };
}

/**
 * Run the weekly digest across every active rep team (or a narrowed set).
 * Per-team failures are contained — one broken team never stops the sweep.
 */
export async function runInsightsDigestSweep(
  opts: InsightsDigestSweepOptions = {},
): Promise<InsightsDigestSweepResult> {
  const teams = await getInsightsDigestTeams({ orgId: opts.orgId, teamId: opts.teamId });
  const now = new Date();
  const todayISO = localDateISO(now);
  const sinceISO = new Date(now.getTime() - DIGEST_DEDUPE_DAYS * 86400000).toISOString();
  const dryRun = !!opts.dryRun;

  const result: InsightsDigestSweepResult = {
    teamsConsidered: teams.length,
    teamsSkippedRecent: 0,
    teamsQuiet: 0,
    digestsSent: 0,
    errors: [],
    ...(dryRun ? { previews: [] as InsightsDigestPreview[] } : {}),
  };

  for (const team of teams) {
    try {
      const recent = await hasRecentNotification(team.orgId, DIGEST_EVENT_TYPE, { teamId: team.teamId }, sinceISO);
      if (recent && !dryRun) { result.teamsSkippedRecent += 1; continue; }

      const { sent, preview } = await digestTeam(team, todayISO, dryRun);
      preview.wouldSkipDedupe = recent;
      if (dryRun) result.previews!.push(preview);
      if (sent === 0) result.teamsQuiet += 1;
      result.digestsSent += sent;
    } catch (e) {
      result.errors.push({ teamId: team.teamId, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
