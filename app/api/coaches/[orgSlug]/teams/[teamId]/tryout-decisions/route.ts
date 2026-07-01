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
  updateRepTryoutRegistrationStatus,
} from '@/lib/db';
import { rankTryoutCandidates } from '@/lib/tryout-scoring';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear, RepTryoutRegistrationStatus } from '@/lib/types';

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

  // Lazy 1:1 init of the tryout workspace (same convention as the scoreboard/rubric routes) — the row
  // is a benign empty workspace, created on first view if the coach hasn't opened setup yet.
  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const [rubric, registrations, scores] = await Promise.all([
    getRepTryoutRubric(tryout.id),
    getRepTryoutRegistrations(r.programYear.id),
    getRepTryoutScores(tryout.id),
  ]);

  const blind = tryout.isAnonymous;
  const categories = (rubric?.categories ?? []).map(c => ({ key: c.key, label: c.label, weight: c.weight }));

  // Withdrawn candidates pulled themselves out — not part of the coach's decision set.
  const inPlay = registrations.filter(reg => reg.status !== 'withdrawn');
  const statusById = new Map(inPlay.map(reg => [reg.id, reg.status]));

  const ranked = rankTryoutCandidates(inPlay, categories, scores, { blind })
    .map(c => ({ ...c, status: statusById.get(c.registrationId) ?? 'pending_review' }));

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

  const body = await req.json().catch(() => ({}));
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';
  const decision = typeof body.decision === 'string' ? body.decision : '';
  const nextStatus = DECISION_STATUS[decision];
  if (!nextStatus) return NextResponse.json({ error: 'bad_decision' }, { status: 400 });

  // IDOR + guard: the candidate must be in THIS program year and still decidable
  // (an accepted candidate is on the roster; a withdrawn one opted out — neither is board-editable).
  const registrations = await getRepTryoutRegistrations(r.programYear.id);
  const registration = registrations.find(reg => reg.id === registrationId);
  if (!registration) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (registration.status === 'accepted' || registration.status === 'withdrawn') {
    return NextResponse.json({ error: 'not_editable', message: 'This candidate can no longer be changed from the board.' }, { status: 409 });
  }

  const updated = await updateRepTryoutRegistrationStatus(registrationId, nextStatus);
  return NextResponse.json({ registrationId, status: updated.status });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-decisions' });
