import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { resolveClubPractice } from '@/lib/club-practice-route';
import { askLater, lateAskOffer, withdrawAsk } from '@/lib/club-hand-back';
import { waitingAsksOfTeam } from '@/lib/club-hand-back-reads';
import { HAND_BACK_WORDS } from '@/lib/club-hand-back-words';

// ---------------------------------------------------------------------------
// ASK THE CLUB FOR MONEY BACK, LATER (Club Tier Stage 11d, part C — Ask 12; hub Stage 11d, C2, C3's second frame, C4).
//
// GET  — Ask the club for money back?: every practice of this practice's hand-back still handed back, each at what the
//        club billed for it (Ask 1's figure, never more than the team can still ask back) — read, not chosen.
// POST — the late ask and its From-club, money-back request in one step (`club_hand_back_ask_later`); the club answers it
//        in Accounting › Payment requests like any ask (Ask 4); Accept settles the money only. Nothing about the time.
// DELETE — withdraw the late ask waiting on this practice (Ask 3's): the ask and its request go together; the practices
//        stay handed back, and the money can be asked again.
//
// ⚖ WHO: the team's money WRITE access (`canWriteMoney` — Make a request's own permission), on its live season. Not the
// schedule's capability: the money people are told of a hand-back nobody asked money for (Ask 13), and ask from here.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> };

async function resolve(orgSlug: string, teamId: string, eventId: string) {
  const r = await resolveClubPractice(orgSlug, teamId, eventId);
  if (!r.ok) return r;
  const denied = denyUnless(canWriteMoney(r.capabilities), HAND_BACK_WORDS.refuse.noMoney);
  if (denied) return { ok: false as const, error: denied };
  return r;
}

export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const out = await lateAskOffer({ orgId: r.ctx.org.id, teamId, teamName: r.team.name, event: r.event });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json(out.offer);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/money-back' });

export const POST = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const out = await askLater({
    org: r.ctx.org, teamId, teamName: r.team.name, teamGroupId: r.team.groupId ?? null, actorUserId: r.ctx.user.id, event: r.event,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json(out);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/money-back' });

export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  // The late ask waiting on this practice (the team's waiting asks — almost always none).
  const ask = (await waitingAsksOfTeam(r.ctx.org.id, teamId)).find(a => a.lateFor && a.slotIds.includes(r.event.clubScheduleSlotId ?? ''));
  if (!ask) return NextResponse.json({ error: HAND_BACK_WORDS.refuse.answered, code: 'answered' }, { status: 409 });
  const out = await withdrawAsk({
    org: r.ctx.org, teamId, teamName: r.team.name, teamGroupId: r.team.groupId ?? null, actorUserId: r.ctx.user.id, handBackId: ask.id,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/money-back' });
