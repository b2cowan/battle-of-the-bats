/**
 * POST /api/notifications/push/test
 *
 * Sends a test Web Push to ONE of the authenticated user's registered devices
 * and reports back the real outcome — so the user (and support) can tell whether
 * the failure is "server not configured", "VAPID key mismatch", "subscription
 * expired", or genuine delivery. Turns the previously-silent push failure
 * (notify() only console.error'd) into an actionable, self-serve diagnosis.
 *
 * Body:
 *   { subscriptionId: string }   — id from GET /api/notifications/push/devices
 *
 * Returns 200 with:
 *   { status, message }
 *     status: 'delivered' | 'not_configured' | 'mismatch' | 'gone' | 'error'
 * (Non-200 only for auth / bad-input; delivery outcomes are 200 so the client
 *  can render the specific message without treating them as request failures.)
 */

import { NextResponse }         from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin }        from '@/lib/supabase-admin';
import { withObservability }    from '@/lib/observability';
import { sendWebPush, isPushConfigured } from '@/lib/web-push';

type TestStatus = 'delivered' | 'not_configured' | 'mismatch' | 'gone' | 'error';

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { subscriptionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const subscriptionId = body.subscriptionId;
  if (!subscriptionId) {
    return NextResponse.json({ error: 'Missing subscriptionId.' }, { status: 400 });
  }

  // Fetch the target subscription — scoped to this user so nobody can test
  // another account's device.
  const { data: sub } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('id', subscriptionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: 'Device not found.' }, { status: 404 });
  }

  const respond = (status: TestStatus, message: string) =>
    NextResponse.json({ status, message });

  // Server not configured → sendWebPush would silently no-op. Say so plainly.
  if (!isPushConfigured()) {
    return respond(
      'not_configured',
      'Push isn’t configured on the server yet (the VAPID keys are missing at runtime). No notification was sent.',
    );
  }

  try {
    await sendWebPush(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
      {
        title: 'FieldLogicHQ — test notification',
        body:  'If you can see this, push notifications are working on this device. 🎉',
        link:  '/',
      },
    );

    await supabaseAdmin
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', sub.id);

    return respond(
      'delivered',
      'Test notification sent. It should appear on that device within a few seconds — if it doesn’t, check the device’s own notification settings for FieldLogicHQ.',
    );
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;

    // 404/410 → the push service dropped this subscription. Remove it so the
    // user re-registers cleanly.
    if (statusCode === 404 || statusCode === 410) {
      await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
      return respond(
        'gone',
        'This device’s subscription has expired, so it was removed. Turn notifications off and on again on that device to re-register.',
      );
    }

    // 400/401/403 → the push service rejected the request, almost always a VAPID
    // key mismatch between the server and the key this device subscribed with.
    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      return respond(
        'mismatch',
        `The push service rejected the request (HTTP ${statusCode}). This usually means the server’s VAPID keys don’t match the key this device registered with — re-check the VAPID keys, then remove and re-add this device.`,
      );
    }

    return respond(
      'error',
      `Push send failed${statusCode ? ` (HTTP ${statusCode})` : ''}. Please try again; if it keeps failing, this is logged for review.`,
    );
  }
}, { route: '/api/notifications/push/test' });
