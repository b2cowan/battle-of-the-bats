import { supabaseAdmin } from './supabase-admin';

export async function writePlatformAuditLog(
  actorEmail: string,
  orgId: string | null,
  action: string,
  field?: string,
  oldValue?: unknown,
  newValue?: unknown,
) {
  const { error } = await supabaseAdmin.from('platform_audit_log').insert({
    actor_email: actorEmail,
    org_id:      orgId ?? null,
    action,
    field:       field     ?? null,
    old_value:   oldValue  !== undefined ? oldValue  : null,
    new_value:   newValue  !== undefined ? newValue  : null,
  });
  if (error) {
    console.error('[platform-audit] write error:', error);
  }
}
