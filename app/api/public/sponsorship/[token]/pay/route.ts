import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { landCheckoutSession } from '@/lib/online-payment-landing';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { dealForLink } from '@/lib/sponsor-link-route';
import { dealFromLinkToken } from '@/lib/sponsor-deal-view';
import { invoiceStanding } from '@/lib/club-sponsor-invoice';
import { readDealBusiness, readDealPayments } from '@/lib/club-sponsorship-deals-server';
import { openSponsorCheckout, sponsorCardFacts, sponsorFeeFor } from '@/lib/sponsor-card-server';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const C = DEAL_WORDS.card;
/** How long the page waits on the webhook before asking Stripe itself (the league status route's rule). */
const ASK_STRIPE_AFTER_MS = 8_000;

/**
 * POST /api/public/sponsorship/[token]/pay — an INVOICED deal's link pays what is owing by card (Board Ready Stage 6 Part 3b;
 * owner call (3), 2026-11-23: "Their link still lets them pay by card", at the invoice total, the club paying the fee — an
 * issued invoice never gains a fee line). No sign-in: the link is the key, throttled. Body: { expectedTotal } (the button's
 * figure). Answers { url } (the card page), or 409 with the words while the club doesn't take card / nothing is owing /
 * the figure moved.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  if (!onlinePaymentsOn()) return NextResponse.json({ error: C.errOff }, { status: 404 });
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const { token } = await params;
  const at = await dealForLink(token);
  if ('failure' in at) return at.failure;
  const { org, deal } = at;
  if (deal.state !== 'invoiced' || !deal.invoice) return NextResponse.json({ error: DEAL_WORDS.page.errClosed, changed: true }, { status: 409 });
  const facts = await sponsorCardFacts(org.id);
  if (!facts) return NextResponse.json({ error: C.errOff, changed: true }, { status: 409 });
  const body = await req.json().catch(() => ({})) as { expectedTotal?: unknown };
  // What is owing is read here, from the payments recorded, never trusted from the page.
  const owingNow = invoiceStanding(deal.invoice.total, await readDealPayments(org.id, deal.id)).owing;
  if (owingNow <= 0) return NextResponse.json({ error: DEAL_WORDS.page.errClosed, changed: true }, { status: 409 });
  const fee = sponsorFeeFor(owingNow, facts, null, true);
  if (typeof body.expectedTotal !== 'number' || Math.round(body.expectedTotal * 100) !== fee.totalCents) {
    return NextResponse.json({ error: DEAL_WORDS.page.errPriceChanged, changed: true }, { status: 409 });
  }
  const business = await readDealBusiness(org.id, deal.id);
  const opened = await openSponsorCheckout({
    origin: resolveTrustedAppOrigin(req), orgId: org.id, orgSlug: org.slug, token, dealId: deal.id, facts, fee, plan: null,
    taxKind: deal.invoice.taxKind, lineName: `Invoice ${deal.invoice.number} · ${DEAL_WORDS.email.title(deal.packageName, deal.placeKind === 'club' ? null : deal.targetName)}`,
    email: business?.email ?? null,
  });
  if (!opened.ok) return NextResponse.json({ error: opened.error, ...(opened.code === 'paid' ? { changed: true } : {}) }, { status: opened.status });
  return NextResponse.json({ url: opened.url });
}, { route: '/api/public/sponsorship/[token]/pay' });

/**
 * GET /api/public/sponsorship/[token]/pay?session= — "Confirming your payment" polls here (the league status route's rule):
 * the answer is the RECORD, never the redirect. After a few seconds without the webhook it asks Stripe and lands the session
 * the same way (idempotent). A session that isn't this deal's is unknown.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  if (!onlinePaymentsOn()) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  const { token } = await params;
  const sessionId = new URL(req.url).searchParams.get('session');
  if (!sessionId) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  // Polled every two seconds: only the door's deal id is needed to know the session is this deal's, not the whole deal.
  const [door, { data: op }] = await Promise.all([
    dealFromLinkToken(token),
    supabaseAdmin.from('online_payments').select('id, flow, sponsor_deal_id, status, landed_at, stripe_account_id, updated_at')
      .eq('stripe_checkout_session_id', sessionId).maybeSingle(),
  ]);
  if (door?.kind !== 'open' || !op || op.flow !== 'sponsorship' || op.sponsor_deal_id !== door.dealId) {
    return NextResponse.json({ state: 'unknown' }, { status: 404 });
  }
  // "Paid" is the record on the deal, not Stripe's word: a payment marked paid that never landed (an old server, a deal that
  // changed) is landed again here, and the page then reloads to what the record says — the deal paid, or "We've received your
  // payment" (owner walk 2026-11-24: it used to answer "paid" at once and the business saw the plain form again).
  if (['partly_refunded', 'refunded'].includes(op.status as string) || (op.status === 'paid' && op.landed_at)) return NextResponse.json({ state: 'paid' });
  if (op.status === 'paid') {
    // Stripe has the money. Landing is tried once more; whatever it answers (even a failure), the page reloads to what the
    // record says — the deal paid, or "We've received your payment" — never an endless "Confirming" that asks Stripe every 2 seconds.
    await landCheckoutSession(op.stripe_account_id as string, sessionId).catch(() => undefined);
    return NextResponse.json({ state: 'paid' });
  }
  if (op.status === 'expired') return NextResponse.json({ state: 'not_finished' });
  if (Date.now() - Date.parse(op.updated_at as string) > ASK_STRIPE_AFTER_MS) {
    const result = await landCheckoutSession(op.stripe_account_id as string, sessionId).catch(() => 'unknown' as const);
    if (result === 'landed' || result === 'already' || result === 'not_recorded') return NextResponse.json({ state: 'paid' });
  }
  return NextResponse.json({ state: 'confirming' });
}, { route: '/api/public/sponsorship/[token]/pay' });
