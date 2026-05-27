/**
 * DELETE /api/notifications/push/unsubscribe
 *
 * Removes a Web Push subscription by endpoint.
 * Called when the user turns off all Push toggles or explicitly revokes permission.
 *
 * Body:
 *   { endpoint: string }
 */

import { NextResponse }         from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin }        from '@/lib/supabase-admin';

export async function DELETE(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { endpoint: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json({ error: 'Missing required field: endpoint' }, { status: 400 });
  }

  // Only delete rows that belong to this user — prevent one user from
  // removing another user's subscription via a guessed endpoint URL.
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[push/unsubscribe] Delete failed:', error.message);
    return NextResponse.json({ error: 'Failed to remove subscription.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
