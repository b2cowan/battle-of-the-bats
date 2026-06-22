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
import { ensureTournamentChatRoom, syncTournamentChatRoom, getRoomRoster } from '@/lib/chat-service';

export const runtime = 'nodejs';

type Params = { params: Promise<{ tournamentId: string }> };

/**
 * GET /api/admin/tournaments/[tournamentId]/chat — the organizer's moderation view: the live room +
 * full roster (joined members + "Not yet joined" teams). Ensures the room exists and reconciles
 * memberships against the resolved participant set on load (so newly-signed-in coaches appear). The
 * host org must be on Tournament Plus; participating coaches need no plan.
 */
export const GET = withObservability(async (req: NextRequest, { params }: Params) => {
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

  const room = await ensureTournamentChatRoom({ tournamentId, createdByUserId: ctx.user.id });
  const sync = await syncTournamentChatRoom({ room });
  const roster = await getRoomRoster(room);

  return NextResponse.json({
    room: { id: room.id, name: room.name, isArchived: room.isArchived },
    members: roster.members,
    pending: roster.pending,
    activeCount: sync.activeCount,
  });
}, { route: '/api/admin/tournaments/[tournamentId]/chat' });
