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
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import { wallClockStringToUtc } from '@/lib/timezone';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; userId: string; programYear: RepProgramYear; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

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
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }
  return { ok: true, orgId: ctx.org.id, teamId, userId: ctx.user.id, programYear, assignment };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const tryout = await getRepTryout(r.programYear.id);
  const sessions = tryout ? await getRepTryoutSessions(tryout.id) : [];
  return NextResponse.json({ tryout, sessions });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-sessions' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json();
  if (!body.startsAt || isNaN(new Date(body.startsAt).getTime())) {
    return NextResponse.json({ errors: { startsAt: 'A valid date and time is required' } }, { status: 400 });
  }
  // A session can't end before it starts (owner 2026-08-17 — one was saved reading 6:00–5:00 p.m.).
  // Wall-clock strings compare as local dates; equal is rejected too (a zero-length session is a
  // typo). ⚠ Parseability first (/review): NaN <= x is false, so an unparseable endsAt would sail
  // past the order check and 500 at the insert instead of 400-ing here.
  if (body.endsAt) {
    const end = new Date(body.endsAt).getTime();
    if (isNaN(end)) {
      return NextResponse.json({ errors: { startsAt: 'A valid end time is required' } }, { status: 400 });
    }
    if (end <= new Date(body.startsAt).getTime()) {
      return NextResponse.json({ errors: { startsAt: 'The end time must be after the start time' } }, { status: 400 });
    }
  }

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const session = await createRepTryoutSession({
    tryoutId: tryout.id,
    programYearId: r.programYear.id,
    teamId: r.teamId,
    orgId: r.orgId,
    /**
     * ⚠⚠ CONVERTED TO A REAL INSTANT IN THE CLUB'S ZONE (owner ruling 2026-08-24).
     *
     * This used to store the browser's naive `datetime-local` string as-is, into a `timestamptz`
     * column — so Postgres labelled a typed "17:00" as 17:00 UTC, which is 1 p.m. in Toronto. Every
     * tryout screen then read it back by SLICING the raw text, which un-did the error and showed
     * 5 p.m. again. Self-consistent, and four hours from the moment it recorded.
     *
     * It only stayed invisible while both halves were wrong together. The coach demo sandbox writes
     * its sessions through the platform's normal wall-clock→UTC helper — correctly — and the
     * slicing readers displayed those **four hours late** on a public page: a 9:00 a.m. tryout read
     * 1:00 p.m. That is what turned this from a latent trap into a defect.
     *
     * Now: one convention, the same one `rep_team_events` has always used. Stored as an instant,
     * read through `formatInOrgZone`. Never re-introduce a slicing reader.
     */
    startsAt: wallClockStringToUtc(body.startsAt) ?? body.startsAt,
    endsAt: body.endsAt ? (wallClockStringToUtc(body.endsAt) ?? body.endsAt) : null,
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
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

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
