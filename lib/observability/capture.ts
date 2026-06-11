/**
 * captureError — the observability workhorse. Fingerprints + records a server/client error into
 * the error_groups / error_events store via the record_error_event RPC (atomic upsert + sampled
 * insert). Reads attribution from the AsyncLocalStorage request context; explicit opts win.
 *
 * Fire-and-forget discipline: this function NEVER throws or rejects — identical to notify()
 * (lib/notify.ts) and writePlatformEvent(). It also console.error()s so CloudWatch log-based
 * debugging keeps working. Callers may `await` it on the error path (errors are rare) or fire it.
 */
import { supabaseAdmin } from '../supabase-admin';
import { maybeSendCriticalAlert, type RecordErrorFlags } from './alerts';
import { observabilityEnv } from './env';
import { fingerprint } from './fingerprint';
import { redactContext, scrubEmails } from './redact';
import { getRequestContext } from './request-context';

export type Severity = 'critical' | 'error' | 'warning' | 'info';

/** Structurally matches AuthContext / AuthContextWithScope / AuthContextWithRole. */
interface CaptureCtx {
  user?: { id?: string | null; email?: string | null } | null;
  org?: { id?: string | null; slug?: string | null } | null;
  role?: string | null;
}

export interface CaptureOptions {
  route?: string;
  method?: string;
  statusCode?: number;
  severity?: Severity;
  source?: 'server' | 'client';
  /** Upstream-minted request id (proxy.ts stamps x-request-id). Wins over the ALS context so the
   *  id stored on error_events matches the one the client read off the response — even on the
   *  global onRequestError path, which has no ALS context. */
  requestId?: string | null;
  /** Pass the route's resolved auth context for full org/user/role attribution. */
  ctx?: CaptureCtx | null;
  org?: { id?: string | null; slug?: string | null } | null;
  user?: { id?: string | null; email?: string | null } | null;
  role?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestContext?: Record<string, unknown> | null;
  title?: string | null;
}

// Routes whose failures are treated as CRITICAL — drives Phase-4 first-occurrence alerting.
// Allowlist locked by the owner 2026-06-10 (OBSERVABILITY_ERROR_TRACKING_PLAN.md §14.6):
// payments/billing · auth · tournament registration · org creation (a failed signup is a lost
// customer). Tune here; alerts stay de-noised regardless (one email per issue transition).
const CRITICAL_ROUTE_PATTERNS: RegExp[] = [
  /stripe|billing|webhook|checkout|payment/i,
  /\bauth\b|login|signup|sign-in/i,
  /\/api\/register\b/i,
  /\/api\/org\/create\b/i,
];

const MAX_STACK = 8000;
const MAX_MESSAGE = 1000;

function classifySeverity(route: string | undefined, explicit?: Severity): Severity {
  if (explicit) return explicit;
  if (route && CRITICAL_ROUTE_PATTERNS.some(re => re.test(route))) return 'critical';
  return 'error';
}

function toError(err: unknown): { name: string; message: string; stack?: string } {
  if (err instanceof Error) {
    return { name: err.name || 'Error', message: err.message || String(err), stack: err.stack };
  }
  if (typeof err === 'string') return { name: 'Error', message: err };
  try {
    return { name: 'Error', message: JSON.stringify(err) };
  } catch {
    return { name: 'Error', message: String(err) };
  }
}

export async function captureError(err: unknown, opts: CaptureOptions = {}): Promise<void> {
  try {
    const reqCtx = getRequestContext();
    const route = opts.route ?? reqCtx?.route;
    const method = opts.method ?? reqCtx?.method;
    const source = opts.source ?? reqCtx?.source ?? 'server';
    const { name, message, stack } = toError(err);

    const orgId = opts.ctx?.org?.id ?? opts.org?.id ?? reqCtx?.orgId ?? null;
    const orgSlug = opts.ctx?.org?.slug ?? opts.org?.slug ?? reqCtx?.orgSlug ?? null;
    const userId = opts.ctx?.user?.id ?? opts.user?.id ?? reqCtx?.userId ?? null;
    const userEmail = opts.ctx?.user?.email ?? opts.user?.email ?? reqCtx?.userEmail ?? null;
    const userRole = opts.role ?? opts.ctx?.role ?? reqCtx?.userRole ?? null;

    const severity = classifySeverity(route, opts.severity);
    const fp = fingerprint({ route, errorName: name, stack });
    const env = observabilityEnv();
    // Defense-in-depth: scrub email VALUES out of the free-text message/stack before storage
    // (the dedicated user_email attribution column is set separately and intentionally).
    const safeStack = stack ? scrubEmails(stack).slice(0, MAX_STACK) : null;
    const safeMessage = message ? scrubEmails(message).slice(0, MAX_MESSAGE) : null;
    const requestId = opts.requestId ?? reqCtx?.requestId ?? null;
    const context = redactContext({ ...(opts.requestContext ?? {}), requestId });

    // Surface to CloudWatch so existing log-based debugging keeps working.
    console.error(
      `[observability] ${severity} ${route ?? '?'} ${name}: ${safeMessage ?? ''} (fp=${fp}${requestId ? ` req=${requestId}` : ''})`,
    );

    const { data, error } = await supabaseAdmin.rpc('record_error_event', {
      p_fingerprint: fp,
      p_title: opts.title ?? `${name}${route ? ` @ ${route}` : ''}`,
      p_error_name: name,
      p_route: route ?? null,
      p_http_method: method ?? null,
      p_status_code: opts.statusCode ?? null,
      p_error_message: safeMessage,
      p_stack: safeStack,
      p_severity: severity,
      p_env: env,
      p_source: source,
      p_org_id: orgId,
      p_org_slug: orgSlug,
      p_user_id: userId,
      p_user_email: userEmail,
      p_user_role: userRole,
      p_request_id: requestId,
      p_ip: opts.ip ?? null,
      p_user_agent: opts.userAgent ?? null,
      p_context: context,
    });
    if (error) {
      console.error('[observability] record_error_event failed:', error.message);
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Phase-4 critical alerting. The object check is deliberate: if the code ever outruns
      // migration 122 (pre-122 RPC returns a uuid string), alerting silently skips while
      // capture keeps working. AWAITED, not fire-and-forget: maybeSendCriticalAlert never
      // rejects (its whole body is wrapped in try/catch), and awaiting is required on Amplify's
      // Lambda runtime — a detached promise can be frozen when the handler returns and the
      // first-occurrence email (the entire point of the alert) would never be sent. The cost is
      // one-time email latency on the rare critical error path (de-noised to one send per issue).
      await maybeSendCriticalAlert(data as RecordErrorFlags, source, env, {
        title: opts.title ?? `${name}${route ? ` @ ${route}` : ''}`,
        errorName: name,
        message: safeMessage,
        route,
        method,
        orgSlug,
        requestId,
      });
    }
  } catch (captureErr) {
    // Capture must NEVER affect the request path.
    try {
      console.error('[observability] captureError swallowed:', captureErr);
    } catch {
      /* noop */
    }
  }
}
