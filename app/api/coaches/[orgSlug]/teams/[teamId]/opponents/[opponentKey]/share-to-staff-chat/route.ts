import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canJoinStaffChat } from '@/lib/coach-capabilities';
import { normalizeOpponentKeyParam, formatGamePlanSnapshot } from '@/lib/coach-opponents';
import { assembleOpponentCard } from '@/lib/coach-opponent-card';
import { getStaffChatRoom, postChatMessage, ChatError, MAX_MESSAGE_LENGTH } from '@/lib/chat-service';
import { getSportPack } from '@/lib/sports';

/**
 * Game-plan share (P2, mockup 5c): post a SNAPSHOT of this opponent's card — matchup,
 * book line, tagged observations, the numbers block — into the team's existing staff room,
 * as the sharing coach. A snapshot, not a live link: later book edits never rewrite chat
 * history. Assembly is the card GET's own (lib/coach-opponent-card), so the room reads
 * exactly what the coach was looking at.
 *
 * Caps `staffChat`; the room membership check inside postChatMessage is the second lock.
 * Live-season route off the working-season read — INSTRUMENT ruling (coach-history-endpoint-guard).
 */
export const POST = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string }> },) => {
  const { orgSlug, teamId, opponentKey } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canJoinStaffChat(assignment.capabilities), 'You do not have access to staff chat.');
  if (denied) return denied;

  const key = normalizeOpponentKeyParam(opponentKey);
  if (!key) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Independent reads — the room's one indexed query rides under the heavier assembly.
  const [card, room] = await Promise.all([
    assembleOpponentCard({ teamId, key, activeYearId: programYear.id, sportPack: getSportPack(team.sport) }),
    getStaffChatRoom(ctx.org.id, teamId),
  ]);
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!room) {
    return NextResponse.json({ error: 'This team has no staff room.' }, { status: 409 });
  }

  const body = formatGamePlanSnapshot({
    displayName: card.entry.displayName,
    record: card.entry.record,
    lastMeeting: card.entry.lastMeeting,
    summary: card.entry.summary,
    observations: card.observations,
    insights: card.insights,
    maxLength: MAX_MESSAGE_LENGTH,
  });

  try {
    await postChatMessage({ roomId: room.id, senderUserId: ctx.user.id, body });
  } catch (e: unknown) {
    if (e instanceof ChatError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]/share-to-staff-chat' });
