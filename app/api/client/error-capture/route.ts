import { NextRequest, NextResponse } from 'next/server';
import { captureError } from '@/lib/observability/capture';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';

// Public, unauthenticated client-error ingestion endpoint. IP-rate-limited + body-size capped.
// Posted to by the client error boundaries (app/error.tsx, app/global-error.tsx) and a window
// error/unhandledrejection listener. Node runtime so captureError can reach supabaseAdmin.
export const runtime = 'nodejs';

const MAX_BODY = 16_384; // 16 KB

// The house abuse-control idiom (lib/rate-limit, same pairing as auth/signup + league/create):
// a per-IP bucket plus a spoofing-proof global ceiling, since x-forwarded-for is forgeable.
// Own limiter INSTANCES, not shared ones — a burst of client errors must never starve the
// nav-click beacon's budget, or vice versa.
const ipLimiter = new FixedWindowRateLimiter(1000, 1);      // ~1 report/sec/IP (best-effort)
const globalLimiter = new FixedWindowRateLimiter(1000, 50); // total captures/sec across ALL IPs

type ClientErrorBody = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  route?: unknown;
  componentStack?: unknown;
};

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req);

  if (!ipLimiter.take(ip) || !globalLimiter.take('global')) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (raw.length > MAX_BODY) raw = raw.slice(0, MAX_BODY);

  let payload: ClientErrorBody;
  try {
    payload = JSON.parse(raw) as ClientErrorBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!payload || typeof payload.message !== 'string' || !payload.message) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const err = new Error(payload.message);
  err.name = typeof payload.name === 'string' && payload.name ? payload.name : 'ClientError';
  if (typeof payload.stack === 'string') err.stack = payload.stack;

  await captureError(err, {
    source: 'client',
    severity: 'warning',
    route: typeof payload.route === 'string' ? payload.route : undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
    ip,
    requestContext: {
      componentStack:
        typeof payload.componentStack === 'string' ? payload.componentStack.slice(0, 4000) : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
