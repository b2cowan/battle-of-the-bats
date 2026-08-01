import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTryout,
  getRepTryoutCheckinList,
  createRepTryoutRegistration,
  updateRepTryoutCheckin,
  getRepProgramYears,
  getPriorContinuityIdentities,
} from '@/lib/db';
import { matchPriorIdentities, type ContinuityKind } from '@/lib/continuity-match';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; programYear: RepProgramYear; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

/**
 * Which of this year's candidates were here before, and in which season (Chunk F, D-F1).
 * Keyed by registration id; absent = first time. `kind` distinguishes "tried out and didn't
 * make it" from "was on the roster", because those are different conversations with a family.
 */
export interface ReturningCandidateMarker {
  priorProgramYearId: string;
  priorProgramYearName: string;
  kind: ContinuityKind;
  confidence: 'high' | 'possible';
}

async function resolveReturningCandidates(
  teamId: string,
  programYearId: string,
  candidates: { id: string; playerFirstName: string; playerLastName: string | null;
    playerDateOfBirth: string | null; guardianEmail: string | null }[],
): Promise<Record<string, ReturningCandidateMarker>> {
  if (candidates.length === 0) return {};
  const years = await getRepProgramYears(teamId);
  const { identities } = await getPriorContinuityIdentities(teamId, programYearId, years);
  if (identities.length === 0) return {};

  const yearName = new Map(years.map(y => [y.id, y.name]));
  const out: Record<string, ReturningCandidateMarker> = {};
  for (const c of candidates) {
    const [best] = matchPriorIdentities(
      {
        kind: 'registration', id: c.id, programYearId,
        firstName: c.playerFirstName, lastName: c.playerLastName,
        dateOfBirth: c.playerDateOfBirth, guardianEmail: c.guardianEmail,
      },
      identities,
    );
    if (!best) continue;
    out[c.id] = {
      priorProgramYearId: best.prior.programYearId,
      priorProgramYearName: yearName.get(best.prior.programYearId) ?? 'a past season',
      kind: best.prior.kind,
      confidence: best.confidence,
    };
  }
  return out;
}

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
  return { ok: true, orgId: ctx.org.id, teamId, programYear, assignment };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const [tryout, candidates] = await Promise.all([
    getRepTryout(r.programYear.id),
    getRepTryoutCheckinList(r.programYear.id),
  ]);

  // Chunk F (D-F1): "have we seen this person before?" — the moment past-season tryout records
  // exist to serve. Reuses the SAME matcher the Decision Board's continuity scan runs on, so a
  // returning candidate is recognised identically in both places. Never gated separately: the
  // caller already cleared `tryouts` above, and the marker carries no evaluation content — just
  // which season to go and read.
  const returningByCandidate = await resolveReturningCandidates(teamId, r.programYear.id, candidates);

  return NextResponse.json({ isAnonymous: tryout?.isAnonymous ?? true, candidates, returning: returningByCandidate });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates' });

// Walk-up add — a candidate who shows up without registering. Player name is enough; guardian
// details (stored empty for now) can be filled in later. Checked in on add.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json();
  const first = typeof body.playerFirstName === 'string' ? body.playerFirstName.trim().slice(0, 80) : '';
  const last = typeof body.playerLastName === 'string' ? body.playerLastName.trim().slice(0, 80) : '';
  if (!first) return NextResponse.json({ errors: { playerFirstName: 'Player first name is required' } }, { status: 400 });

  const guardianEmail = typeof body.guardianEmail === 'string' ? body.guardianEmail.trim().slice(0, 200) : '';
  if (guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
    return NextResponse.json({ errors: { guardianEmail: 'Enter a valid email address' } }, { status: 400 });
  }

  const registration = await createRepTryoutRegistration({
    programYearId: r.programYear.id,
    teamId: r.teamId,
    orgId: r.orgId,
    playerFirstName: first,
    playerLastName: last,
    // guardian details unknown at walk-up; stored empty (NOT NULL), filled in later
    guardianFirstName: '',
    guardianLastName: '',
    guardianEmail,
    guardianPhone: null,
  });
  await updateRepTryoutCheckin(registration.id, { isCheckedIn: true });

  return NextResponse.json({ ok: true }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates' });
