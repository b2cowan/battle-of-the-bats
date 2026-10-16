import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney, moveRefused } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { canMoveClubMoney } from '@/lib/member-access';
import { isUuid } from '@/lib/utils';
import { acceptAsk, answerView, declineAsk } from '@/lib/club-hand-back';
import { HAND_BACK_WORDS, acceptedNotice } from '@/lib/club-hand-back-words';

type Params = { params: Promise<{ id: string }> };

/**
 * A HAND-BACK THAT ASKS FOR MONEY BACK, ANSWERED (Club Tier Stage 11d, part A — Asks 3, 4, 5, 6; hub specimen 4).
 *
 * GET   ?orgSlug= — the Answer window, the same from every door (Payment requests now; the schedule's page in part B; the
 *       bell): the Sundays still to come, who asked and when, the figure and how it was worked out, the team's bill, ONE
 *       statement of what Accept does, the open time's cost, and whether this member may answer (`canAnswer`).
 * PATCH { action: 'accept' } — one step: the Sundays open, the money settles (a credit off what the team owes, latest
 *       payment first; what it had paid, an accepted request to pay), the coach is told. Never Changed since sent. A LATE
 *       ask (Stage 11d part C, Ask 12) settles the money only — its Sundays opened at the hand-back.
 * PATCH { action: 'decline', reason? } — the Sundays stay the team's; the coach reads the reason.
 *
 * ⚖ WHO: reading — the club ↔ team money loop (`resolveClubMoney` scope 'loop') inside the member's team groups (B11);
 * answering — whoever holds the club's Accounting (`canMoveClubMoney`, Ask 4: money moves, so the money rule answers).
 */
async function resolve(req: Request, id: string, write: boolean) {
  const r = await resolveClubMoney(req, { scope: 'loop', write });
  if ('error' in r) return r;
  if (!isUuid(id)) return { error: NextResponse.json({ error: HAND_BACK_WORDS.refuse.notFound, code: 'not_found' }, { status: 404 }) };
  const view = await answerView(r.ctx.org.id, id, canMoveClubMoney(r.ctx, r.ctx.org));
  if (!view) return { error: NextResponse.json({ error: HAND_BACK_WORDS.refuse.notFound, code: 'not_found' }, { status: 404 }) };
  const scope = await teamIdsInScope(r.ctx);
  if (scope && !scope.has(view.teamId)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { ctx: r.ctx, view };
}

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const r = await resolve(req, id, false);
  if ('error' in r) return r.error;
  return NextResponse.json({ ask: r.view });
}, { route: '/api/admin/accounting/hand-backs/[id]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const r = await resolve(req, id, true);
  if ('error' in r) return r.error;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.action === 'accept') {
    const out = await acceptAsk(r.ctx, id);
    if (!out.ok) return moveRefused(out);
    return NextResponse.json({ ok: true, notice: acceptedNotice(out), creditCents: out.creditCents, payCents: out.payCents });
  }
  if (body.action === 'decline') {
    const out = await declineAsk(r.ctx, id, body.reason);
    if (!out.ok) return moveRefused(out);
    return NextResponse.json({ ok: true, notice: out.late ? HAND_BACK_WORDS.declinedLate(out.teamName) : HAND_BACK_WORDS.declined(out.teamName, out.what) });
  }
  return NextResponse.json({ error: 'action must be accept or decline', code: 'bad_action' }, { status: 400 });
}, { route: '/api/admin/accounting/hand-backs/[id]' });
