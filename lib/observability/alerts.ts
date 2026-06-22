/**
 * Server-error alerting (Phase 4) — emails ADMIN_EMAIL on the FIRST occurrence of a server issue
 * (and on escalation-to-critical / regression of a resolved issue), de-noised by the
 * record_error_event RPC's atomic transition flags: one email per distinct transition, never one
 * per occurrence. See OBSERVABILITY_ERROR_TRACKING_PLAN.md §14.2.
 *
 * COVERAGE (broadened 2026-06-22): alerts on BOTH 'critical' and 'error' severity. Originally
 * critical-only (a tight allowlist of billing/auth/registration routes); broadened because the
 * product is new + low-volume, so surfacing every genuine server failure fast outweighs inbox
 * noise. 'warning'/'info' still stay silent, client-source still never pages, and the per-issue
 * de-noise + per-worker hourly cap still bound volume. Revisit the threshold if volume grows.
 *
 * Hard gates (owner-approved 2026-06-10): server-source only (the public client error endpoint
 * can never page us) and production env only (local/dev noise never alerts). Fire-and-forget
 * discipline: maybeSendCriticalAlert never throws — sendEmail's fetch CAN reject on a transport
 * error, so the await lives inside this module's own try/catch.
 *
 * The hourly token cap is PER WORKER (Amplify runs many instances) — it only bounds a worst-case
 * storm per process; the DB-level flags are the real cross-instance dedup.
 */
import type { ObservabilityEnv } from './env';

// lib/email is imported LAZILY inside maybeSendCriticalAlert: the unit tests load this module
// under `node --test --experimental-strip-types`, where a static extensionless import cannot
// resolve — and the email module is only needed when an alert actually fires.

/** Shape of the jsonb returned by the record_error_event RPC (migration 122). */
export interface RecordErrorFlags {
  group_id?: string;
  is_new?: boolean;
  became_critical?: boolean;
  regressed?: boolean;
  reopened?: boolean;
  severity?: string;
  status?: string;
}

export interface CriticalAlertDetails {
  title: string;
  errorName: string;
  message: string | null;
  route?: string;
  method?: string;
  orgSlug?: string | null;
  requestId?: string | null;
}

/**
 * Fail-CLOSED production guard. `observabilityEnv()` derives 'production' from a NODE_ENV
 * fallback when OBSERVABILITY_ENV is unset — which is the case on EVERY Amplify deploy including
 * the dev branch (NODE_ENV is always 'production' there). Gating alerts on the *explicit*
 * OBSERVABILITY_ENV instead means a deployed non-prod branch with the console var unset can never
 * page ADMIN_EMAIL: it fails closed (no email) rather than open (spam from dev). Prod must set
 * OBSERVABILITY_ENV=production explicitly (it should anyway, for correct env-tagging).
 */
export function explicitProductionEnv(): boolean {
  const v = process.env.OBSERVABILITY_ENV?.toLowerCase();
  return v === 'production' || v === 'prod';
}

/** Pure alert decision (severity/source/flags/derived-env) — unit-tested. The explicit-env
 *  fail-closed guard is applied separately in maybeSendCriticalAlert (it reads process.env). */
export function shouldAlert(
  flags: RecordErrorFlags,
  source: 'server' | 'client',
  env: ObservabilityEnv,
): boolean {
  if (source !== 'server') return false;
  if (env !== 'production') return false;
  // Broadened threshold: 'error' AND 'critical' page; 'warning'/'info' stay silent.
  if (flags.severity !== 'critical' && flags.severity !== 'error') return false;
  return !!(flags.is_new || flags.became_critical || flags.regressed || flags.reopened);
}

const ALERTS_PER_HOUR_CAP = 5;
const HOUR_MS = 3_600_000;
const sentAt: number[] = [];

/** Per-worker hourly token bucket. Returns false (and logs) when the cap is hit. */
export function takeAlertToken(now: number = Date.now()): boolean {
  while (sentAt.length > 0 && now - sentAt[0] > HOUR_MS) sentAt.shift();
  if (sentAt.length >= ALERTS_PER_HOUR_CAP) return false;
  sentAt.push(now);
  return true;
}

/** Test hook — clears the token bucket between cases. */
export function resetAlertTokens(): void {
  sentAt.length = 0;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function alertTrigger(flags: RecordErrorFlags): string {
  if (flags.became_critical) return 'Issue escalated to critical';
  const noun = flags.severity === 'critical' ? 'critical issue' : 'error';
  if (flags.is_new) return `New ${noun}`;
  if (flags.reopened) return `Resolved ${noun} reopened (regression)`;
  return `Resolved ${noun} recurred (regression)`;
}

/** 🚨 for critical, ⚠️ for error — so the inbox can triage at a glance. */
function alertIcon(flags: RecordErrorFlags): string {
  return flags.severity === 'critical' || flags.became_critical ? '🚨' : '⚠️';
}

function alertHtml(trigger: string, flags: RecordErrorFlags, d: CriticalAlertDetails, link: string): string {
  const row = (label: string, value: string | null | undefined) =>
    value ? `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;">${label}</td><td style="padding:4px 0;">${escapeHtml(value)}</td></tr>` : '';
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#b91c1c;">${alertIcon(flags)} ${escapeHtml(trigger)}</h2>
      <p style="font-size:15px;"><strong>${escapeHtml(d.title)}</strong></p>
      <table style="font-size:14px;border-collapse:collapse;">
        ${row('Error', d.errorName)}
        ${row('Route', d.route ? `${d.method ? `${d.method} ` : ''}${d.route}` : null)}
        ${row('Org', d.orgSlug)}
        ${row('Message', d.message)}
        ${row('Request ID', d.requestId)}
      </table>
      <p style="margin-top:16px;">
        <a href="${link}" style="background:#111;color:#d9f99d;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open issue in platform-admin</a>
      </p>
      <p style="color:#888;font-size:12px;">One alert per distinct issue transition — further occurrences of this issue will not email you. FieldLogicHQ observability.</p>
    </div>`;
}

/**
 * Fire-and-forget: decides, rate-limits, composes, sends. NEVER throws — call as
 * `void maybeSendCriticalAlert(...)` from the capture path.
 */
export async function maybeSendCriticalAlert(
  flags: RecordErrorFlags,
  source: 'server' | 'client',
  env: ObservabilityEnv,
  details: CriticalAlertDetails,
): Promise<void> {
  try {
    if (!shouldAlert(flags, source, env)) return;
    if (!explicitProductionEnv()) {
      // Derived env said production but OBSERVABILITY_ENV isn't explicitly set — treat as a
      // non-prod deploy and stay silent (fail-closed). See explicitProductionEnv().
      console.error('[observability] critical alert suppressed (OBSERVABILITY_ENV not explicitly production)');
      return;
    }
    if (!takeAlertToken()) {
      console.error('[observability] critical alert suppressed (per-worker hourly cap)');
      return;
    }
    const { ADMIN_EMAIL, SITE_URL, sendEmail } = await import('../email');
    const trigger = alertTrigger(flags);
    const link = flags.group_id
      ? `${SITE_URL}/platform-admin/observability/${flags.group_id}`
      : `${SITE_URL}/platform-admin/observability`;
    const subject = `${alertIcon(flags)} ${trigger}: ${details.errorName}${details.route ? ` @ ${details.route}` : ''}`;
    const result = await sendEmail(ADMIN_EMAIL, subject, alertHtml(trigger, flags, details, link));
    if (result.status === 'sent') {
      console.log(`[observability] critical alert emailed to ${ADMIN_EMAIL}: ${trigger} (group ${flags.group_id ?? '?'})`);
    } else {
      console.error(`[observability] critical alert email not delivered (${result.status})`);
    }
  } catch (err) {
    try {
      console.error('[observability] critical alert send swallowed:', err);
    } catch {
      /* noop */
    }
  }
}
