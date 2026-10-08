import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * ONE ROW IN AN ORGANIZATION'S AUDIT LOG (`org_audit_log`) — awaited, and never thrown.
 *
 * ⚠ AWAIT IT. A Supabase query builder sends nothing until something calls its `.then()`, which is
 * what `await` does. The member routes wrote `void supabaseAdmin.from('org_audit_log').insert(…)`,
 * which built the request and threw it away: from the day those routes were written until
 * 2026-10-08, no invite, removal, role change, access change, suspension or Rep Teams group change
 * reached any organization's log, and Members › Audit log never showed one. Even a request that has
 * started can be dropped when the server freezes the worker after the response, so a fire-and-forget
 * write is not a log. (`tests/unit/no-unsent-db-writes.test.ts` refuses the `void …from(` shape.)
 *
 * A failed write is logged and swallowed: the change it records has already happened, and a log row
 * must never turn a successful change into an error for the person who made it.
 */
export async function writeOrgAudit(
  orgId: string,
  actorId: string | null,
  targetId: string | null,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('org_audit_log').insert({
      org_id: orgId,
      actor_id: actorId,
      target_id: targetId,
      action,
      payload,
    });
    if (error) console.error(`[org-audit] ${action} not written:`, error.message);
  } catch (e) {
    // The message only — the payload holds emails and access maps, and a thrown error can carry the body.
    console.error(`[org-audit] ${action} not written:`, e instanceof Error ? e.message : String(e));
  }
}
