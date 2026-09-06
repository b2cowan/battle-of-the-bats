import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AppNotification } from '@/lib/types';
import { NOTIFICATION_CATEGORY, ACT_EVENT_TYPES } from '@/lib/notification-labels';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Chat ("talk") events don't belong in the bell (Notification Center Rework P3) — they
// have the Chat-tab unread badge. Excluded from BOTH the list and the unread count, driven
// from the same source so the badge can never diverge from the panel. Derived from the
// category map so any future 'talk' type is auto-excluded (drift guard).
const BELL_EXCLUDED_EVENTS = Object.entries(NOTIFICATION_CATEGORY)
  .filter(([, cat]) => cat === 'talk')
  .map(([evt]) => evt);
const BELL_EXCLUDE_IN = BELL_EXCLUDED_EVENTS.length > 0
  ? `(${BELL_EXCLUDED_EVENTS.map(e => `"${e}"`).join(',')})`
  : null;

// "Mark all read" marks ACTIVITY only (owner ruling 2026-09-03, D3): the "Needs attention" rows are
// a triage list, so one tap must not make an unhandled decision look handled. ⚠ D3 is now LOAD-
// BEARING rather than merely tidy — since 2026-09-06 those rows leave the zone on `cleared_at`,
// not on read, so a mark-all that touched them would be the only way to silently empty a list of
// unmade decisions. Same source as both clients' optimistic updates (ACT_EVENT_TYPES).
const ACT_EXCLUDE_IN = ACT_EVENT_TYPES.size > 0
  ? `(${[...ACT_EVENT_TYPES].map(e => `"${e}"`).join(',')})`
  : null;

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
    readAt:    row.read_at    ?? null,
    clearedAt: row.cleared_at ?? null,
    createdAt: row.created_at,
    metadata:  row.metadata   ?? {},
  };
}

// ── GET — list notifications + unread count ───────────────────────────────────

export const GET = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const url        = new URL(req.url);
  const orgId      = url.searchParams.get('orgId');
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit      = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);
  // Cursor for the "See all" page's Load more — return rows OLDER than this created_at.
  const before     = url.searchParams.get('before');

  if (!orgId) return NextResponse.json({ notifications: [], unreadCount: 0, hasMore: false });

  // Unread count (always returned regardless of unreadOnly flag). Excludes chat (P3).
  let countQuery = supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .is('read_at', null);
  if (BELL_EXCLUDE_IN) countQuery = countQuery.not('event_type', 'in', BELL_EXCLUDE_IN);
  const { count } = await countQuery;

  // Notification list — same chat exclusion as the count (single source → no divergence).
  let query = supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (BELL_EXCLUDE_IN) query = query.not('event_type', 'in', BELL_EXCLUDE_IN);
  if (unreadOnly) {
    query = query.is('read_at', null);
  }
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;

  if (error) {
    console.error('[notifications GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  return NextResponse.json({
    notifications: rows.map(mapRow),
    unreadCount:   count ?? 0,
    // A full page back suggests there may be older rows to fetch next.
    hasMore:       rows.length === limit,
  });
}, { route: '/api/notifications' });

// ── POST — mark-read | mark-all-read | clear ─────────────────────────────────

export const POST = withObservability(async (req: Request) => {
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

    let markAll = supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .eq('org_id', body.orgId)
      .is('read_at', null);
    // Needs-attention rows are left entirely alone — not read, and certainly not cleared (D3).
    if (ACT_EXCLUDE_IN) markAll = markAll.not('event_type', 'in', ACT_EXCLUDE_IN);
    const { error } = await markAll;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── clear — "I am finished with this one" (mig 278) ────────────────────────
  // The only writer of cleared_at. Deliberately per-row: there is no clear-all, because the
  // whole point of the zone is that emptying it is a series of decisions, not one gesture.
  if (body.action === 'clear') {
    if (!body.id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ cleared_at: now })
      .eq('id', body.id)
      .eq('user_id', user.id); // safety: only own notifications

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // A row you are finished with should not also sit unread. Guarded on `read_at is null` rather
    // than written unconditionally so clearing an old row never rewrites when it was first seen.
    const { error: readError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: now })
      .eq('id', body.id)
      .eq('user_id', user.id)
      .is('read_at', null);

    // The clear itself landed; a failed read stamp is cosmetic and must not report failure.
    if (readError) console.error('[notifications clear → read]', readError.message);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}, { route: '/api/notifications' });
