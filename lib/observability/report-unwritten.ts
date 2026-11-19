/**
 * A RECORD LINE THAT FAILED TO SAVE OPENS AN ISSUE (Board Ready leftover call 17, owner 2026-11-19).
 *
 * The record writers (a club's activity record, the platform's audit log, the platform's event log) swallow a failed
 * write by design: the change they record has already happened, and a log line must never turn it into an error for the
 * person who made it. On production their console line reaches no one, so a missing line went unnoticed. They call
 * this instead, which logs the line AND opens (or counts against) one issue in the platform's feed.
 *
 * WHAT GOES OUT: the record's name, the action, the line's org id (in the context) and a short cause (a database error
 * CODE such as 23503, or 'thrown') — NEVER the row's payload and never an error's message or body, which can quote the
 * row (emails, access maps, money). The console line keeps the message only, as before. The feed's usual attribution
 * (route, who was signed in) is added by captureError from the request, as on every issue.
 *
 * THE LINE'S CLUB RIDES IN THE CONTEXT, not as the issue's org: error_events.org_id is a foreign key, so a line that
 * failed because its club is wrong or gone would sink its own report (proved on dev 2026-11-19). The issue's org is the
 * request's, as on every issue. (The general fix is in record_error_event: drop an unknown org id instead of failing.
 * That is shared observability work, recorded as a follow-up, not done here.)
 *
 * GROUPING: the stack is synthetic, so the issue groups by route + record + action (fingerprint = route + name + top
 * frames). The stored "stack" is therefore not a call site; the route and the action find it.
 *
 * BOUNDED: captureError never throws, but it awaits the database and, on a first occurrence, the alert email — either
 * can stall when the database is the reason the line failed. The caller stops waiting after REPORT_WAIT_MS and the report
 * carries on in the background. That knowingly accepts the risk capture.ts rejects for its own alert (a detached promise
 * can be frozen on Lambda) because these lines sit on SUCCESS paths. After one report hits the bound, later ones within
 * SLOW_FOR_MS don't wait at all, so a request writing many lines in an outage (or a sign-in) pays the bound once.
 *
 * NO STATIC IMPORTS, on purpose: the writers are loaded by plain-node tests and jobs, and capture's graph reaches a
 * `server-only` module. The reporter is loaded only when a line has failed (as alerts.ts loads email).
 */

export const REPORT_WAIT_MS = 2000;
const SLOW_FOR_MS = 60_000;
let slowUntil = 0;

const RECORDS = {
  org_audit_log: 'Activity record line',
  platform_audit_log: 'Platform audit line',
  platform_events: 'Platform event',
} as const;

export type UnwrittenRecord = keyof typeof RECORDS;

/** A database error's code, or 'thrown' — the only cause that leaves the server log. */
function causeOf(failure: unknown): string {
  // Only the SHAPE of a code (a SQLSTATE, a Node errno): a library's `.code` can be free text.
  if (failure && typeof failure === 'object' && 'code' in failure && typeof failure.code === 'string' && /^[A-Z0-9_]{1,20}$/.test(failure.code)) return failure.code;
  return failure instanceof Error ? 'thrown' : 'unknown';
}

/** `failure` is the database's returned error or what was thrown. Only its code leaves the server log. */
export async function reportUnwritten(record: UnwrittenRecord, action: string, orgId: string | null, failure: unknown): Promise<void> {
  // The writers call this outside their own try and promise "never thrown": nothing in here may escape.
  try {
    await logAndReport(record, action, orgId, failure);
  } catch {
    try { console.error(`[report-unwritten] ${record} ${action}: the report failed`); } catch { /* noop */ }
  }
}

async function logAndReport(record: UnwrittenRecord, action: string, orgId: string | null, failure: unknown): Promise<void> {
  try {
    const message = failure && typeof failure === 'object' && 'message' in failure ? String(failure.message) : String(failure);
    console.error(`[${record}] ${action} not written:`, message);
  } catch {
    console.error(`[${record}] ${action} not written`);
  }

  const title = `${RECORDS[record]} not written: ${action}`;
  const err = new Error(title);
  err.name = 'RecordNotWritten';
  err.stack = `${err.name}: ${title}\n    at ${record}.${action}`;
  const sent = import('./capture')
    .then(({ captureError }) => captureError(err, {
      severity: 'error',
      title,
      // A side issue: a request that then returns a 5xx of its own must still get that issue from the safety net.
      marksRequestCaptured: false,
      requestContext: { record, action, orgId, cause: causeOf(failure) },
    }))
    .catch(e => { console.error('[report-unwritten] the report could not be sent:', e instanceof Error ? e.message : String(e)); });
  if (Date.now() < slowUntil) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = await Promise.race([
    sent.then(() => false),
    new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(true), REPORT_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  if (timedOut) slowUntil = Date.now() + SLOW_FOR_MS;
}
