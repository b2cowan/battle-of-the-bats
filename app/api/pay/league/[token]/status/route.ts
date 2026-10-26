import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { landCheckoutSession } from '@/lib/online-payment-landing';
import { registrationFromPayToken } from '@/lib/league-pay-link';

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
  const regId = registrationFromPayToken(token);
  const sessionId = new URL(req.url).searchParams.get('session');
  if (!regId || !sessionId) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  const [{ data: reg }, { data: op }] = await Promise.all([
    supabaseAdmin.from('league_registrations').select('id, season_id, signup_ref').eq('id', regId).maybeSingle(),
    supabaseAdmin.from('online_payments')
      .select('id, flow, season_id, signup_key, status, landed_at, stripe_account_id, updated_at')
      .eq('stripe_checkout_session_id', sessionId).maybeSingle(),
  ]);
  const signupKey = reg ? ((reg.signup_ref as string | null) ?? (reg.id as string)) : null;
  if (!reg || !op || op.flow !== 'league_signup' || op.season_id !== reg.season_id || op.signup_key !== signupKey) {
    return NextResponse.json({ state: 'unknown' }, { status: 404 });
  }
  if (op.status === 'paid' || op.status === 'partly_refunded' || op.status === 'refunded') return NextResponse.json({ state: 'paid' });
  if (op.status === 'expired') return NextResponse.json({ state: 'not_finished' });
  if (Date.now() - Date.parse(op.updated_at as string) > ASK_STRIPE_AFTER_MS) {
    const result = await landCheckoutSession(op.stripe_account_id as string, sessionId).catch(() => 'unknown' as const);
    if (result === 'landed' || result === 'already' || result === 'not_recorded') return NextResponse.json({ state: 'paid' });
  }
  return NextResponse.json({ state: 'confirming' });
}, { route: '/api/pay/league/[token]/status' });
