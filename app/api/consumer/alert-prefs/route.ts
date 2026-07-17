/**
 * GET/POST /api/consumer/alert-prefs
 *
 * The signed-in fan's GLOBAL alert preferences (unified-app Phase 2 Slice 3 —
 * alerts require an account; Business Decisions Log 2026-07-14). Two switches
 * covering ALL followed teams. Anonymous callers get { linked: false } on GET
 * (mirrors /api/consumer/follows) and 401 on POST — there are no device-level
 * alert settings anymore.
 *
 * POST body: { gameAlerts?: boolean, eventNews?: boolean } (partial patch).
 * Device push registration is separate — the client enables push on the device
 * via the existing /api/notifications/push/subscribe (user-keyed) route.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { getFanAlertPrefs, setFanAlertPrefs } from '@/lib/fan-alert-prefs';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ linked: false });
  const prefs = await getFanAlertPrefs(user.id);
  // Per-user payload — belt-and-suspenders against any intermediary caching
  // (matches the sibling /api/consumer/follows GET).
  return NextResponse.json({ linked: true, ...prefs }, { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/consumer/alert-prefs' });

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: { gameAlerts?: unknown; eventNews?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const patch: { gameAlerts?: boolean; eventNews?: boolean } = {};
  if (typeof body.gameAlerts === 'boolean') patch.gameAlerts = body.gameAlerts;
  if (typeof body.eventNews === 'boolean') patch.eventNews = body.eventNews;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const prefs = await setFanAlertPrefs(user.id, patch);
  return NextResponse.json({ linked: true, ...prefs });
}, { route: '/api/consumer/alert-prefs' });
