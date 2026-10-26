import { supabaseAdmin } from './supabase-admin';

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
