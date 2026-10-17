import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AppNotification } from '@/lib/types';
import { bellFromRequest, bellReadFilter, type BellSource } from '@/lib/notification-bell-scope';
import { NOTIFICATION_DELETE_MAX_IDS } from '@/lib/notification-view';
import { clearSettledForReader, settledLines, type NoticeRow } from '@/lib/needs-attention';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * WHICH ROWS A BELL READS — one rule for the list, the count and Mark all read (`bellReadFilter`):
 *   · a club's bell (`orgId`): that club's rows, minus chat ("talk" — it has the Chat badge,
 *     Notification Center Rework P3) and minus a free coach's own notices, which are filed under the
 *     host club but are never the club's (Free coach header parity, 2026-10-13, B1);
 *   · the free coach's bell (`scope=team-coach`, B3): ONLY those notices, from every club.
 * Applied to a query that is already scoped to the caller (`user_id`), so it can only narrow.
 */
// Loose on purpose: the count and the list are different builder types, and both carry these three.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scopeToBell<Q extends { eq: any; in: any; not: any }>(query: Q, bell: BellSource): Q {
  const { orgId, only, exclude } = bellReadFilter(bell);
  let q = query;
  if (orgId) q = q.eq('org_id', orgId);
  if (only) q = q.in('event_type', only);
  if (exclude.length > 0) q = q.not('event_type', 'in', `(${exclude.map(e => `"${e}"`).join(',')})`);
  return q;
}

// Every id must be a uuid, so a malformed one is a 400 here rather than a failed cast (a 500) below.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // A club's bell names its club; the free coach's bell names its scope (B3) — and nothing reads without one.
  const bell       = bellFromRequest(url.searchParams.get('scope'), url.searchParams.get('orgId'));
  const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
  const limit      = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);
  // Cursor for the "See all" page's Load more — return rows OLDER than this created_at.
  const before     = url.searchParams.get('before');

  if (!bell) return NextResponse.json({ notifications: [], unreadCount: 0, hasMore: false });

  // NEEDS ATTENTION CLEARS ITSELF (owner 2026-10-16): anything this reader was asked to do that is no longer
  // waiting leaves Needs attention and stops counting as unread — BEFORE the count and the list are read, so neither
  // ever shows a settled one as waiting. Never throws.
  await clearSettledForReader(user.id, bell);

  // Unread count (always returned regardless of unreadOnly flag) — the same rows the list reads.
  const { count } = await scopeToBell(
    supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null),
    bell,
  );

  // Notification list — the same bell rule as the count (single source → no divergence).
  let query = scopeToBell(
    supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id),
    bell,
  )
    .order('created_at', { ascending: false })
    .limit(limit);
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
  // A settled Needs-attention notification says what happened (A2), read live from its record for this reader. Only a
  // CLEARED row can be settled — the pass above just cleared every settled one — so the rest (and the count call, whose
  // unread rows are never cleared) cost nothing here.
  const lines = await settledLines((rows as NoticeRow[]).filter(r => r.cleared_at), user.id);
  return NextResponse.json({
    notifications: rows.map(row => {
      const n = mapRow(row);
      const settled = lines.get(n.id);
      return settled ? { ...n, settled } : n;
    }),
    unreadCount:   count ?? 0,
    // A full page back suggests there may be older rows to fetch next.
    hasMore:       rows.length === limit,
  });
}, { route: '/api/notifications' });

// ── POST — mark-read | mark-all-read | clear | delete ────────────────────────

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

  // ── mark-all-read — EVERYTHING, Needs attention included (owner ruling 2026-10-05, D9) ─────
  // Reverses the 2026-09-03 rule that left Needs-attention rows unread. Its reason ended on 09-06,
  // when a row stopped leaving the zone on read: only `cleared_at` (Done) moves it out now, so
  // reading a decision no longer makes it look handled. ⚠ THE LINE THAT STILL HOLDS: this must never
  // write `cleared_at`. Read is "seen", Done is "dealt with" — a mark-all that wrote Done would empty
  // the triage list in one gesture, which is exactly what the zone exists to prevent.
  if (body.action === 'mark-all-read') {
    // Marks the bell it was pressed in, and only that one: a club's Mark all read never reads a free
    // coach's notices filed under the club, nor the reverse (B1/B3).
    const bell = bellFromRequest(body.scope, body.orgId);
    if (!bell) return NextResponse.json({ error: 'Missing orgId.' }, { status: 400 });

    const { error } = await scopeToBell(
      supabaseAdmin
        .from('notifications')
        .update({ read_at: now })
        .eq('user_id', user.id)
        .is('read_at', null),
      bell,
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── delete — "I do not want it at all" (owner ruling 2026-10-05, D3) ────────
  // Removes the caller's OWN copy. Rows are written one per recipient (`notify()`), so nobody else's
  // copy is touched, and the request or payment a notice was about keeps its facts on its own page.
  // Nothing references a notification row. The client sends this only after its Undo window ends,
  // so a delete that never arrives leaves the row where it was — the benign failure, and the reason
  // no soft-delete column was added.
  if (body.action === 'delete') {
    const ids: unknown[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
    if (ids.length === 0 || ids.length > NOTIFICATION_DELETE_MAX_IDS || !ids.every(id => typeof id === 'string' && UUID_RE.test(id))) {
      return NextResponse.json({ error: 'Missing or invalid ids.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .in('id', ids as string[])
      .eq('user_id', user.id); // safety: only own notifications

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── clear — "I am finished with this one" (mig 278) — the customer's word is DONE (D8) ──────
  // The READER's writer of cleared_at. Deliberately per-row: there is no clear-all, because the
  // whole point of the zone is that emptying it is a series of decisions, not one gesture. The platform's
  // writer is lib/needs-attention.ts: it clears a notification for everyone once its request is settled.
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
