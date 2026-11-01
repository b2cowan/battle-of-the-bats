import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { landCheckoutSession } from '@/lib/online-payment-landing';
import { openSignupLink } from '@/lib/league-signup-link';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** How long the page waits on the webhook before asking Stripe itself. */
const ASK_STRIPE_AFTER_MS = 8_000;

/**
 * "Confirming your payment" on a family's status page polls here (Club Tier Stage 12b; the team status route's rule).
 * The answer is the RECORD, never the redirect: the payment is paid when it has landed. If the webhook is late, after a
 * few seconds this asks Stripe's own API about the session and lands it the same way the webhook would — idempotent, so
 * the two never double up. A session that belongs to another sign-up is unknown here.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  if (!onlinePaymentsOn()) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  const sessionId = new URL(req.url).searchParams.get('session');
  if (!sessionId) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  // Stage 1: the one door, past the season's clock — a family who paid the last dollar still sees it confirmed.
  const [link, { data: op }] = await Promise.all([
    openSignupLink(token, { afterCheckout: true }),
    supabaseAdmin.from('online_payments')
      .select('id, flow, season_id, signup_key, status, landed_at, stripe_account_id, updated_at')
      .eq('stripe_checkout_session_id', sessionId).maybeSingle(),
  ]);
  if (!link.ok || !op || op.flow !== 'league_signup' || op.season_id !== link.seasonId || op.signup_key !== link.signupKey) {
    return NextResponse.json({ state: 'unknown' }, { status: 404 });
  }
  // 12c: a bank debit clearing (or returned) reloads the page too, which then says so.
  if (['paid', 'partly_refunded', 'refunded', 'clearing', 'returned', 'reversed'].includes(op.status as string)) return NextResponse.json({ state: 'paid' });
  if (op.status === 'expired') return NextResponse.json({ state: 'not_finished' });
  if (Date.now() - Date.parse(op.updated_at as string) > ASK_STRIPE_AFTER_MS) {
    const result = await landCheckoutSession(op.stripe_account_id as string, sessionId).catch(() => 'unknown' as const);
    if (result === 'landed' || result === 'already' || result === 'not_recorded' || result === 'clearing' || result === 'returned') return NextResponse.json({ state: 'paid' });
  }
  return NextResponse.json({ state: 'confirming' });
}, { route: '/api/pay/league/[token]/status' });
