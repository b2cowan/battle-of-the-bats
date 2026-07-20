import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { writePlatformEvent, type PlatformEventType } from '@/lib/platform-events';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { withObservability } from '@/lib/observability';
import { CONSUMER_CLIENT_EVENTS } from '@/lib/consumer-events-client';

export const runtime = 'nodejs';

// Thin ingest for the CLIENT-originated consumer front-door metrics (Unified Home Phase 5 / §6).
// Server-originated consumer events (directory_search, chat_inbox_loaded, auth_workspace_landing)
// are written from their own routes and are intentionally NOT accepted here, so the client can't
// forge them. Best-effort — the client never reacts to the response.
//
// Unlike the League ingest, ANONYMOUS actors are accepted: signed-out Home/Chat views + bounce are
// part of the metric set, attributed actor-null. Platform staff are dropped so they never enter
// product metrics. The accepted names come from the shared CONSUMER_CLIENT_EVENTS allowlist (same
// source the client helper's union type derives from), so the client and server can't drift.

// Lenient caps so instrumentation can't flood platform_events. Signed-in keyed by user id; anon
// keyed by a coarse forwarded-IP hint so one anon client can't spam unbounded.
const authedLimiter = new FixedWindowRateLimiter(60_000, 60);
const anonLimiter = new FixedWindowRateLimiter(60_000, 30);

// Bound the client-supplied metadata before it lands in platform_events.metadata. This is the one
// ANONYMOUS-accepting write path into that table, so we keep it small and flat by construction: at
// most 12 primitive-valued keys, nested objects/arrays dropped, strings truncated. Prevents an
// unauthenticated caller from persisting large or deeply-nested arbitrary JSON.
function boundMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= 12) break;
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 200);
    // objects / arrays / null / functions are dropped
  }
  return out;
}

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const event = body?.event;
  if (!CONSUMER_CLIENT_EVENTS.includes(event)) {
    return NextResponse.json({ error: 'Unsupported event.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isStaff = user?.email ? await isPlatformAdminEmail(user.email) : false;
  // Staff never enter product metrics — accept-and-drop (202), never leak auth state via status.
  if (isStaff) return NextResponse.json({ ok: true }, { status: 202 });

  if (user?.id) {
    if (!authedLimiter.take(user.id)) return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  } else {
    if (!anonLimiter.take(clientIpFrom(req))) return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  const metadata = boundMetadata(body?.metadata);

  await writePlatformEvent({
    eventType: event as PlatformEventType,
    source: 'app',
    actorUserId: user?.id ?? null,
    actorEmail: user?.email ?? null,
    metadata,
  });

  return NextResponse.json({ ok: true });
}, { route: '/api/events/consumer' });
