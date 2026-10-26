import { NextResponse } from 'next/server';
import { requirePlatformPower, hasPlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getStripe } from '@/lib/stripe';
import { isDemoOrgId } from '@/lib/demo-org-server';
import { staffBelongsToClub } from '@/lib/staff-own-club';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { readClubMoney } from '@/lib/console-money-stripe';
import { clubStripeFacts, priceMap, refundStore } from '@/lib/console-money-store';

/**
 * The Money tab's read (Support console Stage 3, owner Q4 A; drawing A): Stripe, live, for this club's customer — only for
 * a role with the Stripe-reading power (A2). A role without it is refused here BEFORE any Stripe call; its screen never
 * calls. Nothing Stripe returns is stored, and the answer is never cached. The club is the address's `[id]`.
 * `?before=<iso>` reads the twelve months before it ("Show older charges").
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('find_stripe');
  if (auth.response) return auth.response;
  const { id } = await params;
  const beforeRaw = new URL(req.url).searchParams.get('before');
  const before = beforeRaw && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(beforeRaw) && !Number.isNaN(Date.parse(beforeRaw)) ? beforeRaw : null;

  const [club, prices] = await Promise.all([clubStripeFacts(id), priceMap()]);
  if (!club) return NextResponse.json({ error: 'Club not found.' }, { status: 404, headers: noStore });
  if (!club.customerId) return NextResponse.json({ state: 'no_customer' }, { headers: noStore });
  if (club.customerShared) return NextResponse.json({ state: 'shared' }, { headers: noStore });

  const readAt = new Date();
  let read;
  try {
    read = await readClubMoney(getStripe(), club.customerId, { prices, testMode: !stripeKeyIsLive(), now: readAt, before });
  } catch (err) {
    console.warn('[platform-admin] money read failed:', (err as { code?: string; type?: string }).code ?? (err as { type?: string }).type ?? 'error');
    return NextResponse.json({ state: 'unreachable', readAt: readAt.toISOString() }, { headers: noStore }); // utc-intentional
  }

  // "Show older charges" keeps only the charges: nothing else is worked out for it.
  if (before) return NextResponse.json({ state: 'read', read, portalSubscriptionIds: club.portalSubscriptionIds, refundGate: null }, { headers: noStore });

  // What the console knows before the click (drawing G), as facts: the screen asks refundDoorRefusal — the rule the refund
  // route asks — whether the door shows and which line says why.
  const refundGate = { role: auth.role, ownClub: false, demoClub: false, refundsLast24h: 0 };
  if (hasPlatformPower(auth.role, 'refund')) {
    const [own, demo, count] = await Promise.all([
      staffBelongsToClub(id, { id: auth.user.id, email: auth.user.email ?? '' }, { stripeCustomerEmail: read.customer.email }),
      isDemoOrgId(id),
      // Only Billing's limit uses it (decideRefund); counting for a Super admin too keeps the role out of this route.
      refundStore.countByActorSince(auth.user.email ?? '', new Date(readAt.getTime() - 86_400_000).toISOString()), // utc-intentional
    ]);
    Object.assign(refundGate, { ownClub: own, demoClub: demo, refundsLast24h: count });
  }

  return NextResponse.json({
    state: 'read',
    read,
    portalSubscriptionIds: club.portalSubscriptionIds,
    refundGate,
  }, { headers: noStore });
}, { route: '/api/platform-admin/orgs/[id]/money' });
