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
} from '@/lib/db';
import { rankTryoutCandidates, evaluatorCompositesByCandidate } from '@/lib/tryout-scoring';
import { applyTryoutDecisionSideEffects } from '@/lib/tryout-notifications';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear, RepTryoutRegistrationStatus } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | {
      ok: true; orgId: string; teamId: string; programYear: RepProgramYear;
      teamName: string; orgName: string; orgLogoUrl?: string; contactEmail?: string;
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
    teamName: team.name, orgName: ctx.org.name, orgLogoUrl: ctx.org.logoUrl, contactEmail: ctx.org.contactEmail ?? undefined,
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

  const blind = tryout.isAnonymous;
  const categories = (rubric?.categories ?? []).map(c => ({ key: c.key, label: c.label, weight: c.weight }));

  // Withdrawn candidates pulled themselves out — not part of the coach's decision set.
  const inPlay = registrations.filter(reg => reg.status !== 'withdrawn');
  const regById = new Map(inPlay.map(reg => [reg.id, reg]));
  const now = Date.now();

  // 2B.5: surface the family's offer response + a lazily-computed "expired" flag (no status mutation).
  // Chunk E (WI-3): plus what the coach needs to decide honestly — whether the family is even
  // reachable by email, whether the kid actually showed up, and what the family wrote at signup.
  // What each evaluator, alone, made of each candidate — the numbers BEHIND the average, which
  // the board shows when a coach taps a player. Evaluator identity is not blind-gated: blind
  // evaluation hides the candidate from the scorer, never the scorer from the head coach.
  const evaluatorNames = new Map(evaluatorSessions.map(e => [e.id, e.evaluatorName]));
  const perEvaluator = evaluatorCompositesByCandidate(categories, scores);

  const ranked = rankTryoutCandidates(inPlay, categories, scores, { blind })
    .map(c => {
      const reg = regById.get(c.registrationId);
      const offerExpired = !!reg?.offerExpiresAt && new Date(reg.offerExpiresAt).getTime() < now && !reg?.offerRespondedAt;
      return {
        ...c,
        status: reg?.status ?? 'pending_review',
        offerResponse: reg?.offerResponse ?? null,
        offerExpired,
        // A response link only exists once an offer EMAIL went out — a record-only offer
        // (D-E9, switch off) mints nothing, so there is no response to await.
        offerEmailed: !!reg?.offerExpiresAt,
        hasGuardianEmail: !!reg?.guardianEmail?.trim(),
        isCheckedIn: reg?.isCheckedIn ?? false,
        // Family-authored context — blind-SAFE only once names are visible; a parent's
        // note beside an anonymized bib could identify the kid.
        playerNotes: !blind ? (reg?.playerNotes ?? null) : null,
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
    blind,
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
  // D-E9: family emails are OPT-IN on the coach board. The flag rides each decision write from
  // the visible switch — the server defaults to record-only, so the failure direction is always
  // "no email", never an unwanted one.
  const notifyFamily = body.notifyFamily === true;

  // IDOR + guard: the candidate must be in THIS program year (shared by the resend + decision paths).
  const registrations = await getRepTryoutRegistrations(r.programYear.id);
  const registration = registrations.find(reg => reg.id === registrationId);
  if (!registration) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const sideEffectCtx = {
    teamName: r.teamName,
    yearName: r.programYear.name,
    orgName: r.orgName,
    orgLogoUrl: r.orgLogoUrl,
    contactEmail: r.contactEmail,
  };

  // Resend / "Email this offer": send the offer email with a FRESH Accept/Decline link + new
  // deadline, without changing status. Explicitly requested, so it always notifies — and a
  // missing guardian email is an honest error here, never a silent no-op.
  if (decision === 'resend') {
    if (registration.status !== 'offered') {
      return NextResponse.json({ error: 'not_offered', message: 'You can only email an offer that is currently extended.' }, { status: 409 });
    }
    if (!registration.guardianEmail?.trim()) {
      return NextResponse.json({ error: 'no_email', message: 'This family has no email on file — add one, or reach them by phone.' }, { status: 400 });
    }
    await applyTryoutDecisionSideEffects({ reg: registration, newStatus: 'offered', notifyFamily: true, ...sideEffectCtx });
    return NextResponse.json({ registrationId, status: 'offered', resent: true });
  }

  const nextStatus = DECISION_STATUS[decision];
  if (!nextStatus) return NextResponse.json({ error: 'bad_decision' }, { status: 400 });
  // An accepted candidate is on the roster; a withdrawn one opted out — neither is board-editable.
  if (registration.status === 'accepted' || registration.status === 'withdrawn') {
    return NextResponse.json({ error: 'not_editable', message: 'This candidate can no longer be changed from the board.' }, { status: 409 });
  }

  const updated = await updateRepTryoutRegistrationStatus(registrationId, nextStatus);

  // Family-facing side effects — same shared path as the admin route (offer link + branded
  // emails), but on the coach board they fire only when the switch says so (D-E9).
  await applyTryoutDecisionSideEffects({ reg: updated, newStatus: nextStatus, notifyFamily, ...sideEffectCtx });

  return NextResponse.json({ registrationId, status: updated.status });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions' });
