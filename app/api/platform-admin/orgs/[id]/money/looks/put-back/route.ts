import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { writePlatformAuditLog } from '@/lib/platform-audit';
import { stripeKeyIsLive } from '@/lib/online-payments-switch';
import { clubStripeFacts } from '@/lib/console-money-store';
import { putSaleBack, registrationDateOrNull } from '@/lib/console-money-sales-store';
import { NEEDS_LOOK_WORDS } from '@/lib/console-money-sales';
import { forgetSalesTaxWaiting } from '@/lib/console-money-sales-tax-wait';
import { isUuid } from '@/lib/utils';

/**
 * "Put it back on the list" (GST/HST Stage 3 Part 3b): undoes a mark with a NEW row naming the old one, and its own why. Only the
 * newest mark of a sale can be put back, and only the one the screen showed (`lookId`): any other is refused (409). Same power
 * and same club gate as marking.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const noStore = { 'Cache-Control': 'no-store' };

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requirePlatformPower('refund');
  if (auth.response) return auth.response;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { invoiceId?: unknown; lookId?: unknown; why?: unknown };
  const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId : '';
  const lookId = typeof body.lookId === 'string' ? body.lookId : '';
  if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) return NextResponse.json({ error: NEEDS_LOOK_WORDS.mark.refusals.noSale }, { status: 404, headers: noStore });
  if (!isUuid(lookId)) return NextResponse.json({ error: NEEDS_LOOK_WORDS.mark.refusals.cannotPutBack }, { status: 409, headers: noStore });

  const [club, registration] = await Promise.all([clubStripeFacts(id), registrationDateOrNull()]);
  if (!club?.customerId || club.customerShared) return NextResponse.json({ error: NEEDS_LOOK_WORDS.mark.refusals.noSale }, { status: 404, headers: noStore });

  const actorEmail = auth.user.email ?? '';
  const result = await putSaleBack({ customerId: club.customerId, live: stripeKeyIsLive(), invoiceId, lookId, why: body.why, actorEmail, orgId: id }, registration);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: noStore });
  await writePlatformAuditLog(actorEmail, id, 'sale_look_put_back', 'sale', { invoice: invoiceId, look: lookId }, null, { reason: String(body.why).trim() });
  forgetSalesTaxWaiting();
  return NextResponse.json({ ok: true }, { headers: noStore });
}, { route: '/api/platform-admin/orgs/[id]/money/looks/put-back' });
