import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthContextWithScope,
  unauthorized,
  forbidden,
  scopeGuard,
  requireTournamentInOrg,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { withObservability } from '@/lib/observability';
import {
  getTournamentChatRoom,
  getTournamentRoomById,
  getMembership,
  muteMember,
  unmuteMember,
  softDeleteMessage,
  setPinned,
  setRoomArchived,
  MAX_MUTE_HOURS,
} from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ tournamentId: string }> };

type ModerateBody = {
  action?: 'mute' | 'unmute' | 'delete' | 'close' | 'reopen' | 'pin' | 'unpin';
  /** which room to act on; omit for the default "All coaches" room (back-compat). */
  roomId?: string;
  targetUserId?: string;
  messageId?: string;
  hours?: number;
};

/**
 * POST /api/admin/tournaments/[tournamentId]/chat/moderate — organizer moderation, per room. Actions:
 *   mute (≤72h, post-only block — they keep reading) / unmute / delete (soft) / close / reopen / pin / unpin.
 * Pass `roomId` to target a division room; omit it for the default "All coaches" room. The room is
 * verified to belong to this tournament. Service-role only (the engine deliberately denies these to
 * `authenticated`).
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { tournamentId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;

  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  const scopeDenied = scopeGuard(ctx, tournamentId);
  if (scopeDenied) return scopeDenied;
  const orgDenied = await requireTournamentInOrg(ctx, tournamentId);
  if (orgDenied) return orgDenied;
  if (!hasPlanFeature(ctx.org.planId, 'tournament_chat')) {
    return NextResponse.json({ error: requiresPlanCopy('tournament_chat'), gated: true }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as ModerateBody;

  // Target room: an explicit roomId (verified to belong to this tournament) or the default All-coaches room.
  const room = body.roomId
    ? await getTournamentRoomById(tournamentId, body.roomId)
    : await getTournamentChatRoom(tournamentId);
  if (!room) return NextResponse.json({ error: 'Chat is not set up for this tournament yet.' }, { status: 404 });

  switch (body.action) {
    case 'mute': {
      if (!body.targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });
      // An organizer/moderator cannot be muted (no admin-vs-admin silencing).
      const target = await getMembership(room.id, body.targetUserId);
      if (target?.member_role === 'moderator') {
        return NextResponse.json({ error: 'Organizers cannot be muted.' }, { status: 400 });
      }
      const hours = Number.isFinite(body.hours) ? Number(body.hours) : MAX_MUTE_HOURS;
      const until = await muteMember({ roomId: room.id, targetUserId: body.targetUserId, hours });
      return NextResponse.json({ ok: true, mutedUntil: until });
    }
    case 'unmute': {
      if (!body.targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 });
      await unmuteMember({ roomId: room.id, targetUserId: body.targetUserId });
      return NextResponse.json({ ok: true });
    }
    case 'delete': {
      if (!body.messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });
      await softDeleteMessage({ roomId: room.id, messageId: body.messageId, byUserId: ctx.user.id });
      return NextResponse.json({ ok: true });
    }
    case 'pin':
    case 'unpin': {
      if (!body.messageId) return NextResponse.json({ error: 'messageId required' }, { status: 400 });
      await setPinned({ roomId: room.id, messageId: body.messageId, byUserId: ctx.user.id, pinned: body.action === 'pin' });
      return NextResponse.json({ ok: true });
    }
    case 'close': {
      await setRoomArchived({ roomId: room.id, archived: true });
      return NextResponse.json({ ok: true });
    }
    case 'reopen': {
      await setRoomArchived({ roomId: room.id, archived: false });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}, { route: '/api/admin/tournaments/[tournamentId]/chat/moderate' });
