import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { writeOrReport } from './observability/report-unwritten';

/**
 * THE STRIPE CONNECT EVENT LOG (`stripe_connect_events`, migration 358) — its one writer, for both Connect webhooks
 * (`/api/payments/connect-webhook`, `/api/payments/connect-account-events`).
 *
 * Every write reads its answer, and a failed one opens an issue (leftover call 18 (c), owner 2026-11-19) — never the row,
 * only the action, the club where known, and a database code. Before call 18 neither webhook read any of these answers.
 *
 * ⚖ A FAILED LOG LINE NEVER CHANGES THE ANSWER TO STRIPE — the first line included. The log is a short-circuit for
 * repeat deliveries and an audit trail, NOT what makes handling correct: two concurrent deliveries can already both run,
 * and every landing function is idempotent under its own row locks (DATA_DICTIONARY). Failing the event so Stripe
 * retries would buy nothing a redelivery doesn't already handle, and in a database outage it would turn one missing
 * line into a retry storm against the same broken database. The first line is written ON CONFLICT DO NOTHING, so a
 * concurrent delivery of the same event writing it at the same moment is not a failure: the line exists.
 */

// The table is spelled out in every write: the one-writer census (org-audit-failure-reported.test.ts) greps for it.
const RECORD = 'stripe_connect_events';

/** 'processed' when an earlier delivery finished this event (acknowledge and skip); otherwise the line is opened. */
export async function openConnectEvent(event: { id: string; type: string; livemode: boolean }, account: string): Promise<'processed' | 'open'> {
  const { data: seen } = await supabaseAdmin.from('stripe_connect_events').select('processed_at, attempts').eq('id', event.id).maybeSingle();
  if (seen?.processed_at) return 'processed';
  if (seen) {
    await writeOrReport(RECORD, 'event_attempt', null, () => supabaseAdmin.from('stripe_connect_events').update({ attempts: (seen.attempts as number) + 1 }).eq('id', event.id));
  } else {
    await writeOrReport(RECORD, 'event_open', null, () => supabaseAdmin.from('stripe_connect_events')
      .upsert({ id: event.id, type: event.type, account, livemode: event.livemode }, { onConflict: 'id', ignoreDuplicates: true }));
  }
  return 'open';
}

/** The event was handled: stamped processed, its last error cleared. */
export async function markConnectEventProcessed(eventId: string): Promise<void> {
  await writeOrReport(RECORD, 'event_processed', null, () => supabaseAdmin.from('stripe_connect_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', eventId));
}

/** Handling failed: the cause stamped on the line (Platform admin › Online payments reads it). */
export async function markConnectEventFailed(eventId: string, err: unknown): Promise<void> {
  const error = err instanceof Error ? err.message.slice(0, 500) : 'failed';
  await writeOrReport(RECORD, 'event_failed', null, () => supabaseAdmin.from('stripe_connect_events').update({ error }).eq('id', eventId));
}

/** The club the event's account belongs to, once it is known. */
export async function stampConnectEventOrg(eventId: string, orgId: string): Promise<void> {
  await writeOrReport(RECORD, 'event_org', orgId, () => supabaseAdmin.from('stripe_connect_events').update({ org_id: orgId }).eq('id', eventId));
}
