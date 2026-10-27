import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { readClubOnlinePayments } from '@/lib/platform-online-payments';

/**
 * A club's Online payments tab in the console (Club Tier Stage 12d-2 Part 5 — frame 6, words §6.1; ask 7: read only).
 * The roles that read a club's Stripe records (owner ruling 3, 2026-10-27; the `online_payments` area holds the same
 * roles). 404 for a club that never connected: it has no tab. Nothing here writes.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const read = await readClubOnlinePayments(id);
    if (!read) return NextResponse.json({ error: 'This club never connected payouts.' }, { status: 404 });
    return NextResponse.json(read, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The club’s online payments could not be read. Try again.' }, { status: 503 });
  }
}, { route: '/api/platform-admin/orgs/[id]/online-payments' });
