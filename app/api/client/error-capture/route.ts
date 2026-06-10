import { NextRequest, NextResponse } from 'next/server';
import { captureError } from '@/lib/observability/capture';

// Public, unauthenticated client-error ingestion endpoint. IP-rate-limited + body-size capped.
// Posted to by the client error boundaries (app/error.tsx, app/global-error.tsx) and a window
// error/unhandledrejection listener. Node runtime so captureError can reach supabaseAdmin.
export const runtime = 'nodejs';

const MAX_BODY = 16_384; // 16 KB
const MIN_INTERVAL_MS = 1000; // ~1 report/sec/IP (best-effort)
const MAX_IP_ENTRIES = 5000;
const GLOBAL_WINDOW_MS = 1000;
const GLOBAL_MAX_PER_WINDOW = 50; // spoofing-proof backstop: total captures/sec across ALL IPs

const lastByIp = new Map<string, number>();
let globalWindowStart = 0;
let globalCount = 0;

// Best-effort client IP. Behind the Amplify/CloudFront proxy x-forwarded-for is the client IP;
// it is spoofable by a direct caller, so per-IP throttling is backed by GLOBAL_MAX_PER_WINDOW below.
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// Drop the single oldest entry instead of wiping all throttle state (a clear() would reset every
// IP's timer and let a flood through). Keeps the map bounded without nullifying rate limiting.
function evictOldestIfFull(): void {
  if (lastByIp.size <= MAX_IP_ENTRIES) return;
  let oldestIp: string | null = null;
  let oldestTs = Infinity;
  for (const [k, v] of lastByIp) {
    if (v < oldestTs) {
      oldestTs = v;
      oldestIp = k;
    }
  }
  if (oldestIp !== null) lastByIp.delete(oldestIp);
}

type ClientErrorBody = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  route?: unknown;
  componentStack?: unknown;
};

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const now = Date.now();

  // Global backstop (spoofing-proof): cap total captures/sec regardless of (forgeable) IP.
  if (now - globalWindowStart >= GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
  }
  if (globalCount >= GLOBAL_MAX_PER_WINDOW) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  // Per-IP throttle (best-effort).
  if (now - (lastByIp.get(ip) ?? 0) < MIN_INTERVAL_MS) {
    return NextResponse.json({ ok: true, throttled: true }, { status: 202 });
  }

  globalCount += 1;
  lastByIp.set(ip, now);
  evictOldestIfFull();

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
