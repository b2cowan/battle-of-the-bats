import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { tournamentTakesOnlinePayments } from '@/lib/tournament-online-payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Does this tournament take payments online? (Club Tier Stage 12a, copy §10) — the public registration form's review
 * step asks, to say what will happen once the team is accepted. A yes/no and nothing else: no account, no rate. Any doubt
 * answers no, and the form keeps today's box word for word (A6). The answer is `tournamentTakesOnlinePayments`, which the
 * registration emails read too.
 */
export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const { tournamentId } = await params;
  return NextResponse.json({ online: await tournamentTakesOnlinePayments(tournamentId) });
}, { route: '/api/pay/tournament/[tournamentId]' });
