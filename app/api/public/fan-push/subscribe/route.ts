/**
 * POST /api/public/fan-push/subscribe — RETIRED (410 Gone).
 *
 * The anonymous per-device fan alert opt-in closed at unified-app Phase 2
 * Slice 3 (Business Decisions Log 2026-07-14): score alerts require a signed-in
 * account. New opt-ins go through the account path — sign in, follow, and the
 * device registers via /api/notifications/push/subscribe (user-keyed) with
 * account-level prefs at /api/consumer/alert-prefs.
 *
 * EXISTING fan_push_subscriptions rows keep receiving (lib/fan-notify.ts still
 * dispatches to them) until they expire naturally; the sibling /unsubscribe
 * route stays live so those devices can still opt out.
 */
import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async () => {
  return NextResponse.json(
    { error: 'Sign in to get score alerts — device-only alert opt-ins are no longer offered.' },
    { status: 410 },
  );
}, { route: '/api/public/fan-push/subscribe' });
