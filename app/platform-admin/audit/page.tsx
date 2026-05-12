import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import styles from './audit.module.css';
import HelpCallout from '@/components/help/HelpCallout';

const PAGE_SIZE = 100;

interface Filters {
  q:      string;
  from:   string;
  to:     string;
  action: string;
  offset: number;
}

async function getAuditLog(f: Filters) {
  let q = supabaseAdmin
    .from('platform_audit_log')
    .select('id, actor_email, org_id, action, field, old_value, new_value, created_at, organizations(id, name)')
    .order('created_at', { ascending: false })
    .range(f.offset, f.offset + PAGE_SIZE - 1);

  if (f.from)   q = q.gte('created_at', f.from);
  if (f.to)     q = q.lte('created_at', f.to + 'T23:59:59');
  if (f.action) q = q.eq('action', f.action);

  const { data, error } = await q;
  if (error || !data) return [];

  let rows = data.map((r: any) => ({
    id:         r.id as string,
    actorEmail: r.actor_email as string,
    orgId:      r.org_id as string | null,
    orgName:    (r.organizations as any)?.name as string | null ?? null,
    action:     r.action as string,
    field:      r.field as string | null,
    oldValue:   r.old_value,
    newValue:   r.new_value,
    createdAt:  r.created_at as string,
  }));

  // Org name/email search is post-filter (names come from join, not indexed)
  if (f.q) {
    const lq = f.q.toLowerCase();
    rows = rows.filter(r =>
      r.orgName?.toLowerCase().includes(lq) ||
      r.actorEmail?.toLowerCase().includes(lq)
    );
  }

  return rows;
}

async function getDistinctActions(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('platform_audit_log')
    .select('action')
    .order('action');
  if (!data) return [];
  return [...new Set(data.map((r: any) => r.action as string))];
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

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; action?: string; offset?: string }>;
}) {
  const sp     = await searchParams;
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10));
  const filters: Filters = {
    q:      sp.q      ?? '',
    from:   sp.from   ?? '',
    to:     sp.to     ?? '',
    action: sp.action ?? '',
    offset,
  };

  const [rows, actions] = await Promise.all([
    getAuditLog(filters),
    getDistinctActions(),
  ]);

  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = offset > 0;

  function pageHref(newOffset: number) {
    const p = new URLSearchParams();
    if (filters.q)      p.set('q',      filters.q);
    if (filters.from)   p.set('from',   filters.from);
    if (filters.to)     p.set('to',     filters.to);
    if (filters.action) p.set('action', filters.action);
    if (newOffset > 0)  p.set('offset', String(newOffset));
    const qs = p.toString();
    return `/platform-admin/audit${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>FieldLogicHQ</div>
        <h1 className={styles.title}>Audit Log</h1>
        <div className={styles.count}>{rows.length} entries</div>
      </header>

      <HelpCallout
        variant="info"
        title="About this log"
        body="The audit log records all consequential admin actions across all orgs. Use the filters to narrow by org, date, or action type. Logs are retained indefinitely."
      />

      {/* Filter bar — native GET form, no JS needed */}
      <form method="GET" action="/platform-admin/audit" className={styles.filterBar}>
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search org or email…"
          className={styles.filterInput}
        />
        <input
          type="date"
          name="from"
          defaultValue={filters.from}
          className={styles.filterDate}
          title="From date"
        />
        <input
          type="date"
          name="to"
          defaultValue={filters.to}
          className={styles.filterDate}
          title="To date"
        />
        <select name="action" defaultValue={filters.action} className={styles.filterSelect}>
          <option value="">All actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <button type="submit" className={styles.filterBtn}>Filter</button>
        {(filters.q || filters.from || filters.to || filters.action) && (
          <Link href="/platform-admin/audit" className={styles.filterClear}>Clear</Link>
        )}
      </form>

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

      {(hasPrev || hasNext) && (
        <div className={styles.pagination}>
          {hasPrev ? (
            <Link href={pageHref(offset - PAGE_SIZE)} className={styles.pageBtn}>← Previous</Link>
          ) : (
            <span className={styles.pageBtnDisabled}>← Previous</span>
          )}
          <span className={styles.pageInfo}>Showing {offset + 1}–{offset + rows.length}</span>
          {hasNext ? (
            <Link href={pageHref(offset + PAGE_SIZE)} className={styles.pageBtn}>Next →</Link>
          ) : (
            <span className={styles.pageBtnDisabled}>Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
