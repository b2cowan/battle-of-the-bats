import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { tournamentHasPublicSite, tournamentTakesOnlinePayments } from '@/lib/tournament-online-payments';
import { throttlePublicForm } from '@/lib/public-form-throttle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Does this tournament take payments online? (Club Tier Stage 12a, copy §10) — the public registration form's review
 * step asks, to say what will happen once the team is accepted. A yes/no and nothing else: no account, no rate. Any doubt
 * answers no, and the form keeps today's box word for word (A6). The answer is `tournamentTakesOnlinePayments`, which the
 * registration emails read too.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  // Anonymous and one database read per press: throttled like every public form.
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const { tournamentId } = await params;
  // Only a live, un-canceled event has an answer to give; a draft or made-up id gets the same plain "no" (sweep 3).
  if (!(await tournamentHasPublicSite(tournamentId))) return NextResponse.json({ online: false });
  return NextResponse.json({ online: await tournamentTakesOnlinePayments(tournamentId) });
}, { route: '/api/pay/tournament/[tournamentId]' });
