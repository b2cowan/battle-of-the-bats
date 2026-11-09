import { NextResponse } from 'next/server';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import { resolveFamilyCoachContext } from '@/lib/family-coach-route';
import { getActiveRepProgramYear } from '@/lib/db';
import { FamilyLinkError, declineFamilyLink, revokeFamilyLink } from '@/lib/family-access';
import {
  GUARDIAN_CAP_MESSAGE,
  GUARDIAN_TIER_ENABLED,
  INVITATION_ROW_PREFIX,
  isGuardianCapViolation,
  MAX_GUARDIANS_PER_PLAYER,
  getGuardiansByPlayer,
} from '@/lib/family-guardian';
import { FamilyInvitationRefusal, cancelRepInvitation, issueRepInvitation } from '@/lib/family-invitation';

/**
 * Coach-side guardian management — the per-player "guardians" card (S5, bottom card).
 *
 * ⚠ The whole route 404s while the guardian tier is switched off. A coach must not see a
 * panel for something that cannot yet happen.
 *
 * Permission: `rosterPii` — this surface shows guardian email addresses.
 *
 * ⚠ LIVE SEASON ONLY — rides `resolveFamilyCoachContext`, which resolves the team's ACTIVE year
 * and nothing else. Managing who may reach a child is an instrument, not a record.
 */

function offOrNotFound() {
  return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });
}

/** Every guardian on the team, grouped by player, with the roster-contact assist resolved. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  if (!GUARDIAN_TIER_ENABLED) return offOrNotFound();

  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return NextResponse.json({ error: 'no_active_season' }, { status: 404 });

  const byPlayer = await getGuardiansByPlayer(teamId, programYear.id);
  return NextResponse.json({
    ok: true,
    maxPerPlayer: MAX_GUARDIANS_PER_PLAYER,
    byPlayer: Object.fromEntries(byPlayer),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/guardians' });

/** Send invitation (Stage 4a ruling 4): an invitation for this player, to the address the coach typed. Nothing happens by itself
 *  at roster add. The email itself is sent from here once Stage 4a Part 5 lands; there is no link to copy. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  if (!GUARDIAN_TIER_ENABLED) return offOrNotFound();

  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const playerId = typeof body?.playerId === 'string' ? body.playerId : '';
  const email = typeof body?.email === 'string' ? body.email : '';
  if (!playerId || !email) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    const { invitationId } = await issueRepInvitation({
      orgId: ctx.org.id,
      repTeamId: teamId,
      playerId,
      email,
      sentByUserId: ctx.user.id,
    });
    return NextResponse.json({ ok: true, invitationId });
  } catch (e) {
    if (e instanceof FamilyInvitationRefusal) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    if (e instanceof FamilyLinkError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    // The database cap trigger firing means this coach lost a race with another approval —
    // an explanation, not a 500.
    if (isGuardianCapViolation(e)) {
      return NextResponse.json({ error: 'ceiling_reached', message: GUARDIAN_CAP_MESSAGE }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/guardians' });

/**
 * Decline (Cancel invite) / revoke one guardian row. An invited row whose id carries INVITATION_ROW_PREFIX is a rep invitation
 * (mig 453) and Cancel invite cancels it. There is no approve: the approval queue for a claim from a different address went in
 * Stage 4a (ruling 5 — a different email is refused at the accept page).
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  if (!GUARDIAN_TIER_ENABLED) return offOrNotFound();

  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const linkId = typeof body?.linkId === 'string' ? body.linkId : '';
  const action = body?.action;
  if (!linkId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    // Cancel invite on an invitation row (either action the card sends for an invited row).
    if ((action === 'decline' || action === 'revoke') && linkId.startsWith(INVITATION_ROW_PREFIX)) {
      await cancelRepInvitation({ invitationId: linkId.slice(INVITATION_ROW_PREFIX.length), repTeamId: teamId });
      return NextResponse.json({ ok: true, status: 'declined' });
    }
    if (action === 'decline') {
      const link = await declineFamilyLink({ linkId, repTeamId: teamId });
      return NextResponse.json({ ok: true, status: link.status });
    }
    if (action === 'revoke') {
      const link = await revokeFamilyLink({ linkId, repTeamId: teamId });
      return NextResponse.json({ ok: true, status: link.status });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  } catch (e) {
    if (e instanceof FamilyLinkError || e instanceof FamilyInvitationRefusal) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/guardians' });
