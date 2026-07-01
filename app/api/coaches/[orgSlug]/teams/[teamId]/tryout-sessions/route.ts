import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepTryout,
  getOrCreateRepTryout,
  updateRepTryout,
  getRepTryoutSessions,
  createRepTryoutSession,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; userId: string; programYear: RepProgramYear };

/** Resolve + authorize the assigned coach for this team, on the team's ACTIVE program year. */
async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.some(a => a.teamId === teamId)) return { ok: false, res: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }
  return { ok: true, orgId: ctx.org.id, teamId, userId: ctx.user.id, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const tryout = await getRepTryout(r.programYear.id);
  const sessions = tryout ? await getRepTryoutSessions(tryout.id) : [];
  return NextResponse.json({ tryout, sessions });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const body = await req.json();
  if (!body.startsAt || isNaN(new Date(body.startsAt).getTime())) {
    return NextResponse.json({ errors: { startsAt: 'A valid date and time is required' } }, { status: 400 });
  }

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const session = await createRepTryoutSession({
    tryoutId: tryout.id,
    programYearId: r.programYear.id,
    teamId: r.teamId,
    orgId: r.orgId,
    // Store the naive wall-clock string as-is (matches rep_team_events) — never UTC-convert, so the
    // time is server-/viewer-timezone independent. Display reads it by slicing the wall clock.
    startsAt: body.startsAt,
    endsAt: body.endsAt || null,
    location: body.location?.trim() || null,
    locationAddress: body.locationAddress?.trim() || null,
    fieldNumber: body.fieldNumber?.trim() || null,
    label: body.label?.trim() || null,
  });
  return NextResponse.json({ session, tryout }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions' });

// Update the tryout-cycle config (blind mode). The tryout is created lazily if needed.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const body = await req.json();
  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });

  const patch: { isAnonymous?: boolean; scoresLockedAt?: string | null; scoresLockedBy?: string | null } = {};

  // Reveal is ONE-WAY: blind (true) → revealed (false) is allowed; re-blinding once revealed is not
  // (evaluators have already seen names — re-hiding would be theatre and hurts trust in the record).
  if (typeof body.isAnonymous === 'boolean' && body.isAnonymous !== tryout.isAnonymous) {
    if (body.isAnonymous === true && tryout.isAnonymous === false) {
      return NextResponse.json({ error: 'already_revealed', message: 'Names have already been revealed — this can’t be undone.' }, { status: 409 });
    }
    patch.isAnonymous = body.isAnonymous;
  }

  // Score lock is reversible: lock freezes evaluator input; reopen clears it.
  if (typeof body.lockScores === 'boolean') {
    if (body.lockScores) { patch.scoresLockedAt = new Date().toISOString(); patch.scoresLockedBy = r.userId; }
    else { patch.scoresLockedAt = null; patch.scoresLockedBy = null; }
  }

  const updated = Object.keys(patch).length ? await updateRepTryout(tryout.id, patch) : tryout;
  return NextResponse.json({ tryout: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions' });
