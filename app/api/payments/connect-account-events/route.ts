import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability, captureError } from '@/lib/observability';
import { connectAccountWebhookSecret, parseAccountEvent } from '@/lib/stripe-connect';
import { syncPayoutsAccount } from '@/lib/online-payment-landing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * THE ACCOUNT WEBHOOK (Club Tier Stage 12a, Accounts v2 — plan §0d). Stripe's v2 accounts announce their changes as THIN
 * events on an event destination scoped to FieldLogicHQ's own account, signed with their own secret
 * (`STRIPE_CONNECT_ACCOUNT_WEBHOOK_SECRET`). A thin event names the account and nothing else, so every one is answered the
 * same way: re-read the account from Stripe and store it (`syncPayoutsAccount`), which also raises or clears "Stripe needs
 * something". Payments and refunds stay on the snapshot Connect webhook (`/api/payments/connect-webhook`).
 *
 * Why two webhooks and not one thin one (probe 2026-10-25, `.probe/s12v2-shape.cjs`): Stripe accepts a single thin
 * destination carrying both, but the pinned SDK types thin events only for v2 accounts — moving checkout and refunds to
 * thin would rewrite the reviewed money path around hand-parsed events and an extra Stripe read per payment, for one
 * fewer secret.
 *
 * ⚠ Like the payments webhook, deliberately NOT behind the launch switch (`tests/unit/online-payments-guard.test.ts`):
 * an account Stripe closed must stop taking payments even if the switch is off. Passes `proxy.ts` without a session.
 *
 * Each event is logged once (`stripe_connect_events`); a redelivery of a processed event is acknowledged and skipped.
 */
const ACCOUNT_EVENTS = new Set([
  'v2.core.account[requirements].updated',
  'v2.core.account[configuration.merchant].capability_status_updated',
  'v2.core.account.closed',
]);

export const POST = withObservability(async (req: Request) => {
  const secret = connectAccountWebhookSecret();
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 });
  let event: Stripe.V2.Core.EventNotification;
  try {
    event = parseAccountEvent(rawBody, sig, secret);
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }
  if (!ACCOUNT_EVENTS.has(event.type)) return NextResponse.json({ received: true });
  const account = 'related_object' in event ? event.related_object?.id ?? null : null;
  if (!account) return NextResponse.json({ received: true });

  // A test event must never touch a live account's records, nor a live event a test environment's.
  const liveKey = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_');
  if (event.livemode !== liveKey) return NextResponse.json({ received: true });

  const { data: seen } = await supabaseAdmin.from('stripe_connect_events').select('processed_at, attempts').eq('id', event.id).maybeSingle();
  if (seen?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  if (seen) await supabaseAdmin.from('stripe_connect_events').update({ attempts: (seen.attempts as number) + 1 }).eq('id', event.id);
  else await supabaseAdmin.from('stripe_connect_events').insert({ id: event.id, type: event.type, account, livemode: event.livemode });

  try {
    let row;
    if (event.type === 'v2.core.account.closed') {
      // Closed in Stripe: it takes no more payments, exactly as a Disconnect (A1). The re-read confirms it and stamps the
      // disconnect itself; a closed account may no longer read in full, so if the re-read fails the signed event alone
      // stamps it, and the event is not retried.
      row = await syncPayoutsAccount(account).catch(() => null);
      if (!row) {
        const now = new Date().toISOString();
        const { error } = await supabaseAdmin.from('org_payment_accounts').update({ disconnected_at: now, updated_at: now })
          .eq('stripe_account_id', account).is('disconnected_at', null);
        if (error) throw error;
      }
      // 12d-2 (Part 5): the club's Story says Stripe closed it — once, though Stripe may send the event again.
      const { data: acct } = await supabaseAdmin.from('org_payment_accounts').select('org_id').eq('stripe_account_id', account).maybeSingle();
      if (acct?.org_id) {
        const { count, error: countError } = await supabaseAdmin.from('org_audit_log').select('id', { count: 'exact', head: true })
          .eq('org_id', acct.org_id).eq('action', 'payouts_closed_by_stripe').contains('payload', { stripeAccountId: account });
        if (countError) throw countError;
        if (!count) await supabaseAdmin.from('org_audit_log').insert({ org_id: acct.org_id, actor_id: null, action: 'payouts_closed_by_stripe', payload: { stripeAccountId: account } });
      }
    } else {
      row = await syncPayoutsAccount(account);
    }
    if (row) await supabaseAdmin.from('stripe_connect_events').update({ org_id: row.org_id }).eq('id', event.id);
  } catch (err) {
    await supabaseAdmin.from('stripe_connect_events').update({ error: err instanceof Error ? err.message.slice(0, 500) : 'failed' }).eq('id', event.id);
    await captureError(err, { route: '/api/payments/connect-account-events', method: 'POST' });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 }); // Stripe retries
  }
  await supabaseAdmin.from('stripe_connect_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', event.id);
  return NextResponse.json({ received: true });
}, { route: '/api/payments/connect-account-events' });
