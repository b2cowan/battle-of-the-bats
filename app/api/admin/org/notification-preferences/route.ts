/**
 * /api/admin/org/notification-preferences
 *
 * D1 — Global notification preferences for the calling user within an org.
 *
 * GET  ?orgSlug=<slug>  → { preferences: NotificationPreference[] }
 *   Returns only saved rows. The client fills gaps with system defaults.
 *
 * POST ?orgSlug=<slug>  body: { preferences: [{ eventType, channelBell, channelPush, channelEmail }] }
 *   Upserts one or many rows. Conflict target: (user_id, org_id, event_type).
 */

import { NextResponse } from 'next/server';
import { getAuthContextWithScope } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { NotificationEventType, NotificationPreference } from '@/lib/types';

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}
function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url     = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug');
  if (!orgSlug) return badRequest('Missing orgSlug.');

  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('event_type, channel_bell, channel_push, channel_email')
    .eq('user_id', ctx.user.id)
    .eq('org_id', ctx.org.id);

  if (error) {
    console.error('[notification-preferences GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const preferences: NotificationPreference[] = (data ?? []).map(row => ({
    eventType:    row.event_type   as NotificationEventType,
    channelBell:  row.channel_bell,
    channelPush:  row.channel_push,
    channelEmail: row.channel_email,
  }));

  return NextResponse.json({ preferences });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const url     = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug');
  if (!orgSlug) return badRequest('Missing orgSlug.');

  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body?.preferences || !Array.isArray(body.preferences) || body.preferences.length === 0) {
    return badRequest('Body must contain a non-empty preferences array.');
  }

  const rows = body.preferences.map((p: {
    eventType: NotificationEventType;
    channelBell: boolean;
    channelPush: boolean;
    channelEmail: boolean;
  }) => ({
    user_id:       ctx.user.id,
    org_id:        ctx.org.id,
    event_type:    p.eventType,
    channel_bell:  p.channelBell,
    channel_push:  p.channelPush,
    channel_email: p.channelEmail,
    updated_at:    new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin
    .from('notification_preferences')
    .upsert(rows, { onConflict: 'user_id,org_id,event_type' });

  if (error) {
    console.error('[notification-preferences POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
