import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AppNotification } from '@/lib/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function mapRow(row: any): AppNotification {
  return {
    id:        row.id,
    orgId:     row.org_id,
    eventType: row.event_type,
    title:     row.title,
    body:      row.body      ?? null,
    link:      row.link      ?? null,
    readAt:    row.read_at   ?? null,
    createdAt: row.created_at,
    metadata:  row.metadata  ?? {},
  };
}

// ── GET — list notifications + unread count ───────────────────────────────────

export async function GET(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const url        = new URL(req.url);
  const orgId      = url.searchParams.get('orgId');
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit      = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);

  if (!orgId) return NextResponse.json({ notifications: [], unreadCount: 0 });

  // Unread count (always returned regardless of unreadOnly flag)
  const { count } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .is('read_at', null);

  // Notification list
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is('read_at', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[notifications GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: (data ?? []).map(mapRow),
    unreadCount:   count ?? 0,
  });
}

// ── POST — mark-read | mark-all-read ─────────────────────────────────────────

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ error: 'Missing action.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // ── mark-read ──────────────────────────────────────────────────────────────
  if (body.action === 'mark-read') {
    if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('id', body.id)
      .eq('user_id', user.id); // safety: only own notifications

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── mark-all-read ──────────────────────────────────────────────────────────
  if (body.action === 'mark-all-read') {
    if (!body.orgId) return NextResponse.json({ error: 'Missing orgId.' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .eq('org_id', body.orgId)
      .is('read_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
