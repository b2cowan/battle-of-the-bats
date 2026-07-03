import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getRepTryoutRegistration,
  updateRepTryoutCheckin,
} from '@/lib/db';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepTryoutRegistration } from '@/lib/types';

type Owned = { ok: false; res: Response } | { ok: true; registration: RepTryoutRegistration; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

/** Authorize the assigned coach and confirm the registration belongs to this org + the path team. */
async function resolveOwned(orgSlug: string, teamId: string, registrationId: string): Promise<Owned> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };

  const registration = await getRepTryoutRegistration(registrationId);
  if (!registration || registration.orgId !== ctx.org.id || registration.teamId !== teamId) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { ok: true, registration, assignment };
}

// Check-in toggle (and bib edit, if ever needed).
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; registrationId: string }> },) => {
  const { orgSlug, teamId, registrationId } = await params;
  const owned = await resolveOwned(orgSlug, teamId, registrationId);
  if (!owned.ok) return owned.res;
  const denied = denyUnless(owned.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const body = await req.json();
  const fields: { isCheckedIn?: boolean; bibNumber?: string | null } = {};
  if (typeof body.isCheckedIn === 'boolean') fields.isCheckedIn = body.isCheckedIn;
  if (typeof body.bibNumber === 'string') fields.bibNumber = body.bibNumber.trim() || null;
  if (fields.isCheckedIn === undefined && fields.bibNumber === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const registration = await updateRepTryoutCheckin(registrationId, fields);
  return NextResponse.json({ registration });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-candidates/[registrationId]' });
