import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthContextWithScope,
  unauthorized,
  forbidden,
  scopeGuard,
  requireTournamentInOrg,
  type AuthContextWithScope,
} from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { withObservability } from '@/lib/observability';
import {
  ChatError,
  getTournamentRoomById,
  getRoomRoster,
  listOpenReportsForRoom,
  syncTournamentChatRoom,
  renameChatRoom,
  deleteTournamentChatRoom,
  roomDivisionIds,
  type ChatRoom,
} from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ tournamentId: string; roomId: string }> };

/**
 * Auth + plan guard; on success returns the verified room (∈ this tournament) + ctx, else a `Response`
 * to short-circuit (denial or 404).
 */
async function resolve(
  req: NextRequest,
  tournamentId: string,
  roomId: string,
): Promise<Response | { ctx: AuthContextWithScope; room: ChatRoom }> {
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
  const room = await getTournamentRoomById(tournamentId, roomId);
  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
  return { ctx, room };
}

/** GET — a single room's detail + roster (joined members + "Not yet joined"), scoped to its divisions. */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { tournamentId, roomId } = await params;
  const r = await resolve(req, tournamentId, roomId);
  if (r instanceof Response) return r;

  const sync = await syncTournamentChatRoom({ room: r.room });
  const [roster, reports] = await Promise.all([getRoomRoster(r.room), listOpenReportsForRoom(r.room.id)]);
  return NextResponse.json({
    room: {
      id: r.room.id,
      name: r.room.name,
      isArchived: r.room.isArchived,
      refSubId: r.room.refSubId,
      divisionIds: roomDivisionIds(r.room) ?? [],
    },
    members: roster.members,
    pending: roster.pending,
    activeCount: sync.activeCount,
    // Member-filed reports awaiting an organizer decision (Unified Home R3-2 moderation queue).
    reports,
  });
}, { route: '/api/admin/tournaments/[tournamentId]/chat/rooms/[roomId]' });

/** PATCH — rename a room. Body: { name: string }. */
export const PATCH = withObservability(async (req: NextRequest, { params }: Params) => {
  const { tournamentId, roomId } = await params;
  const r = await resolve(req, tournamentId, roomId);
  if (r instanceof Response) return r;

  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' ? body.name : '';
  try {
    await renameChatRoom(r.room.id, name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}, { route: '/api/admin/tournaments/[tournamentId]/chat/rooms/[roomId]' });

/** DELETE — remove a division room (the All-coaches room is protected; close it instead). */
export const DELETE = withObservability(async (req: NextRequest, { params }: Params) => {
  const { tournamentId, roomId } = await params;
  const r = await resolve(req, tournamentId, roomId);
  if (r instanceof Response) return r;

  try {
    await deleteTournamentChatRoom(r.room);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}, { route: '/api/admin/tournaments/[tournamentId]/chat/rooms/[roomId]' });
