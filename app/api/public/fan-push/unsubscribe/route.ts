/**
 * POST /api/public/fan-push/unsubscribe
 *
 * LEGACY-ONLY as of Slice 3 (Business Decisions Log 2026-07-14): the anonymous
 * opt-in path is retired (sibling /subscribe returns 410) and no UI calls this
 * anymore, but it stays live so a device holding a pre-retirement anonymous
 * subscription can still be opted out (manually or by future cleanup tooling).
 *
 * Removes an anonymous fan's score-alert subscription for a tournament. Only the
 * server-side row is deleted — the browser's push subscription is left intact
 * because it may be shared with other features.
 *
 * Body: { endpoint, tournamentId }
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  let body: { endpoint?: string; tournamentId?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { endpoint, tournamentId } = body;
  if (!endpoint || !tournamentId) {
    return NextResponse.json({ error: 'Missing required fields: endpoint, tournamentId.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('fan_push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('tournament_id', tournamentId);

  if (error) {
    console.error('[fan-push/unsubscribe] Delete failed:', error.message);
    return NextResponse.json({ error: 'Failed to remove subscription.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, { route: '/api/public/fan-push/unsubscribe' });
