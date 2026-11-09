import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { lookupReplayUpdate, replayBillingEvent } from '@/lib/billing-event-replay-run';
import { replayResultWords } from '@/lib/billing-event-replay';

/**
 * Replay one stored Stripe plan-billing update (Plans & pricing Stage 2 Part 5; owner rulings 2026-11-06 and 2026-11-08). The ONE
 * write on Health › Stripe (POST; the GET below is the window's read before the click):
 *   1. the `replay_events` power (Super admin only), checked before anything is read;
 *   2. the engine (`lib/billing-event-replay-run.ts`): every refusal is a fixed sentence and writes nothing; the change-log row
 *      with the reason is written FIRST, then the same claim a live delivery takes, the run (no customer message), the outcome.
 * The browser sends the update's id and a reason. The answer carries only what the window shows: the club's name, the five
 * billing fields before and after, the words. Nothing is sent to Stripe and nothing is sent to the customer.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = { eventId?: unknown; reason?: unknown };

/**
 * What the window shows before the click (Session 2): `?id=evt_…` → the update's type, when it arrived, the club's name, its last
 * result, and the refusal our own row already decides. The same power as the replay. Read-only: no Stripe call, no write, never
 * the payload.
 */
export const GET = withObservability(async (req: Request) => {
  const auth = await requirePlatformPower('replay_events');
  if (auth.response) return auth.response;
  const answer = await lookupReplayUpdate(new URL(req.url).searchParams.get('id'));
  if (!answer.ok) return NextResponse.json({ error: answer.refusal.title, refusal: answer.refusal }, { status: answer.status });
  return NextResponse.json({ update: answer.update, refusal: answer.refusal });
}, { route: '/api/platform-admin/watching-stripe/replay' });

export const POST = withObservability(async (req: Request) => {
  const auth = await requirePlatformPower('replay_events');
  if (auth.response) return auth.response;
  // `?? {}`: a body of literal null parses, and must still meet the reason's refusal rather than a 500.
  const body = ((await req.json().catch(() => null)) ?? {}) as Body;

  const answer = await replayBillingEvent({ eventId: body.eventId, reason: body.reason, actorEmail: auth.user.email ?? '' });
  if (!answer.ok) {
    return NextResponse.json({ error: answer.refusal.title, refusal: answer.refusal, nothingReplayed: true }, { status: answer.status });
  }
  const { result } = answer;
  return NextResponse.json({
    ok: true,
    result: {
      kind: result.kind, eventId: result.eventId, eventType: result.eventType, clubName: result.clubName,
      rows: result.rows, recordRead: result.recordRead, marked: result.marked, error: result.error,
    },
    words: replayResultWords(result),
  });
}, { route: '/api/platform-admin/watching-stripe/replay' });
