import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { clubStripeFacts } from '@/lib/console-money-store';
import { readNeedsLook, registrationDateOrNull } from '@/lib/console-money-sales-store';

/**
 * "Needs a look" (GST/HST Stage 3 Part 3a; owner Ask 4 = A): this club's buyer's sales whose GST/HST answer is missing or does
 * not match what was kept with it — every one on record, whatever its date — with their reasons. Ours, read from our kept tax
 * records (no Stripe call), for the Stripe-reading power only, like the Money route (the records carry an address and what was
 * paid; Ask 7). The club record reads it on open, so the Money tab's dot and strip show before the tab is opened, and the tab's
 * "Needs a look" list is this same answer: one read, so the dot, the strip and the list cannot disagree.
 * A coach's own customer covering several portals is one set of sales, shown on each portal (drawing tab 5). A customer two
 * clubs share is refused, as the Money route refuses it.
 */
export const dynamic = 'force-dynamic';
// Reads every page of one customer's kept records; the Money route gives its Stripe reads the same room.
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

export const GET = withObservability(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id } = await params;
  const [club, registration] = await Promise.all([clubStripeFacts(id), registrationDateOrNull()]);
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404, headers: noStore });
  if (!club.customerId) return NextResponse.json({ state: 'no_customer' }, { headers: noStore });
  if (club.customerShared) return NextResponse.json({ state: 'shared' }, { headers: noStore });
  const look = await readNeedsLook(club.customerId, stripeKeyIsLive(), registration);
  return NextResponse.json(look, { headers: noStore });
}, { route: '/api/platform-admin/orgs/[id]/money/needs-look' });
