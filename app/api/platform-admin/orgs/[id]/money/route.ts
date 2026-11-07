import { NextResponse } from 'next/server';
import { requirePlatformPower, hasPlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { getStripe } from '@/lib/stripe';
import { isDemoOrgId } from '@/lib/demo-org-server';
import { staffBelongsToClub } from '@/lib/staff-own-club';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { readClubMoney } from '@/lib/console-money-stripe';
import { yearBefore } from '@/lib/console-money';
import { clubStripeFacts, priceMap, refundStore } from '@/lib/console-money-store';
import { readSaleRecords, registrationDateOrNull, withSalesFor } from '@/lib/console-money-sales-store';

/**
 * The Money tab's read (Support console Stage 3, owner Q4 A; drawing A): Stripe, live, for this club's customer — only for
 * a role with the Stripe-reading power (A2). A role without it is refused here BEFORE any Stripe call; its screen never
 * calls. Nothing Stripe returns is stored, and the answer is never cached. The club is the address's `[id]`.
 * `?before=<iso>` reads the twelve months before it ("Show older sales").
 * GST/HST Stage 3 Part 2: also OUR kept tax records of this customer's sales (read, never written), in every state, and the
 * GST/HST registration date. Our records are not Stripe's, but they carry a buyer's address and what it paid, so they follow
 * the same power (Ask 7 = A).
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
  const live = stripeKeyIsLive();
  // GST/HST Stage 3 Part 2 (Ask 2 = A): our kept tax records are read beside Stripe, in every state, so the sales stay when Stripe
  // cannot be read. The window is the same twelve months (before `before`, for "Show older sales"). The registration date (the
  // Stage 4a setting) is read once, with the first page.
  const until = before ? Date.parse(before) : readAt.getTime();
  const since = yearBefore(until);
  const [stripeRead, recordsRead, registrationDate] = await Promise.all([
    // Built inside the promise: a missing Stripe key must read as "unreachable" (our records still answer), not as a 500.
    Promise.resolve().then(() => readClubMoney(getStripe(), club.customerId!, { prices, testMode: !live, now: readAt, before }))
      .then(r => ({ ok: true as const, read: r }), (err: unknown) => ({ ok: false as const, err })),
    readSaleRecords(club.customerId, live, { since, before }),
    before ? Promise.resolve(undefined) : registrationDateOrNull(),
  ]);
  if (!stripeRead.ok) {
    const err = stripeRead.err as { code?: string; type?: string };
    console.warn('[platform-admin] money read failed:', err.code ?? err.type ?? 'error');
    return NextResponse.json({ state: 'unreachable', readAt: readAt.toISOString(), records: recordsRead, registrationDate }, { headers: noStore }); // utc-intentional
  }
  const read = stripeRead.read;
  const records = await withSalesFor(recordsRead, club.customerId, live,
    read.charges.map(c => c.invoice?.id).filter((x): x is string => !!x));

  // "Show older sales" keeps only the charges and the records: nothing else is worked out for it.
  if (before) return NextResponse.json({ state: 'read', read, portalSubscriptionIds: club.portalSubscriptionIds, refundGate: null, records }, { headers: noStore });

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
    coversOtherPortals: club.coversOtherPortals,
    refundGate,
    records,
    registrationDate,
  }, { headers: noStore });
}, { route: '/api/platform-admin/orgs/[id]/money' });
