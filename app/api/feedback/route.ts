import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole, getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redactContext, withObservability } from '@/lib/observability';
import { scrubEmails } from '@/lib/observability/redact'; // scrubEmails is NOT re-exported from the barrel
import { sendEmail, ADMIN_EMAIL } from '@/lib/email';
import { feedbackAdminNotifyHtml, feedbackConfirmationHtml } from '@/lib/feedback-email';
import { validateFeedbackInput, isThrottled } from '@/lib/feedback-shared';

// In-app bug/feature/feedback ingestion for ALL personas (admin, coach, scorekeeper, anonymous).
// Node runtime so it can use supabaseAdmin (feedback_submissions is RLS-enabled, no policies →
// service-role only). The whole handler is best-effort hardened: emails never break the response.
export const runtime = 'nodejs';

const HOUR_MS = 3_600_000;
const ANON_INTERVAL_MS = 5 * 60_000; // anonymous: 1 accepted submission / 5 min / IP
const MAX_ENTRIES = 5000;
const GLOBAL_WINDOW_MS = 60_000;
const GLOBAL_MAX = 30; // spoofing-proof backstop: total accepted submissions / minute across all callers
const MAX_RAW_BODY = 32_768; // 32 KB

// Module-level throttle state (per Lambda instance; best-effort, like /api/client/error-capture).
const userLast = new Map<string, number>();
const ipLast = new Map<string, number>();
let globalWindowStart = 0;
let globalCount = 0;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// Drop the single oldest entry instead of clearing (a clear() would reset every key's timer).
function evictOldest(map: Map<string, number>): void {
  if (map.size <= MAX_ENTRIES) return;
  let oldestKey: string | null = null;
  let oldestTs = Infinity;
  for (const [k, v] of map) {
    if (v < oldestTs) {
      oldestTs = v;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) map.delete(oldestKey);
}

// Throttle responses are 202 soft-success so a client can't distinguish/probe the limit.
const throttled = () => NextResponse.json({ ok: true, throttled: true }, { status: 202 });

export const POST = withObservability(async (req: NextRequest) => {
  const now = Date.now();

  // Global backstop first (spoofing-proof): cap total accepted submissions/min regardless of IP.
  if (now - globalWindowStart >= GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
  }
  if (globalCount >= GLOBAL_MAX) return throttled();

  // Resolve persona. null = anonymous-but-accepted (org_id/user_id/user_email left null) — NOT a 401.
  const auth = await getAuthContextWithRole().catch(() => null);
  let user = auth?.user ?? null;
  if (!user) user = await getAuthenticatedUser().catch(() => null); // org-less Basic coach still gets attribution

  const ip = clientIp(req);

  // Per-persona rate limit: signed-in 1/hr by user id; anonymous 1/5min by IP.
  if (user) {
    if (isThrottled(userLast, user.id, now, HOUR_MS)) return throttled();
  } else if (isThrottled(ipLast, ip, now, ANON_INTERVAL_MS)) {
    return throttled();
  }

  // Parse + size-cap the body.
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  if (raw.length > MAX_RAW_BODY) return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const validation = validateFeedbackInput(parsed);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  const { type, category, title, body, context } = validation.value;

  // Commit the rate-limit slot only now that we're accepting the write.
  globalCount += 1;
  if (user) {
    userLast.set(user.id, now);
    evictOldest(userLast);
  } else {
    ipLast.set(ip, now);
    evictOldest(ipLast);
  }

  // Redact before write. Free-text title/body → scrubEmails (already length-capped in validation).
  // Structured context blob → full key-name redactor.
  const safeContext = redactContext({
    ...context,
    ip,
    user_agent: req.headers.get('user-agent') ?? undefined,
    role: auth?.role ?? null,
    org_slug: auth?.org.slug ?? null,
  });
  const safeTitle = title ? scrubEmails(title) : null;
  const safeBody = scrubEmails(body);

  const meta = (user?.user_metadata ?? null) as Record<string, unknown> | null;
  const submitterName =
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    (typeof meta?.name === 'string' && meta.name) ||
    null;

  const { error } = await supabaseAdmin.from('feedback_submissions').insert({
    org_id: auth?.org.id ?? null,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    submitter_name: submitterName,
    type,
    category,
    title: safeTitle,
    body: safeBody,
    context: safeContext,
  });

  if (error) {
    return NextResponse.json({ error: 'Could not save feedback.' }, { status: 500 });
  }

  // Notifications — must NEVER break or block the success response.
  // Admin notify is awaited in its own try/catch (sendEmail's fetch can reject on transport failure,
  // and a detached promise can be dropped on serverless). Submitter confirmation is fire-and-forget.
  try {
    await sendEmail(
      ADMIN_EMAIL,
      `New ${type} feedback — ${category}`,
      feedbackAdminNotifyHtml({
        type,
        category,
        title: safeTitle,
        body: safeBody,
        orgSlug: auth?.org.slug ?? null,
        userEmail: user?.email ?? null,
      }),
    );
  } catch {
    /* email failure must never fail the submission */
  }

  if (user?.email) {
    void sendEmail(
      user.email,
      'We received your feedback',
      feedbackConfirmationHtml({ type, submitterName }),
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/feedback' });
