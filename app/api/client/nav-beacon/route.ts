import { NextRequest, NextResponse } from 'next/server';
import { FixedWindowRateLimiter, clientIpFrom } from '@/lib/rate-limit';
import { isTrustedAppOrigin } from '@/lib/app-origin';
import { NAV_BEACON_EVENTS, type NavBeaconEvent } from '@/lib/nav-beacon';

/**
 * Public, unauthenticated nav-click beacon (Nav Unification Stage E.1 · plan §6 evidence gates).
 *
 * The org public page's "Discover" link is the fan's one door back into the app, and §6 makes its
 * click-through the gate that decides whether ONE link is the permanent answer or the fan gap
 * earns a `/design` pass. This endpoint is the numerator for that number.
 *
 * ANONYMOUS INVARIANT (plan §5): this fires on CLICK ONLY. Nothing is requested on render, so an
 * anonymous visitor's page still weighs and fetches exactly what it did before. No cookie is read,
 * no identity is resolved, and nothing here is persisted — the signal is a greppable CloudWatch
 * line, matching the Stage A `[metric] multi_hat` pattern.
 *
 * ⚠ The DENOMINATOR is not collected here. A page-view beacon would be a new anonymous request on
 * every org page load, which §5 forbids outright. Org-page view counts must come from the server's
 * own request logs when the gate is read.
 */
export const runtime = 'nodejs';

const MAX_BODY = 1_024;

// The house abuse-control idiom (lib/rate-limit): a per-IP bucket plus a spoofing-proof global
// ceiling, since x-forwarded-for is forgeable. Own instances — this endpoint and error-capture
// must not be able to starve each other's budget.
const ipLimiter = new FixedWindowRateLimiter(500, 1);        // ~2 clicks/sec/IP
const globalLimiter = new FixedWindowRateLimiter(1000, 100); // total beacons/sec across ALL IPs

/**
 * Log-injection guard. `from` originates in the browser's own location, which an attacker can
 * shape by sending someone a crafted URL — so it reaches the log line only after control
 * characters (newlines included) are stripped and the length is capped. Never interpolate it raw.
 */
function safeLogValue(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  // Strip every character a log viewer could read as a NEW LINE, by code point — no regex escapes,
  // so the guard cannot be silently broken by an editor or a bad merge mangling a character class.
  // C0/DEL alone is NOT enough: U+2028/U+2029 survive JSON.parse unescaped and render as line
  // breaks in many log consoles, which would let a caller forge a whole fake `[metric] ...` line.
  const printable = Array.from(value).filter(ch => {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 31 || code === 127) return false;           // C0 controls + DEL
    if (code >= 0x80 && code <= 0x9f) return false;         // C1 controls
    if (code === 0x2028 || code === 0x2029) return false;   // LINE / PARAGRAPH SEPARATOR
    return true;
  });
  return printable.join('').slice(0, maxLength);
}

function isKnownEvent(value: unknown): value is NavBeaconEvent {
  return typeof value === 'string' && (NAV_BEACON_EVENTS as readonly string[]).includes(value);
}

export async function POST(req: NextRequest) {
  // Always 202 — a beacon is fire-and-forget, and a caller that can distinguish "accepted" from
  // "rejected" is a caller that can probe this endpoint. Nothing downstream reads the response.
  const accepted = NextResponse.json({ ok: true }, { status: 202 });

  // Drop browser-driven cross-origin posts. This metric is the numerator of a real go/no-go gate,
  // so an unrelated site must not be able to inflate it with one line of JS on its own page load.
  // An ABSENT Origin still passes: only browsers are obliged to send one, and rejecting on absence
  // would drop legitimate clients. That means this raises the bar against the easy drive-by vector,
  // NOT against a scripted caller forging headers — no unauthenticated endpoint can stop that, and
  // the rate limiters below are what bound its volume.
  const origin = req.headers.get('origin');
  if (origin && !isTrustedAppOrigin(origin)) return accepted;

  if (!ipLimiter.take(clientIpFrom(req)) || !globalLimiter.take('global')) return accepted;

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return accepted;
  }
  if (raw.length > MAX_BODY) return accepted;

  let payload: { event?: unknown; from?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return accepted;
  }

  // Allowlisted event names only: an open `event` field would turn a public endpoint into an
  // arbitrary log-writing sink.
  if (!isKnownEvent(payload?.event)) return accepted;

  console.log(`[metric] nav_click event=${payload.event} from=${safeLogValue(payload.from, 200)}`);
  return accepted;
}
