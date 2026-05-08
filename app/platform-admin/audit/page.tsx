import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import styles from './audit.module.css';

async function getAuditLog() {
  const { data, error } = await supabaseAdmin
    .from('platform_audit_log')
    .select('id, actor_email, org_id, action, field, old_value, new_value, created_at, organizations(id, name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return data.map((r: any) => ({
    id:         r.id as string,
    actorEmail: r.actor_email as string,
    orgId:      r.org_id as string | null,
    orgName:    r.organizations?.name as string | null ?? null,
    action:     r.action as string,
    field:      r.field as string | null,
    oldValue:   r.old_value,
    newValue:   r.new_value,
    createdAt:  r.created_at as string,
  }));
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? s.slice(0, 80) + '…' : s;
}

export default async function AuditLogPage() {
  const rows = await getAuditLog();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>Audit Log</h1>
        <div className={styles.count}>{rows.length} entries</div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Superuser</th>
              <th>Org</th>
              <th>Action</th>
              <th>Field</th>
              <th>Old Value</th>
              <th>New Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>No audit entries found.</td>
              </tr>
            )}
            {rows.map(row => (
              <tr key={row.id}>
                <td className={styles.tsCell}>{fmtDateTime(row.createdAt)}</td>
                <td className={styles.emailCell}>{row.actorEmail}</td>
                <td>
                  {row.orgId && row.orgName ? (
                    <Link href={`/platform-admin/orgs/${row.orgId}`} className={styles.orgLink}>
                      {row.orgName}
                    </Link>
                  ) : (
                    <span className={styles.dimText}>—</span>
                  )}
                </td>
                <td className={styles.actionCell}>{row.action}</td>
                <td className={styles.dimText}>{row.field ?? '—'}</td>
                <td><span className={styles.valueCell} title={JSON.stringify(row.oldValue)}>{fmtValue(row.oldValue)}</span></td>
                <td><span className={styles.valueCell} title={JSON.stringify(row.newValue)}>{fmtValue(row.newValue)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
