import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { logDatabaseRef } from '@/lib/email-log';
import { EVENT_ID, MAX_CALLBACK_BYTES, parseCallback, verifyCallback } from '@/lib/resend-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * THE MAIL SERVICE'S DELIVERY CALLBACK (Support console Stage 5, owner Q7 2026-10-26; drawing F). Resend calls it when
 * it learns what happened to an email: sent, delayed, delivered, bounced, marked as spam, failed, not sent (suppressed).
 * Opens and clicks are never subscribed.
 *
 * ⚠ A PUBLIC ADDRESS ON PURPOSE (threat T25), like Stripe's: it passes `proxy.ts` without a session (every `/api/*`
 * outside `/api/admin` does) and its signature is its only gate (tests/unit/public-api-routes-guard.test.ts lists it).
 *
 * Order, and why:
 *   1. No secret on this site → 503 "not ready"; Resend retries for about a day, so nothing is lost while a release
 *      sets it.
 *   2. Oversize, missing headers, a bad or old signature → refused before the body is parsed; nothing written (T8).
 *   3. A call about no row of THIS database (another site's, a family or campaign email, an untracked event) →
 *      accepted, nothing kept, not even its number (T11).
 *   4. One database step (platform_account_email_event): the timeline gains the event and the row moves forward only;
 *      a number seen before changes nothing (T9, T10). A database failure answers 500 so Resend tries again.
 * Nothing from a callback is written to the server log (T12): every answer is a fixed word.
 */
export const POST = withObservability(async (req: Request) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'Not ready' }, { status: 503 });

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_CALLBACK_BYTES) return refused(413);
  const rawBody = await readCapped(req, MAX_CALLBACK_BYTES);
  if (rawBody === null) return refused(413);

  const headers = {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  };
  if (!verifyCallback(headers, rawBody, secret)) return refused(401);
  if (!headers.id || !EVENT_ID.test(headers.id)) return refused(400);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return refused(400);
  }
  const event = parseCallback(body, logDatabaseRef());
  if (!event) return NextResponse.json({ received: true });

  const { error } = await supabaseAdmin.rpc('platform_account_email_event', {
    p_email_id: event.rowId,
    p_event_id: headers.id,
    p_state: event.state,
    p_at: event.at,
    p_reason: event.reason,
  });
  if (error) return NextResponse.json({ error: 'Try again' }, { status: 500 });
  return NextResponse.json({ received: true });
}, { route: '/api/webhooks/resend' });

function refused(status: number) {
  return NextResponse.json({ error: 'Refused' }, { status });
}

/** The body as text, or null past `limit` bytes (read no further than the limit, whatever the header claimed). */
async function readCapped(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
