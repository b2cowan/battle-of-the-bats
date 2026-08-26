import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutRubric,
  getRepTryoutRegistrations,
  getRepTryoutScores,
  getRepTryoutEvaluatorSessions,
  updateRepTryoutRegistrationStatus,
  clearTryoutOffer,
} from '@/lib/db';
import { rankTryoutCandidates, evaluatorCompositesByCandidate } from '@/lib/tryout-scoring';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear, RepTryoutRegistrationStatus } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | {
      ok: true; orgId: string; teamId: string; programYear: RepProgramYear;
      assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number];
    };

async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return {
    ok: true, orgId: ctx.org.id, teamId, programYear,
    assignment,
  };
}

// Decision → candidate status. Offer/Waitlist/Not this season are the only board actions.
const DECISION_STATUS: Record<string, RepTryoutRegistrationStatus> = {
  offer: 'offered',
  waitlist: 'waitlisted',
  cut: 'declined',
};

/** Ranked candidates with current status + a live tally for the decision board. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  // Lazy 1:1 init of the tryout workspace (same convention as the scoreboard/rubric routes) — the row
  // is a benign empty workspace, created on first view if the coach hasn't opened setup yet.
  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const [rubric, registrations, scores, evaluatorSessions] = await Promise.all([
    getRepTryoutRubric(tryout.id),
    getRepTryoutRegistrations(r.programYear.id),
    getRepTryoutScores(tryout.id),
    // Names for the per-player breakdown the board opens under a tapped row.
    getRepTryoutEvaluatorSessions(tryout.id),
  ]);

  // ⚠ THE COACH IS NEVER BLIND (owner ruling 2026-08-26). Blind evaluation is a scorer-side rule
  // and applies to HELPERS only — a head coach ran the sessions and knows every kid, so hiding
  // names, birth years or last season from them was theatre, and those are legitimate inputs to
  // the decision they are being asked to make. The flag still rides out so the screen can SAY
  // what the helpers are seeing; it must never be used to withhold from this response.
  const helpersAreBlind = tryout.isAnonymous;
  const categories = (rubric?.categories ?? []).map(c => ({ key: c.key, label: c.label, weight: c.weight }));

  // Withdrawn candidates pulled themselves out — not part of the coach's decision set.
  const inPlay = registrations.filter(reg => reg.status !== 'withdrawn');
  const regById = new Map(inPlay.map(reg => [reg.id, reg]));

  // What the coach needs to decide honestly — whether the family is even reachable by email
  // (they now deliver EVERY decision themselves), whether the kid actually showed up, and what
  // the family wrote at signup. No offer-response fields: the family self-serve reply loop was
  // retired with the decision emails (owner ruling 2026-08-26).
  //
  // What each evaluator, alone, made of each candidate — the numbers BEHIND the average, which
  // the board shows when a coach taps a player. Evaluator identity is not blind-gated: blind
  // evaluation hides the candidate from the scorer, never the scorer from the head coach.
  const evaluatorNames = new Map(evaluatorSessions.map(e => [e.id, e.evaluatorName]));
  const perEvaluator = evaluatorCompositesByCandidate(categories, scores);

  const ranked = rankTryoutCandidates(inPlay, categories, scores, { blind: false })
    .map(c => {
      const reg = regById.get(c.registrationId);
      return {
        ...c,
        status: reg?.status ?? 'pending_review',
        hasGuardianEmail: !!reg?.guardianEmail?.trim(),
        isCheckedIn: reg?.isCheckedIn ?? false,
        // What the family wrote at signup. No longer gated: the coach is never blind.
        playerNotes: reg?.playerNotes ?? null,
        // The breakdown's second half; the per-category averages already on the ranked row are
        // the first. Empty for a candidate nobody scored, which the board renders as its own
        // sentence rather than an empty panel.
        evaluatorScores: (perEvaluator.get(c.registrationId) ?? []).map(e => ({
          name: evaluatorNames.get(e.evaluatorSessionId) ?? null,
          composite: e.composite,
        })),
      };
    });

  const counts = { offered: 0, waitlisted: 0, declined: 0, accepted: 0, pending: 0 };
  for (const reg of inPlay) {
    if (reg.status === 'offered') counts.offered++;
    else if (reg.status === 'waitlisted') counts.waitlisted++;
    else if (reg.status === 'declined') counts.declined++;
    else if (reg.status === 'accepted') counts.accepted++;
    else counts.pending++;
  }

  return NextResponse.json({
    blind: helpersAreBlind,
    locked: !!tryout.scoresLockedAt,
    scaleMax: rubric?.scaleMax ?? 5,
    categories,
    counts,
    total: inPlay.length,
    candidates: ranked,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions' });

/** Record one Offer / Waitlist / Not-this-season decision for a candidate. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';
  const decision = typeof body.decision === 'string' ? body.decision : '';

  // IDOR + guard: the candidate must be in THIS program year.
  const registrations = await getRepTryoutRegistrations(r.programYear.id);
  const registration = registrations.find(reg => reg.id === registrationId);
  if (!registration) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const nextStatus = DECISION_STATUS[decision];
  if (!nextStatus) return NextResponse.json({ error: 'bad_decision' }, { status: 400 });
  // An accepted candidate is on the roster; a withdrawn one opted out — neither is board-editable.
  if (registration.status === 'accepted' || registration.status === 'withdrawn') {
    return NextResponse.json({ error: 'not_editable', message: 'This candidate can no longer be changed from the board.' }, { status: 409 });
  }

  const updated = await updateRepTryoutRegistrationStatus(registrationId, nextStatus);

  // ⚠ NO FAMILY-FACING SIDE EFFECT. A decision is a private record; the coach delivers it in
  // their own words, with the signed conditional offer letter a platform email could never be
  // (owner ruling 2026-08-26). The only thing left is durable hygiene: wipe any offer token
  // left on the row by the retired reply loop, so a link in an old inbox can never resolve.
  if (nextStatus !== 'offered') await clearTryoutOffer(registrationId);

  return NextResponse.json({ registrationId, status: updated.status });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions' });
