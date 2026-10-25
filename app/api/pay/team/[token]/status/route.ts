import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { onlinePaymentsOn } from '@/lib/online-payments-switch';
import { landCheckoutSession } from '@/lib/online-payment-landing';
import { teamFromPayToken } from '@/lib/team-pay-view';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** How long the page waits on the webhook before asking Stripe itself. */
const ASK_STRIPE_AFTER_MS = 8_000;

/**
 * "Confirming your payment" polls here (Club Tier Stage 12a). The answer is the RECORD, never the redirect: the payment
 * is paid when it has landed. If the webhook is late, after a few seconds this asks Stripe's own API about the session
 * (not the browser's word) and lands it the same way the webhook would — idempotent, so the two never double up.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  if (!onlinePaymentsOn()) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  const teamId = teamFromPayToken(token);
  const sessionId = new URL(req.url).searchParams.get('session');
  if (!teamId || !sessionId) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  const { data: op } = await supabaseAdmin.from('online_payments')
    .select('id, team_id, status, landed_at, land_error, stripe_account_id, created_at, updated_at')
    .eq('stripe_checkout_session_id', sessionId).maybeSingle();
  if (!op || op.team_id !== teamId) return NextResponse.json({ state: 'unknown' }, { status: 404 });
  if (op.status === 'paid' || op.status === 'refunded') return NextResponse.json({ state: 'paid' });
  if (op.status === 'expired') return NextResponse.json({ state: 'not_finished' });
  if (Date.now() - Date.parse(op.updated_at as string) > ASK_STRIPE_AFTER_MS) {
    const result = await landCheckoutSession(op.stripe_account_id as string, sessionId).catch(() => 'unknown' as const);
    if (result === 'landed' || result === 'already' || result === 'not_recorded') return NextResponse.json({ state: 'paid' });
  }
  return NextResponse.json({ state: 'confirming' });
}, { route: '/api/pay/team/[token]/status' });
