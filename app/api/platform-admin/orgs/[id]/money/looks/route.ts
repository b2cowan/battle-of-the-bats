import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { clubStripeFacts } from '@/lib/console-money-store';
import { markSaleLooked, registrationDateOrNull } from '@/lib/console-money-sales-store';
import { NEEDS_LOOK_WORDS } from '@/lib/console-money-sales';
import { forgetSalesTaxWaiting } from '@/lib/console-money-sales-tax-wait';

/**
 * "Mark as looked at" (GST/HST Stage 3 Part 3b; owner Ask 6): a sale that needs a look is marked, with a required why. The power
 * is the refund power (Super admin, Billing); Support reads the list but never reaches this. The mark is kept BESIDE the tax
 * record (migration 452) and changes nothing in it. The reasons it is made for are the SERVER's, read now, never the browser's;
 * a sale that needs no look or is already marked is refused (409). The audit entry names the sale and the keys, with the why.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('refund');
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { invoiceId?: unknown; why?: unknown };
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) return NextResponse.json({ error: NEEDS_LOOK_WORDS.mark.refusals.noSale }, { status: 404, headers: noStore });

  const [club, registration] = await Promise.all([clubStripeFacts(id), registrationDateOrNull()]);
  // The same gate as the Money route: this club's own, unshared customer.
  if (!club?.customerId || club.customerShared) return NextResponse.json({ error: NEEDS_LOOK_WORDS.mark.refusals.noSale }, { status: 404, headers: noStore });

  const actorEmail = auth.user.email ?? '';
  const result = await markSaleLooked({ customerId: club.customerId, live: stripeKeyIsLive(), invoiceId, why: body.why, actorEmail, orgId: id }, registration);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  await writePlatformAuditLog(actorEmail, id, 'sale_look_mark', 'sale', null, { invoice: invoiceId, keys: result.keys }, { reason: String(body.why).trim() });
  forgetSalesTaxWaiting();
  return NextResponse.json({ ok: true }, { headers: noStore });
}, { route: '/api/platform-admin/orgs/[id]/money/looks' });
