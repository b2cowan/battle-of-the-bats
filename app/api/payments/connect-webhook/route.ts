import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureError } from '@/lib/observability';
import { connectWebhookSecret, constructConnectEvent } from '@/lib/stripe-connect';
import { applyRefundEvent, expireCheckoutSession, landCheckoutSession, returnDebit } from '@/lib/online-payment-landing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * THE CONNECT PAYMENTS WEBHOOK (Club Tier Stage 12a) — v1 snapshot events on clubs' own connected accounts (checkout and
 * refunds), with its own signing secret (`STRIPE_CONNECT_WEBHOOK_SECRET`), never the billing webhook's. It is the source
 * of truth for "Paid": the receipt page never shows Paid on the redirect alone. The ACCOUNT's own changes arrive as v2
 * thin events on the account webhook (`/api/payments/connect-account-events`, plan §0d), not here.
 *
 * ⚠ Deliberately NOT behind the launch switch (`tests/unit/online-payments-guard.test.ts` names it the one exception):
 * money Stripe already took must land, and a refund already asked for must record, even if the switch goes off between.
 * Passes `proxy.ts` without a session (every `/api/*` outside `/api/admin` does).
 *
 * Each event is logged once (`stripe_connect_events`); a redelivery of a processed event is acknowledged and skipped.
 * Correctness does not rest on the log: every landing function is idempotent under its own row locks.
 */
export const POST = withObservability(async (req: Request) => {
  const secret = connectWebhookSecret();
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = constructConnectEvent(rawBody, sig, secret);
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }
  const account = event.account ?? null;
  if (!account) return NextResponse.json({ received: true }); // not a connected-account event

  // A test event must never touch a live account's records, nor a live event a test environment's.
  const liveKey = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_');
  if (event.livemode !== liveKey) return NextResponse.json({ received: true });

  const { data: seen } = await supabaseAdmin.from('stripe_connect_events').select('processed_at, attempts').eq('id', event.id).maybeSingle();
  if (seen?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  if (seen) await supabaseAdmin.from('stripe_connect_events').update({ attempts: (seen.attempts as number) + 1 }).eq('id', event.id);
  else await supabaseAdmin.from('stripe_connect_events').insert({ id: event.id, type: event.type, account, livemode: event.livemode });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        // A card lands here (paid). 12c: a bank debit's "completed" arrives unpaid and records it clearing; its
        // async_payment_succeeded lands it. The landing re-reads the session itself, so either order is one result.
        await landCheckoutSession(account, (event.data.object as Stripe.Checkout.Session).id);
        break;
      }
      case 'checkout.session.async_payment_failed': {
        // 12c: the bank returned a debit before it settled: nothing taken, the family told.
        await returnDebit(account, (event.data.object as Stripe.Checkout.Session).id);
        break;
      }
      case 'checkout.session.expired': {
        await expireCheckoutSession((event.data.object as Stripe.Checkout.Session).id);
        break;
      }
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        await applyRefundEvent(account, event.data.object as Stripe.Refund);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    await supabaseAdmin.from('stripe_connect_events').update({ error: err instanceof Error ? err.message.slice(0, 500) : 'failed' }).eq('id', event.id);
    await captureError(err, { route: '/api/payments/connect-webhook', method: 'POST' });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }); // Stripe retries
  }
  await supabaseAdmin.from('stripe_connect_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', event.id);
  return NextResponse.json({ received: true });
}, { route: '/api/payments/connect-webhook' });
