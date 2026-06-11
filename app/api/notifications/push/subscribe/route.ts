/**
 * POST /api/notifications/push/subscribe
 *
 * Upserts a Web Push subscription for the authenticated user.
 * Called by PushPermissionPrompt after a successful pushManager.subscribe().
 *
 * Body:
 *   {
 *     endpoint:    string   — PushSubscription.endpoint
 *     keys: {
 *       p256dh:    string   — base64url-encoded P-256 public key
 *       auth:      string   — base64url-encoded auth secret
 *     }
 *     deviceLabel: string   — human-readable device label from navigator.userAgent
 *   }
 */

import { NextResponse }         from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin }        from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    endpoint:    string;
    keys:        { p256dh: string; auth: string };
    deviceLabel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { endpoint, keys, deviceLabel } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: 'Missing required fields: endpoint, keys.p256dh, keys.auth' },
      { status: 400 }
    );
  }

  // Upsert by endpoint (unique key) — update last_used_at on conflict so
  // re-registering the same device refreshes its timestamp.
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      {
        user_id:      user.id,
        endpoint,
        keys_p256dh:  keys.p256dh,
        keys_auth:    keys.auth,
        device_label: deviceLabel ?? null,
        last_used_at: new Date().toISOString(),
      },
      {
        onConflict:        'endpoint',
        ignoreDuplicates:  false,
      }
    );

  if (error) {
    console.error('[push/subscribe] Upsert failed:', error.message);
    return NextResponse.json({ error: 'Failed to save subscription.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, { route: '/api/notifications/push/subscribe' });
