/**
 * GET /api/notifications/push/devices
 *
 * Lists the Web Push devices registered for the authenticated user, so the
 * notification settings screen can show a "your devices" list and let the user
 * fire a test push at a specific one (see /api/notifications/push/test).
 *
 * Returns:
 *   { devices: [{ id, endpoint, deviceLabel, lastUsedAt, createdAt }] }
 *
 * The endpoint is returned so the client can flag which row is "this device"
 * (by matching against its own PushSubscription.endpoint). It's the user's own
 * subscription data, scoped to their user id — never another user's.
 */

import { NextResponse }         from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin }        from '@/lib/supabase-admin';
import { withObservability }    from '@/lib/observability';

export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, device_label, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to load devices.' }, { status: 500 });
  }

  const devices = (data ?? []).map(row => ({
    id:          row.id,
    endpoint:    row.endpoint,
    deviceLabel: row.device_label,
    lastUsedAt:  row.last_used_at,
    createdAt:   row.created_at,
  }));

  return NextResponse.json({ devices });
}, { route: '/api/notifications/push/devices' });
