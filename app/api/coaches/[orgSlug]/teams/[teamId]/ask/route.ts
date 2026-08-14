import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  getRepTeamEvents,
  getRepTeamSeasonLineups,
  getRepPlayerDuesSchedules,
  getRepDuesInstallmentsBySchedules,
  getRepDuesPaymentsByProgramYear,
  getRepTeamPracticeAttendance,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, redactRosterPlayer } from '@/lib/coach-capabilities';
import { getSportPack, DEFAULT_SPORT, positionLabel } from '@/lib/sports';
import { playerName, playerDisplayName } from '@/lib/coach-roster-name';
import { normalizeGuardianEmail } from '@/lib/guardian-email';
import { orgDayKey, tournamentToday } from '@/lib/timezone';
import { isNeverPaidPlayer, outstandingForSchedule } from '@/lib/dues-status';
import { duesPaidAmount, paymentsTotalByPlayer, allocateDuesPayments } from '@/lib/dues-payments';
import { analyzeLineup } from '@/lib/lineup-analysis';
import { computeTeamSeasonLineupAnalytics } from '@/lib/team-season-analytics';
import { computePositionRecency, rankPositionsByStaleness, type PositionRecencyGame } from '@/lib/coach-position-recency';
import { computeFamilyDues } from '@/lib/coach-family-dues';
import { computePracticeMisses } from '@/lib/coach-practice-misses';
import {
  ASK_QUESTION_BY_ID, assembleAskAnswer, visibleAskQuestions,
  type AskInputs, type AskQuestionId,
} from '@/lib/coach-ask-questions';

/**
 * Ask the Front Office — the answer route (Phase A).
 *
 * ⚠ **ACTIVE SEASON ONLY, BY OMISSION.** This route deliberately does NOT touch the season-read
 * rail (`lib/coach-season-read.ts`), so `getActiveRepProgramYear` is the only season it can ever
 * resolve and `?year=` means nothing here. That is the CLAUDE.md archive ruling working as
 * designed: a new coach surface is invisible in a finished season until someone decides otherwise,
 * and deciding otherwise means editing the allow-lists in coach-season-write-guard.test.ts, which
 * fails the build until it is done. Do not "helpfully" convert this to the season rail.
 *
 * ⚠ **The capability check here is the real gate.** The chips are filtered client-side from the
 * same library, but that is a courtesy — this check is what actually refuses. A question reached
 * by any other route (a stale tab, a hand-typed URL, Phase B's model picking a tool) hits exactly
 * the same `allows` predicate.
 *
 * Only the data the ASKED question needs is fetched. One question, one answer, one minimal read.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  // The team, the caller's assignments and the active season depend only on ids already in hand,
  // so they resolve together — the same reasoning `lib/coach-season-read.ts` documents for its
  // team+year pair. Serialising three lookups put two avoidable round trips on the critical path
  // of every answer. Tenancy is still decided after all three land, so nothing is judged on a
  // half-resolved context.
  const [team, assignments, programYear] = await Promise.all([
    getRepTeam(teamId),
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getActiveRepProgramYear(teamId),
  ]);

  if (!team || team.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const caps = assignment.capabilities;

  const url = new URL(req.url);
  const questionId = url.searchParams.get('q') as AskQuestionId | null;
  const question = questionId ? ASK_QUESTION_BY_ID.get(questionId) : undefined;
  if (!question) return NextResponse.json({ error: 'Unknown question' }, { status: 400 });

  const sportPack = getSportPack(team.sport ?? DEFAULT_SPORT);
  const periodsWord = sportPack.periodLabelPlural.toLowerCase();

  // The same filter the chips use — capability AND sport. A question this coach cannot ask, or
  // that this sport has no vocabulary for, is refused rather than answered emptily.
  const allowed = visibleAskQuestions(caps, {
    hasPitcherPosition: !!sportPack.pitcherPosition,
    hasFieldPositions: sportPack.fieldPositions.length > 0,
  });
  const denied = denyUnless(
    allowed.some(q => q.id === question.id),
    'You do not have access to what that question would answer. Ask your head coach.',
  );
  if (denied) return denied;

  if (!programYear) {
    return NextResponse.json({ error: 'No active season for this team' }, { status: 404 });
  }

  const inputs: AskInputs = { periodsWord };
  let resolvedPosition: string | null = null;

  // ── Saved-lineup questions ────────────────────────────────────────────────
  if (question.id === 'position_recency' || question.id === 'arm_care') {
    const [lineups, events, roster] = await Promise.all([
      getRepTeamSeasonLineups(programYear.id),
      getRepTeamEvents(programYear.id),
      getRepRosterPlayers(programYear.id),
    ]);
    // CANCELLED events are excluded. A lineup saved for a game that was then called off records a
    // plan, not a turn anyone took — counting it would tell a coach a player has had a go at a
    // position they never actually played. The practice question gets this right at the query
    // level; this is the same rule applied to games.
    const eventById = new Map(events.filter(e => e.status !== 'cancelled').map(e => [e.id, e]));
    const games: PositionRecencyGame[] = lineups
      .map(l => {
        const ev = eventById.get(l.eventId);
        return {
          eventId: l.eventId,
          day: ev ? orgDayKey(ev.startsAt) : '',
          // Kept for the tie-break below: two games on one calendar day must order by start time,
          // which is the ordering `computePositionRecency` documents as the caller's job.
          startsAt: ev ? ev.startsAt : '',
          // The words the receipt shows. "vs Falcons" when we know the opponent, else the
          // event's own name — never a fabricated label.
          label: ev ? (ev.opponent ? `vs ${ev.opponent}` : (ev.name || 'Game')) : 'Game',
          // Counted by the SAME analyser the season analytics use, so both halves of the arm-care
          // sentence ("threw most recently" from here, "thrown the most" from the analytics) can
          // never disagree about one player's innings. Hand-counting the position map also ignored
          // the lineup's own `inningCount`, which would have counted innings from a game that was
          // later shortened.
          byPlayer: analyzeLineup(l.entries, l.inningCount, sportPack.fieldPositions)
            .fairPlay.map(f => ({ playerId: f.playerId, positionInnings: f.positionCounts })),
        };
      })
      // A lineup whose event is missing or cancelled has no day and drops out here.
      .filter(g => g.day)
      // Oldest → newest. The start-time tie-break matters: the season-lineups query has no ORDER BY,
      // so on a double-header the two halves would otherwise arrive in whatever order Postgres
      // returned them, and the "last time was …" receipt could cite the wrong half.
      .sort((a, b) => a.day.localeCompare(b.day) || a.startsAt.localeCompare(b.startsAt));

    const players = roster
      .filter(p => p.status === 'active')
      .map(p => ({ id: p.id, name: playerName(p) || playerDisplayName(p) }));
    const today = tournamentToday();

    if (question.id === 'position_recency') {
      const requested = url.searchParams.get('position');
      // An unrecognised position is ignored rather than 400'd — the picker's vocabulary comes from
      // the Sport Pack, so a stale tab asking for a position this sport dropped should still get a
      // useful answer, not an error.
      const valid = requested && sportPack.fieldPositions.includes(requested) ? requested : null;
      // No position asked for ⇒ open on the one whose longest-waiting player has waited longest.
      resolvedPosition = valid
        ?? rankPositionsByStaleness({ today, games, players, positions: sportPack.fieldPositions })[0]?.position
        ?? sportPack.fieldPositions[0]
        ?? null;
      inputs.position = resolvedPosition;
      inputs.positionLabel = resolvedPosition ? positionLabel(sportPack, resolvedPosition) : null;
      inputs.positionRecency = resolvedPosition
        ? computePositionRecency({ today, games, players, position: resolvedPosition })
        : null;
    } else {
      const pitcher = sportPack.pitcherPosition;
      inputs.pitcherLabel = pitcher ? positionLabel(sportPack, pitcher) : null;
      inputs.position = pitcher;
      inputs.positionRecency = pitcher
        ? computePositionRecency({ today, games, players, position: pitcher })
        : null;
      // Hand the helper everything already in hand — otherwise it re-runs the season lookup and
      // all three of these queries a second time for the same data.
      const result = await computeTeamSeasonLineupAnalytics(teamId, { team, programYear, lineups, events, players: roster });
      // Narrow the season workload rows to the SAME active players the recency half uses. The
      // analytics helper reads the whole roster, so without this one sentence could name a departed
      // player as the season's heaviest arm and a current player as the most recent, with nothing
      // saying they are different people — or warn about an arm that has left the team.
      const activeIds = new Set(players.map(p => p.id));
      inputs.analytics = result
        ? { ...result.analytics, armCare: result.analytics.armCare.filter(r => activeIds.has(r.playerId)) }
        : null;
    }
  }

  // ── Playing time ──────────────────────────────────────────────────────────
  if (question.id === 'playing_time') {
    const result = await computeTeamSeasonLineupAnalytics(teamId, { team, programYear });
    inputs.analytics = result?.analytics ?? null;
  }

  // ── Money questions ───────────────────────────────────────────────────────
  if (question.id === 'family_dues' || question.id === 'never_paid') {
    const [roster, schedules, seasonPayments] = await Promise.all([
      getRepRosterPlayers(programYear.id),
      getRepPlayerDuesSchedules(programYear.id),
      getRepDuesPaymentsByProgramYear(programYear.id),
    ]);
    const installments = await getRepDuesInstallmentsBySchedules(schedules.map(s => s.id));
    const bySchedule = new Map<string, typeof installments>();
    for (const i of installments) {
      const arr = bySchedule.get(i.scheduleId) ?? [];
      arr.push(i);
      bySchedule.set(i.scheduleId, arr);
    }
    const scheduleByPlayer = new Map(schedules.map(s => [s.playerId, s]));
    const paymentsByPlayer = paymentsTotalByPlayer(seasonPayments);

    const rows = roster.map(p => {
      const schedule = scheduleByPlayer.get(p.id) ?? null;
      const insts = schedule ? (bySchedule.get(schedule.id) ?? []) : [];
      // Paid = payment FACTS capped at the schedule total (mig 232) — the same figure the dues
      // route serves, so a family two part-payments into an installment is no longer "owing
      // everything, nothing recorded" here while the Money page shows their $200.
      const paymentsTotal = paymentsByPlayer.get(p.id) ?? 0;
      const paidAmount = schedule ? duesPaidAmount(paymentsTotal, schedule.totalAmount) : 0;
      // ONE shared definition (lib/dues-status.ts), also used by the dues route and the weekly
      // digest — so the answer and the Money page cannot quote different numbers.
      const outstanding = outstandingForSchedule(schedule, paidAmount);
      // Per-installment remainders so the family answer quotes what's MISSING, not face values
      // (same synthetic-total allocation the digest uses — coverage depends only on dollars).
      const { coverage } = allocateDuesPayments(
        insts.map(i => ({ id: i.id, installmentNumber: i.installmentNumber, amount: i.amount, paidAt: i.paidAt })),
        paymentsTotal > 0 ? [{ id: 'total', amount: paymentsTotal, receivedDate: '' }] : [],
      );
      const remainingById = new Map(coverage.map(c => [c.installmentId, c.remaining]));
      // Money access and guardian PII are independent grants. The GROUPING key is the guardian
      // email, computed here on the server; the redacted row decides only what may be NAMED.
      const visible = redactRosterPlayer(p, caps);
      return {
        playerId: p.id,
        playerName: playerDisplayName(p),
        guardianKey: normalizeGuardianEmail(p.guardianEmail),
        guardianLastName: visible.guardianLastName ?? null,
        outstanding,
        paidAmount,
        installments: insts.map(i => ({
          dueDate: i.dueDate,
          amount: i.amount,
          paidAt: i.paidAt,
          remainingAmount: remainingById.get(i.id) ?? i.amount,
        })),
      };
    });

    if (question.id === 'family_dues') {
      inputs.family = computeFamilyDues({ players: rows, todayISO: tournamentToday() });
    } else {
      const billed = rows.filter(r => r.installments.length > 0 || r.outstanding > 0);
      const unpaid = billed.filter(isNeverPaidPlayer);
      inputs.neverPaid = {
        names: unpaid.map(r => r.playerName),
        outstanding: Math.round(unpaid.reduce((s, r) => s + r.outstanding, 0)),
        billedCount: billed.length,
      };
    }
  }

  // ── Practice attendance ───────────────────────────────────────────────────
  if (question.id === 'practice_misses') {
    const [marks, roster] = await Promise.all([
      getRepTeamPracticeAttendance(programYear.id),
      getRepRosterPlayers(programYear.id),
    ]);
    // One day-key per PRACTICE, not per mark. `orgDayKey` builds an Intl formatter on every call,
    // and there is one mark per player per practice — a full season was ~450 conversions of the
    // same ~30 dates.
    const dayByEvent = new Map<string, string>();
    const dayOf = (eventId: string, startsAt: string) => {
      let day = dayByEvent.get(eventId);
      if (day === undefined) { day = orgDayKey(startsAt); dayByEvent.set(eventId, day); }
      return day;
    };
    inputs.practices = computePracticeMisses({
      records: marks.map(m => ({
        eventId: m.eventId,
        day: dayOf(m.eventId, m.startsAt),
        label: m.eventName || 'Practice',
        playerId: m.playerId,
        status: m.status,
      })),
      players: roster.filter(p => p.status === 'active').map(p => ({ id: p.id, name: playerName(p) || playerDisplayName(p) })),
    });
  }

  return NextResponse.json({
    answer: assembleAskAnswer(question.id, inputs),
    // Which position the server chose when the coach didn't name one, so the picker can show it
    // as selected rather than guessing and disagreeing with the answer above it.
    position: resolvedPosition,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/ask' });
