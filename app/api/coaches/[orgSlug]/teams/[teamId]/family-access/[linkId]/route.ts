import { NextResponse } from 'next/server';
import { denyUnless } from '@/lib/coach-capabilities';
import { resolveFamilyCoachContext } from '@/lib/family-coach-route';
import { withObservability } from '@/lib/observability';
import { followEntity, unfollowEntity } from '@/lib/fan-follows';
import {
  FamilyLinkError,
  approveFamilyLink,
  declineFamilyLink,
  revokeFamilyLink,
} from '@/lib/family-access';

/**
 * Approve / decline / remove one family connection. The coach is the gatekeeper —
 * this is the only place a `requested` row becomes `verified`.
 *
 * ⚠ LIVE SEASON ONLY — see the sibling route's header. Never joins the working-season read.
 */


export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; linkId: string }> },) => {
  const { orgSlug, teamId, linkId } = await params;
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  const denied = denyUnless(assignment.capabilities.rosterPii, 'You do not have access to family contacts for this team.');
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  try {
    if (action === 'approve') {
      const link = await approveFamilyLink({ linkId, repTeamId: teamId, approvedByUserId: ctx.user.id, role: 'follower' });
      // Plant the account follow so the team shows up where a consumer already looks
      // (1.7). Best-effort: the LINK is the authorization, so a follow that fails to
      // write costs the family a shortcut, never their access — approving must not fail
      // because a presentation row didn't land.
      if (link.userId) {
        try {
          await followEntity({ userId: link.userId, entityType: 'rep_team', entityId: teamId, source: 'manual' });
        } catch (e) {
          console.error('[family-access] approve: follow plant failed (non-fatal):', e);
        }
      }
      return NextResponse.json({ ok: true, status: link.status });
    }

    if (action === 'decline') {
      const link = await declineFamilyLink({ linkId, repTeamId: teamId, role: 'follower' });
      return NextResponse.json({ ok: true, status: link.status });
    }

    if (action === 'revoke') {
      const link = await revokeFamilyLink({ linkId, repTeamId: teamId, role: 'follower' });
      // Remove the follow too — leaving a card in someone's Following that leads to a
      // page refusing them is a worse experience than the card simply going away.
      if (link.userId) {
        try {
          await unfollowEntity(link.userId, 'rep_team', teamId);
        } catch (e) {
          console.error('[family-access] revoke: follow removal failed (non-fatal):', e);
        }
      }
      return NextResponse.json({ ok: true, status: link.status });
    }

    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  } catch (e) {
    if (e instanceof FamilyLinkError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/family-access/[linkId]' });
