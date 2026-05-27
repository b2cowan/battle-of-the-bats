/**
 * /api/admin/tournaments/[tournamentId]/notification-preferences
 *
 * D3 — Per-tournament notification opt-outs for the calling user.
 *
 * GET  → { preferences: { eventType, optedOut }[] }
 *   Returns only saved rows. Client treats missing rows as optedOut=false.
 *
 * POST body: { preferences: [{ eventType, optedOut }] }
 *   Upserts rows. Conflict target: (user_id, tournament_id, event_type).
 *   Send all 11 event types with optedOut=true to "mute all",
 *   or all with optedOut=false to "unmute all".
 */

import { NextResponse } from 'next/server';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { NotificationEventType } from '@/lib/types';

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

type RouteContext = { params: Promise<{ tournamentId: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  if (!tournamentId) return badRequest('Missing tournamentId.');

  // Resolve orgSlug from the tournament row so we can scope auth correctly.
  const { data: tourRow } = await supabaseAdmin
    .from('tournaments')
    .select('organization_id')
    .eq('id', tournamentId)
    .maybeSingle();

  if (!tourRow) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });

  const { data: orgRow } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', tourRow.organization_id)
    .maybeSingle();

  if (!orgRow) return unauthorized();

  const ctx = await getAuthContextWithScope({ orgSlug: orgRow.slug });
  if (!ctx) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('tournament_notification_preferences')
    .select('event_type, opted_out')
    .eq('user_id', ctx.user.id)
    .eq('tournament_id', tournamentId);

  if (error) {
    console.error('[tournament-notification-preferences GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const preferences = (data ?? []).map(row => ({
    eventType: row.event_type as NotificationEventType,
    optedOut:  row.opted_out,
  }));

  return NextResponse.json({ preferences });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request, context: RouteContext) {
  const { tournamentId } = await context.params;
  if (!tournamentId) return badRequest('Missing tournamentId.');

  // Resolve org for auth scope
  const { data: tourRow } = await supabaseAdmin
    .from('tournaments')
    .select('organization_id')
    .eq('id', tournamentId)
    .maybeSingle();

  if (!tourRow) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });

  const { data: orgRow } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', tourRow.organization_id)
    .maybeSingle();

  if (!orgRow) return unauthorized();

  const ctx = await getAuthContextWithScope({ orgSlug: orgRow.slug });
  if (!ctx) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body?.preferences || !Array.isArray(body.preferences) || body.preferences.length === 0) {
    return badRequest('Body must contain a non-empty preferences array.');
  }

  const rows = body.preferences.map((p: { eventType: NotificationEventType; optedOut: boolean }) => ({
    user_id:       ctx.user.id,
    tournament_id: tournamentId,
    event_type:    p.eventType,
    opted_out:     p.optedOut,
    updated_at:    new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('tournament_notification_preferences')
    .upsert(rows, { onConflict: 'user_id,tournament_id,event_type' });

  if (error) {
    console.error('[tournament-notification-preferences POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
