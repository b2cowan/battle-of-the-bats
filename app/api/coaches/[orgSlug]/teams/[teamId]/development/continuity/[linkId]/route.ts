import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeamContinuityLinks,
  getContinuityCurrentAlias,
  decideContinuityLink,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';

/** Decide a continuity pair: confirm, or reject ("Not the same player" — including the
 *  always-visible unlink on a confirmed link, which is a confirmed→rejected transition so
 *  the tombstone keeps the pair from ever re-suggesting). "Not sure yet" makes no call.
 *
 *  Transitions are guarded twice: pre-checked here for honest error copy, and enforced in
 *  the decideContinuityLink UPDATE itself (races answer 409, never resurrect a tombstone).
 *  The one-confirmed-identity rule is checked across the accept-boundary ALIAS too — the
 *  DB's partial unique index can't see that a roster row and its originating registration
 *  are the same person. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; linkId: string }> },) => {
  const { orgSlug, teamId, linkId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can review returning players.');
  if (denied) return denied;

  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = body.action === 'confirm' ? 'confirmed' : body.action === 'reject' ? 'rejected' : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'confirm' or 'reject'" }, { status: 400 });
  }

  const links = await getRepTeamContinuityLinks(teamId);
  const existing = links.find(l => l.id === linkId);
  if (!existing) return NextResponse.json({ error: 'Link not found' }, { status: 404 });

  if (action === 'confirmed') {
    if (existing.status !== 'suggested') {
      return NextResponse.json({ error: 'This suggestion was already decided — refresh to see the latest.' }, { status: 409 });
    }
    const currentIds = new Set([existing.currentRosterId ?? existing.currentRegistrationId ?? '']);
    const alias = await getContinuityCurrentAlias({
      rosterId: existing.currentRosterId, registrationId: existing.currentRegistrationId,
    });
    if (alias) currentIds.add(alias);
    const alreadyConfirmed = links.some(l => l.id !== linkId && l.status === 'confirmed'
      && currentIds.has(l.currentRosterId ?? l.currentRegistrationId ?? ''));
    if (alreadyConfirmed) {
      return NextResponse.json({ error: 'Another record is already confirmed for this player — unlink it first.' }, { status: 409 });
    }
  } else if (existing.status === 'rejected') {
    return NextResponse.json({ link: existing }); // already rejected — idempotent no-op
  }

  try {
    const link = await decideContinuityLink(linkId, teamId, action, ctx.user.id);
    if (!link) {
      // The guarded UPDATE matched nothing: the status changed between our read and write.
      return NextResponse.json({ error: 'This suggestion was already decided — refresh to see the latest.' }, { status: 409 });
    }
    return NextResponse.json({ link });
  } catch (error: unknown) {
    // One CONFIRMED identity per current entity (partial unique) — the same-id race.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Another record is already confirmed for this player — unlink it first.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/continuity/[linkId]' });
