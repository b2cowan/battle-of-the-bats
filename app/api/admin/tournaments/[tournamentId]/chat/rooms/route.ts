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
import { ChatError } from '@/lib/chat-service';
import {
  listTournamentChatRoomSummaries,
  getTournamentDivisionsForChat,
  createTournamentDivisionRoom,
} from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ tournamentId: string }> };

/**
 * Shared organizer guard: T+ host org + tournament-module access + correct org/scope. Returns a
 * `Response` to short-circuit on denial, or the auth context on success.
 */
async function guard(req: NextRequest, tournamentId: string): Promise<Response | AuthContextWithScope> {
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
  return ctx;
}

/**
 * GET /api/admin/tournaments/[tournamentId]/chat/rooms — the organizer's room switcher: the
 * "All coaches" room (created on demand) + every division room, each with live member/pending counts,
 * plus the tournament's divisions (with team counts) for the "New room" composer.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
  const { tournamentId } = await params;
  const g = await guard(req, tournamentId);
  if (g instanceof Response) return g;

  const [rooms, divisions] = await Promise.all([
    listTournamentChatRoomSummaries(tournamentId, g.user.id),
    getTournamentDivisionsForChat(tournamentId),
  ]);
  return NextResponse.json({ rooms, divisions });
}, { route: '/api/admin/tournaments/[tournamentId]/chat/rooms' });

/**
 * POST /api/admin/tournaments/[tournamentId]/chat/rooms — create a division room. Body:
 * { name: string, divisionIds: string[] }. Membership auto-fills from the chosen divisions.
 */
export const POST = withObservability(async (req: NextRequest, { params }: Params) => {
  const { tournamentId } = await params;
  const g = await guard(req, tournamentId);
  if (g instanceof Response) return g;

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; divisionIds?: unknown };
  const name = typeof body.name === 'string' ? body.name : '';
  const divisionIds = Array.isArray(body.divisionIds)
    ? body.divisionIds.filter((x): x is string => typeof x === 'string')
    : [];

  try {
    const room = await createTournamentDivisionRoom({
      tournamentId,
      name,
      divisionIds,
      createdByUserId: g.user.id,
    });
    return NextResponse.json({ ok: true, roomId: room.id });
  } catch (err) {
    if (err instanceof ChatError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}, { route: '/api/admin/tournaments/[tournamentId]/chat/rooms' });
