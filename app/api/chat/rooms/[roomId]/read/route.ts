import { NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorized, forbidden } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { getMembership, markRoomRead } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ roomId: string }> };

/** PATCH /api/chat/rooms/[roomId]/read — advance the caller's "last seen" watermark. */
export const PATCH = withObservability(async (_req: Request, { params }: Params) => {
  const { roomId } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const membership = await getMembership(roomId, user.id);
  if (!membership || membership.status === 'removed') return forbidden();

  await markRoomRead(roomId, user.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/chat/rooms/[roomId]/read' });
