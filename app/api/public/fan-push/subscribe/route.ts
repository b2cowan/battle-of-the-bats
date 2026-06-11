/**
 * POST /api/public/fan-push/subscribe
 *
 * Subscribes an ANONYMOUS fan (no account) to push score alerts for the team
 * they follow in a tournament. Called by FollowAlertsToggle after a successful
 * pushManager.subscribe(). Upserts on (endpoint, tournament_id) so re-following a
 * different team in the same tournament just updates the row.
 *
 * Gated to Tournament Plus+ via `fan_score_alerts` (also enforced in lib/fan-notify).
 *
 * Body: { endpoint, keys: { p256dh, auth }, tournamentId, teamId, deviceLabel? }
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlanFeature } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    tournamentId?: string;
    teamId?: string;
    deviceLabel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { endpoint, keys, tournamentId, teamId, deviceLabel } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth || !tournamentId || !teamId) {
    return NextResponse.json(
      { error: 'Missing required fields: endpoint, keys.p256dh, keys.auth, tournamentId, teamId.' },
      { status: 400 },
    );
  }

  // The team must really belong to the tournament (prevents arbitrary fan-out targeting).
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('tournament_id', tournamentId)
    .maybeSingle();
  if (!team) {
    return NextResponse.json({ error: 'Team not found in this tournament.' }, { status: 400 });
  }

  // Plan gate — fan alerts are a Tournament Plus+ feature.
  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('org_id')
    .eq('id', tournamentId)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
  }
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan_id')
    .eq('id', tournament.org_id)
    .maybeSingle();
  if (!org || !hasPlanFeature(org.plan_id as OrgPlan, 'fan_score_alerts')) {
    return NextResponse.json({ error: 'Score alerts are not available for this tournament.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('fan_push_subscriptions')
    .upsert(
      {
        endpoint,
        keys_p256dh:   keys.p256dh,
        keys_auth:     keys.auth,
        tournament_id: tournamentId,
        team_id:       teamId,
        device_label:  deviceLabel ?? null,
        last_used_at:  new Date().toISOString(),
      },
      { onConflict: 'endpoint,tournament_id', ignoreDuplicates: false },
    );

  if (error) {
    console.error('[fan-push/subscribe] Upsert failed:', error.message);
    return NextResponse.json({ error: 'Failed to save subscription.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, { route: '/api/public/fan-push/subscribe' });
