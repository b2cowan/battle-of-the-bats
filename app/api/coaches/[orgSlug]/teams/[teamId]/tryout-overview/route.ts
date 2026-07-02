import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutSessions,
  getRepTryoutRubric,
  getRepTryoutEvaluatorSessions,
  getRepTryoutRegistrations,
  getRepTryoutScores,
  getRepRosterPlayers,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

/**
 * Aggregate "where am I in the tryout?" state for the Run-Your-Tryout flow header (UX guidance layer).
 * Pure read — reuses the same getters the individual cards use, so the strip mirrors their state on
 * load. Computes the four-stage progress + the single next action a coach should take.
 */

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; programYear: RepProgramYear };

async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.some(a => a.teamId === teamId)) return { ok: false, res: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return { ok: true, orgId: ctx.org.id, teamId, programYear };
}

type Anchor = 'setup' | 'tryout-day' | 'decide' | 'roster';
interface NextAction { label: string; hint: string; anchor: Anchor }

/** The single "do this next" — the first unmet step in the canonical tryout order. */
function computeNext(s: {
  sessionCount: number; hasScorecard: boolean; candidateCount: number; scoredCount: number;
  blind: boolean; offered: number; waitlisted: number; declined: number; accepted: number;
}): NextAction | null {
  const decided = s.offered + s.waitlisted + s.declined;
  if (s.sessionCount === 0) return { label: 'Add your tryout dates', hint: 'Set the date and time — it shows on your schedule and opens day-of check-in.', anchor: 'setup' };
  if (!s.hasScorecard) return { label: 'Set up your scorecard', hint: 'Choose what you’ll rate players on before scoring starts.', anchor: 'setup' };
  if (s.candidateCount === 0) return { label: 'Check players in', hint: 'Players appear once they register or you check them in on tryout day.', anchor: 'tryout-day' };
  if (s.scoredCount === 0) return { label: 'Score your players', hint: 'Rate players yourself or invite helpers — the scoreboard ranks them live.', anchor: 'tryout-day' };
  if (decided === 0 && s.blind) return { label: 'Reveal names to decide', hint: 'Names are hidden for fairness — reveal them on the Tryout Day card when you’re ready to make picks.', anchor: 'setup' };
  if (decided === 0) return { label: 'Make your offers', hint: 'Offer, waitlist, or pass on each ranked player.', anchor: 'decide' };
  if (s.offered > 0) return { label: 'Add accepted players to your roster', hint: 'When a family accepts, confirm them onto your roster with their fees.', anchor: 'decide' };
  if (s.accepted > 0) return { label: 'View your team roster', hint: 'Your accepted players are on the roster, ready for lineups.', anchor: 'roster' };
  return null; // all decided, none accepted — nothing pressing
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const [sessions, rubric, evaluators, registrations, scores, roster] = await Promise.all([
    getRepTryoutSessions(tryout.id),
    getRepTryoutRubric(tryout.id),
    getRepTryoutEvaluatorSessions(tryout.id),
    getRepTryoutRegistrations(r.programYear.id),
    getRepTryoutScores(tryout.id),
    getRepRosterPlayers(r.programYear.id),
  ]);

  const inPlay = registrations.filter(reg => reg.status !== 'withdrawn');
  const counts = { offered: 0, waitlisted: 0, declined: 0, accepted: 0, pending: 0 };
  for (const reg of inPlay) {
    if (reg.status === 'offered') counts.offered++;
    else if (reg.status === 'waitlisted') counts.waitlisted++;
    else if (reg.status === 'declined') counts.declined++;
    else if (reg.status === 'accepted') counts.accepted++;
    else counts.pending++;
  }

  const stats = {
    sessionCount: sessions.length,
    hasScorecard: (rubric?.categories?.length ?? 0) > 0,
    evaluatorCount: evaluators.filter(e => !e.revokedAt).length,
    candidateCount: inPlay.length,
    checkedInCount: inPlay.filter(reg => reg.isCheckedIn).length,
    scoredCount: new Set(scores.map(sc => sc.registrationId)).size,
    blind: tryout.isAnonymous,
    locked: !!tryout.scoresLockedAt,
    ...counts,
    rosterFromTryouts: roster.filter(p => p.source === 'tryout').length,
  };

  const decided = counts.offered + counts.waitlisted + counts.declined;
  const setupDone = stats.sessionCount > 0 && stats.hasScorecard;
  const tryoutDayDone = stats.scoredCount > 0 || decided > 0;
  const decideDone = decided > 0;
  const buildDone = counts.accepted > 0 && counts.offered === 0;
  const phase: 'setup' | 'tryout_day' | 'decide' | 'build' =
    !setupDone ? 'setup' : !tryoutDayDone ? 'tryout_day' : !decideDone ? 'decide' : 'build';

  const stepState = (done: boolean, isCurrent: boolean) => done ? 'done' : isCurrent ? 'current' : 'todo';
  const steps = {
    setup: stepState(setupDone, phase === 'setup'),
    tryoutDay: stepState(tryoutDayDone, phase === 'tryout_day'),
    decide: stepState(decideDone, phase === 'decide'),
    build: stepState(buildDone, phase === 'build'),
  };

  return NextResponse.json({ phase, steps, next: computeNext(stats), stats });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-overview' });
