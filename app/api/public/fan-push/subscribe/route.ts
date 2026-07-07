/**
 * POST /api/public/fan-push/subscribe
 *
 * Subscribes an ANONYMOUS fan (no account) to push notifications for a tournament.
 * Called by FollowAlertsToggle (team score alerts) AND the public notification bell
 * (tournament-wide messages, with or without a followed team) after a successful
 * pushManager.subscribe(). Upserts on (endpoint, tournament_id) — one row per device per
 * tournament — so both controls write the same row and per-category flags stay coherent.
 *
 * Gated to Tournament Plus+ via `fan_score_alerts` (also enforced in lib/fan-notify).
 *
 * Body: { endpoint, keys: { p256dh, auth }, tournamentId, teamId?, notifyMessages?,
 *         notifyScores?, deviceLabel? }
 *   teamId is OPTIONAL now — a null/absent team is a tournament-wide subscription with no
 *   followed team (mig 177): it receives message pushes and, if scores are on, the
 *   tournament-wide result moments (playoffs set / champions crowned) — but NOT per-game score
 *   pushes, which require a team (the score fan-out filters team_id IN (game's teams)).
 *   notifyMessages/notifyScores default true (back-compat with the existing team toggle, which
 *   sends neither and means "both on").
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
    teamId?: string | null;
    notifyMessages?: boolean;
    notifyScores?: boolean;
    deviceLabel?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { endpoint, keys, tournamentId, teamId, deviceLabel } = body;
  // Default both categories ON when unspecified — keeps the existing team toggle (which sends
  // neither flag) meaning "score + messages", exactly as it behaved before this change.
  const notifyMessages = body.notifyMessages ?? true;
  const notifyScores   = body.notifyScores ?? true;

  if (!endpoint || !keys?.p256dh || !keys?.auth || !tournamentId) {
    return NextResponse.json(
      { error: 'Missing required fields: endpoint, keys.p256dh, keys.auth, tournamentId.' },
      { status: 400 },
    );
  }

  // A subscription must want at least one category — otherwise it's a dead row; the client
  // calls /unsubscribe when the fan turns everything off.
  if (!notifyMessages && !notifyScores) {
    return NextResponse.json({ error: 'Select at least one notification category.' }, { status: 400 });
  }

  // The team (when provided) must really belong to the tournament (prevents arbitrary fan-out
  // targeting). A null team = tournament-wide, messages-only subscription — no team to validate.
  if (teamId) {
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    if (!team) {
      return NextResponse.json({ error: 'Team not found in this tournament.' }, { status: 400 });
    }
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
    return NextResponse.json({ error: 'Notifications are not available for this tournament.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('fan_push_subscriptions')
    .upsert(
      {
        endpoint,
        keys_p256dh:     keys.p256dh,
        keys_auth:       keys.auth,
        tournament_id:   tournamentId,
        team_id:         teamId ?? null,
        notify_messages: notifyMessages,
        notify_scores:   notifyScores,
        device_label:    deviceLabel ?? null,
        last_used_at:    new Date().toISOString(),
      },
      { onConflict: 'endpoint,tournament_id', ignoreDuplicates: false },
    );

  if (error) {
    console.error('[fan-push/subscribe] Upsert failed:', error.message);
    return NextResponse.json({ error: 'Failed to save subscription.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}, { route: '/api/public/fan-push/subscribe' });
