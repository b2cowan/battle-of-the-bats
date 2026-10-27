import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { readClubFees } from '@/lib/platform-stripe-fees';

/**
 * The Money tab's Stripe-fees panel (Club Tier Stage 12d-1 Part 4; words §6.1 `pa.panel.fees`): every Stripe fee this
 * club's online payments caused and how each is billed — on its subscription's next invoice, on its own monthly invoice
 * (paid or unpaid; nothing switches off by itself), credited, test mode, or couldn't be billed (with Stripe's error, and a
 * Retry for the roles that bill). Ours, read from our own rows; the Stripe-reading power, like the tab.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    return NextResponse.json({ fees: await readClubFees(id, { limit: 100 }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'The fees couldn’t be read.' }, { status: 503 });
  }
}, { route: '/api/platform-admin/orgs/[id]/money/stripe-fees' });
