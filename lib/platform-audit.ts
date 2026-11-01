import { supabaseAdmin } from './supabase-admin';
import { HttpError } from './http-error';

/**
 * Why a staff member made the change, in the audit log's own column (R4; owner Q6 2026-10-26). Required on every staff
 * change to a customer's club, person, plan, money or retention: the route refuses a blank one before it writes. The
 * product's own jobs and the console's work tools (notes, decks, triage) pass none —
 * `tests/unit/platform-audit-reason-guard.test.ts` holds that list. Never put the reason inside `newValue` as well.
 */
export type AuditOptions = { reason?: string | null };

function auditRow(actorEmail: string, orgId: string | null, action: string, field: string | undefined,
  oldValue: unknown, newValue: unknown, opts: AuditOptions | undefined) {
  const reason = typeof opts?.reason === 'string' ? opts.reason.trim() : '';
  return {
    actor_email: actorEmail,
    org_id:      orgId ?? null,
    action,
    field:       field     ?? null,
    old_value:   oldValue  !== undefined ? oldValue  : null,
    new_value:   newValue  !== undefined ? newValue  : null,
    reason:      reason || null,
  };
}

/** The console's audit write. Best-effort: a failed write is logged and never blocks the change it records. */
export async function writePlatformAuditLog(
  actorEmail: string,
  orgId: string | null,
  action: string,
  field?: string,
  oldValue?: unknown,
  newValue?: unknown,
  opts?: AuditOptions,
) {
  const { error } = await supabaseAdmin.from('platform_audit_log').insert(auditRow(actorEmail, orgId, action, field, oldValue, newValue, opts));
  if (error) {
    console.error('[platform-audit] write error:', error);
  }
}

/** The same write, but it throws: for a money write whose record must exist (a refund, Stage 3 threat T10). */
export async function writePlatformAuditLogStrict(
  actorEmail: string,
  orgId: string | null,
  action: string,
  field: string | undefined,
  oldValue: unknown,
  newValue: unknown,
  opts: AuditOptions,
): Promise<void> {
  const { error } = await supabaseAdmin.from('platform_audit_log').insert(auditRow(actorEmail, orgId, action, field, oldValue, newValue, opts));
  if (error) throw new Error(`platform audit write failed: ${error.code ?? 'unknown'}`);
}

/** What staff read when a money change was refused because its change-log row could not be written first. */
export const AUDIT_FIRST_REFUSAL = 'The change log could not be written, so nothing was changed. Try again.';

/**
 * The change was not made: its row could not be written first. An `HttpError`, so `withObservability` answers it (503, the
 * refusal) wherever it is thrown and no route can forget to; a route that catches everything rethrows it (`isHttpError`).
 */
export class AuditFirstError extends HttpError {
  readonly status = 503;
  constructor() { super(AUDIT_FIRST_REFUSAL); }
  body() { return { error: AUDIT_FIRST_REFUSAL }; }
}

/** The suffix of the row that says a change whose row was written first did not then happen. */
export const FAILED_SUFFIX = '_failed';

const messageOf = (failure: unknown): string => {
  if (failure instanceof Error) return failure.message;
  const message = (failure as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : String(failure);
};

/**
 * A staff change that moves money or what a customer is charged (Plans & pricing Stage 0, Part 9, the refund pattern): the
 * row naming it, with its reason, is written BEFORE the change and strictly. When it cannot be written this throws
 * `AuditFirstError` and the caller makes no change. It returns the call that records a change that then failed: a second
 * row, `<action>_failed`, naming the first by id (best-effort: the first already holds who, what and why), so no reader
 * shows a change that never happened (`withoutFailedChanges`). `tests/unit/platform-audit-money-first.test.ts` lists the actions.
 */
export async function writeAuditBeforeChange(
  actorEmail: string,
  orgId: string | null,
  action: string,
  field: string | undefined,
  oldValue: unknown,
  newValue: unknown,
  opts: AuditOptions,
): Promise<(error: unknown) => Promise<void>> {
  const { data, error } = await supabaseAdmin.from('platform_audit_log')
    .insert(auditRow(actorEmail, orgId, action, field, oldValue, newValue, opts)).select('id').single<{ id: string }>();
  if (error || !data) {
    console.error('[platform-audit] a money change was refused, its row could not be written first:', action, error?.code ?? 'no row');
    throw new AuditFirstError();
  }
  return async (failure: unknown) => {
    await writePlatformAuditLog(actorEmail, orgId, `${action}${FAILED_SUFFIX}`, field, null,
      { failedEntryId: data.id, error: messageOf(failure).slice(0, 300) }, opts);
  };
}

/**
 * `writeAuditBeforeChange` for a write that answers `{ ok, status, error }` rather than throwing: the refusal staff read
 * when the row could not be written, or the call that records a change that then failed.
 */
export async function auditFirst(...args: Parameters<typeof writeAuditBeforeChange>):
  Promise<{ ok: true; failed: (error: unknown) => Promise<void> } | { ok: false; status: number; error: string }> {
  try {
    return { ok: true, failed: await writeAuditBeforeChange(...args) };
  } catch (err) {
    if (err instanceof AuditFirstError) return { ok: false, status: err.status, error: AUDIT_FIRST_REFUSAL };
    throw err;
  }
}

type AuditRowLike = { id: string | number; action: string; new_value: unknown };

/** The id of the row a `<action>_failed` row says did not happen, or null for any other row. */
export function failedEntryOf(row: Pick<AuditRowLike, 'action' | 'new_value'>): string | null {
  if (!row.action.endsWith(FAILED_SUFFIX)) return null;
  const id = (row.new_value as { failedEntryId?: unknown } | null)?.failedEntryId;
  return typeof id === 'string' ? id : null;
}

/** The ids of rows written first whose change then failed. */
export function failedAuditIds(rows: ReadonlyArray<Pick<AuditRowLike, 'action' | 'new_value'>>): Set<string> {
  return new Set(rows.map(failedEntryOf).filter((id): id is string => id !== null));
}

/**
 * What happened, for a reader that tells it (the Story, "someone changed it"): a change whose row was written first and
 * then failed is left out, and so is the row saying it failed. The audit page keeps both and marks them instead.
 */
export function withoutFailedChanges<T extends AuditRowLike>(rows: readonly T[]): T[] {
  const failed = failedAuditIds(rows);
  return rows.filter(r => !failed.has(String(r.id)) && failedEntryOf(r) === null);
}

/** The action a `<action>_failed` row is about, for the lookups keyed by action (labels, doors). */
export function baseAction(action: string): string {
  return action.endsWith(FAILED_SUFFIX) ? action.slice(0, -FAILED_SUFFIX.length) : action;
}
