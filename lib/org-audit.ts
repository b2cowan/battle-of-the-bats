import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { writeOrReport } from './observability/report-unwritten';

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
 * A failed write is swallowed: the change it records has already happened, and a log row must never
 * turn a successful change into an error for the person who made it. It opens an issue instead
 * (`writeOrReport`, which keeps the payload out: it holds emails and access maps). Every product
 * writer of this table goes through here (`tests/unit/org-audit-failure-reported.test.ts`).
 */
export async function writeOrgAudit(
  orgId: string,
  actorId: string | null,
  targetId: string | null,
  action: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await writeOrReport('org_audit_log', action, orgId, () => supabaseAdmin.from('org_audit_log').insert({
    org_id: orgId,
    actor_id: actorId,
    target_id: targetId,
    action,
    payload,
  }));
}
