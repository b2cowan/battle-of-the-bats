import { NextResponse } from 'next/server';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import { resolveFamilyCoachContext } from '@/lib/family-coach-route';
import { getActiveRepProgramYear } from '@/lib/db';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { FamilyLinkError, declineFamilyLink, revokeFamilyLink } from '@/lib/family-access';
import {
  GUARDIAN_CAP_MESSAGE,
  GUARDIAN_TIER_ENABLED,
  isGuardianCapViolation,
  MAX_GUARDIANS_PER_PLAYER,
  approveGuardianLink,
  getGuardiansByPlayer,
  inviteGuardian,
} from '@/lib/family-guardian';

/**
 * Coach-side guardian management — the per-player "guardians" card (S5, bottom card).
 *
 * ⚠ The whole route 404s while the guardian tier is switched off. A coach must not see a
 * panel for something that cannot yet happen.
 *
 * Permission: `rosterPii`, same as the team family access panel — this surface shows guardian
 * email addresses.
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

  const { byPlayer, unattachedRequests } = await getGuardiansByPlayer(teamId, programYear.id);
  return NextResponse.json({
    ok: true,
    maxPerPlayer: MAX_GUARDIANS_PER_PLAYER,
    byPlayer: Object.fromEntries(byPlayer),
    // Parent-initiated requests arrive with NO player attached — the coach names the child at
    // approval. They are returned separately because there is no player to file them under,
    // and the coach's screen shows them on every player page so the coach can approve the one
    // whose child it is.
    unattachedRequests,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/guardians' });

/** Invite a guardian directly to a player, at an address the coach chooses. */
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
    const { token } = await inviteGuardian({
      orgId: ctx.org.id,
      repTeamId: teamId,
      playerId,
      email,
      invitedByUserId: ctx.user.id,
    });
    const origin = resolveTrustedAppOrigin(req);
    return NextResponse.json({ ok: true, url: `${origin}/family/claim/${token}` });
  } catch (e) {
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
 * Approve / decline / revoke one guardian link.
 *
 * Approving REQUIRES a `playerId` — the coach naming which child this adult belongs to. That
 * is the whole verification step: the requester typed a name into a form that showed them
 * nothing, and this is where a human who knows the team decides whether it is true.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  if (!GUARDIAN_TIER_ENABLED) return offOrNotFound();

  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const linkId = typeof body?.linkId === 'string' ? body.linkId : '';
  const action = body?.action;
  if (!linkId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  try {
    if (action === 'approve') {
      const playerId = typeof body?.playerId === 'string' ? body.playerId : '';
      if (!playerId) return NextResponse.json({ error: 'player_required' }, { status: 400 });
      await approveGuardianLink({
        linkId, repTeamId: teamId, playerId, approvedByUserId: ctx.user.id,
      });
      return NextResponse.json({ ok: true, status: 'verified' });
    }
    if (action === 'decline') {
      const link = await declineFamilyLink({ linkId, repTeamId: teamId, role: 'guardian' });
      return NextResponse.json({ ok: true, status: link.status });
    }
    if (action === 'revoke') {
      const link = await revokeFamilyLink({ linkId, repTeamId: teamId, role: 'guardian' });
      return NextResponse.json({ ok: true, status: link.status });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  } catch (e) {
    if (e instanceof FamilyLinkError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/guardians' });
