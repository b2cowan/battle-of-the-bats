/**
 * POST /api/consumer/notification-pause
 *
 * Toggle the signed-in user's account-level "Pause notifications" master switch
 * (Notification Settings). Recipient-side + non-destructive: while paused, everything
 * is silenced except the protected floor (payment_failed, chat_mention) — see
 * lib/notification-pause.ts. Body: { paused: boolean }. Anonymous → 401.
 *
 * No GET: the settings page server-renders the initial paused state, so the client only
 * ever needs to WRITE from here.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { setNotificationsPaused } from '@/lib/notification-pause';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: { paused?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'Missing "paused" boolean.' }, { status: 400 });
  }

  const paused = await setNotificationsPaused(user.id, body.paused);
  return NextResponse.json({ paused });
}, { route: '/api/consumer/notification-pause' });
