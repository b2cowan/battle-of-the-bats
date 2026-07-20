/**
 * GET /api/consumer/invites/count
 *
 * Cheap, read-only count of pending team/org invitations for the signed-in account — feeds the
 * red "needs you" badge on the Home tab (Unified Home Phase 5 unified badge policy). Signed-out
 * callers get { count: 0 }. Per-user, never shared: no-store (defense-in-depth beyond the SW's
 * blanket /api/ no-cache), matching every sibling consumer API. No new top-level route → no SW
 * denylist change.
 *
 * Deliberately does NOT reconcile orphaned invites — that idempotent write rides Home's own
 * /api/consumer/home load, so this endpoint stays a pure read that can run on every route focus.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import { listPendingInvitesForUser } from '@/lib/invite-reconciliation';

export const dynamic = 'force-dynamic';

export const GET = withObservability(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return NextResponse.json({ count: 0 }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const invites = await listPendingInvitesForUser(user.id).catch(() => []);
  return NextResponse.json({ count: invites.length }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/consumer/invites/count' });
