import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { writePlatformEvent } from '@/lib/platform-events';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';
import { withObservability } from '@/lib/observability';
import type { LeagueClientEvent } from '@/lib/league-events-client';

export const runtime = 'nodejs';

// Thin ingest for the two CLIENT-originated League Starter instrumentation events (Phase 6.6 / §13).
// Server-originated events (free_floor_created, league_season_created, league_schedule_generated,
// scope_wall_hit, existing_user_floor_added) are written from their own routes and are intentionally
// NOT accepted here, so the client can't forge activation/cap signals. Attribution is server-verified:
// orgId is only honoured when the signed-in user is a member of that org. Best-effort — never blocks UI.
const CLIENT_EVENTS: readonly LeagueClientEvent[] = ['upgrade_intent_clicked', 'league_public_page_shared'];

// Lenient per-user cap: instrumentation spam shouldn't be able to flood platform_events.
const eventLimiter = new FixedWindowRateLimiter(60_000, 40);

export const POST = withObservability(async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // No user / staff session → silently accept-and-drop (202). Instrumentation is fire-and-forget;
  // the client never reacts to the response, so we don't leak auth state via status codes.
  if (!user?.id || !user.email || await isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (!eventLimiter.take(user.id)) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  const body = await req.json().catch(() => ({}));
  const event = body?.event;
  if (!CLIENT_EVENTS.includes(event)) {
    return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 });
  }

  // Verify membership AND that the org is actually a free League Starter before attributing it
  // (anti-forgery + anti-mis-attribution: both client events are free-floor-only signals, so a
  // member of a paid org can't inflate the League Starter funnel). Otherwise → actor-only (null).
  let orgId: string | null = null;
  const requestedOrgId = typeof body?.orgId === 'string' ? body.orgId : null;
  if (requestedOrgId) {
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, organizations(free_floor)')
      .eq('organization_id', requestedOrgId)
      .eq('user_id', user.id)
      .maybeSingle();
    const org = membership?.organizations as { free_floor?: string | null } | { free_floor?: string | null }[] | null | undefined;
    const freeFloor = Array.isArray(org) ? org[0]?.free_floor : org?.free_floor;
    if (membership && freeFloor === 'league_starter') orgId = requestedOrgId;
  }

  const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
    ? (body.metadata as Record<string, unknown>)
    : {};

  await writePlatformEvent({
    eventType: event,
    source: 'app',
    orgId,
    actorUserId: user.id,
    actorEmail: user.email,
    metadata,
  });

  return NextResponse.json({ ok: true });
}, { route: '/api/events/league' });
