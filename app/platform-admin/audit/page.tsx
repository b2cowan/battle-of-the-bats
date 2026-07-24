import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import styles from './audit.module.css';
import HelpCallout from '@/components/help/HelpCallout';
import AuditExportClient from './AuditExportClient';

const PAGE_SIZE = 100;

interface Filters {
  q: string;
  from: string;
  to: string;
  action: string;
  orgId: string;
  offset: number;
}

type AuditLogRow = {
  id: string;
  actor_email: string;
  org_id: string | null;
  action: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
};

type AuditActionRow = {
  action: string;
};

const ACTION_LABELS: Record<string, string> = {
  bulk_create_override: 'Bulk Create Override',
  bulk_update_addons: 'Bulk Update Add-ons',
  bulk_update_org_plan_and_limit: 'Bulk Update Plan And Limit',
  create_internal_note: 'Create Internal Note',
  delete_internal_note: 'Delete Internal Note',
  extend_billing_retention: 'Extend Billing Retention',
  generate_reset_link: 'Send Password Reset Email',
  invite_platform_user: 'Invite Platform User',
  remove_platform_user: 'Remove Platform User',
  revoke_override: 'Revoke Override',
  run_bulk_operation: 'Run Bulk Operation',
  update_addons: 'Update Add-ons',
  update_early_access_lead: 'Update Early Access Lead',
  update_feedback_status: 'Update Feedback Status',
  update_internal_note: 'Update Internal Note',
  update_org_identity: 'Update Organization Identity',
  update_org_plan_and_limit: 'Update Plan And Limit',
  update_plan: 'Update Plan Field',
  update_plan_config: 'Update Plan Config',
  update_plan_gating: 'Update Plan Availability',
  update_platform_user: 'Update Platform User',
  update_stripe_price_id: 'Update Stripe Price ID',
};

function actionLabel(action: string) {
  // Curated label when we have one; otherwise a clean Title Case fallback (never the raw snake_case key).
  return ACTION_LABELS[action]
    ?? action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function orgNameFromJoin(value: AuditLogRow['organizations']) {
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value?.name ?? null;
}

async function getAuditLog(f: Filters) {
  let q = supabaseAdmin
    .from('platform_audit_log')
    .select('id, actor_email, org_id, action, field, old_value, new_value, created_at, organizations(id, name)')
    .order('created_at', { ascending: false })
    .range(f.offset, f.offset + PAGE_SIZE - 1);

  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lte('created_at', f.to + 'T23:59:59');
  if (f.action) q = q.eq('action', f.action);
  if (f.orgId) q = q.eq('org_id', f.orgId);

  const { data, error } = await q;
  if (error || !data) return [];

  let rows = ((data ?? []) as AuditLogRow[]).map(r => ({
    id: r.id as string,
    actorEmail: r.actor_email as string,
    orgId: r.org_id as string | null,
    orgName: orgNameFromJoin(r.organizations),
    action: r.action as string,
    field: r.field as string | null,
    oldValue: r.old_value,
    newValue: r.new_value,
    createdAt: r.created_at as string,
  }));

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
  return [...new Set(((data ?? []) as AuditActionRow[]).map(r => r.action))];
}

// Intentional local exception to the shared lib/format-date.ts helpers: the
// audit log keeps SECOND-level precision (forensic accuracy) which the shared
// fmtAbsoluteDateTime deliberately omits. Always absolute, never relative.
// Rendered as two stacked lines (date over time) to keep the column narrow.
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}...` : s;
}

function fullValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  return typeof v === 'string' ? v : JSON.stringify(v, null, 2);
}

function buildAuditHref(filters: Filters, extra: Partial<Filters> = {}) {
  const next = { ...filters, ...extra };
  const p = new URLSearchParams();
  if (next.q) p.set('q', next.q);
  if (next.from) p.set('from', next.from);
  if (next.to) p.set('to', next.to);
  if (next.action) p.set('action', next.action);
  if (next.orgId) p.set('orgId', next.orgId);
  if (next.offset > 0) p.set('offset', String(next.offset));
  const qs = p.toString();
  return `/platform-admin/audit${qs ? `?${qs}` : ''}`;
}


export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; action?: string; orgId?: string; offset?: string }>;
}) {
  // Defensive area guard — `audit` is currently visible to every platform role (the layout
  // already enforces the platform-admin session), so this is a no-op today. It future-proofs
  // the page so a later tightening of the access matrix can't silently leave it ungated.
  await requirePlatformAreaView('audit');
  const sp = await searchParams;
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10));
  const filters: Filters = {
    q: sp.q ?? '',
    from: sp.from ?? '',
    to: sp.to ?? '',
    action: sp.action ?? '',
    orgId: sp.orgId ?? '',
    offset,
  };

  const [rows, actions] = await Promise.all([
    getAuditLog(filters),
    getDistinctActions(),
  ]);

  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = offset > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>System</div>
        <h1 className={styles.title}>Audit Log</h1>
        <div className={styles.count}>{rows.length} entries</div>
      </header>

      <HelpCallout
        variant="info"
        title="About this log"
        body="The audit log records all consequential admin actions across all orgs. Use the filters to narrow by org, date, or action type. Logs are retained indefinitely."
      />

      <form method="GET" action="/platform-admin/audit" className={styles.filterBar}>
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search org or email..."
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
          {[...actions]
            .sort((a, b) => actionLabel(a).localeCompare(actionLabel(b)))
            .map(a => (
              <option key={a} value={a}>{actionLabel(a)}</option>
            ))}
        </select>
        {filters.orgId && <input type="hidden" name="orgId" value={filters.orgId} />}
        <button type="submit" className={styles.filterBtn}>Filter</button>
        <AuditExportClient
          q={filters.q}
          from={filters.from}
          to={filters.to}
          action={filters.action}
          orgId={filters.orgId}
        />
        {(filters.q || filters.from || filters.to || filters.action || filters.orgId) && (
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
                <td className={styles.tsCell}>
                  <span className={styles.tsDate}>{fmtDate(row.createdAt)}</span>
                  <span className={styles.tsTime}>{fmtTime(row.createdAt)}</span>
                </td>
                <td className={styles.emailCell}>{row.actorEmail}</td>
                <td>
                  {row.orgId && row.orgName ? (
                    <span className={styles.orgCell}>
                      <Link href={`/platform-admin/orgs/${row.orgId}`} className={styles.orgLink}>
                        {row.orgName}
                      </Link>
                      <Link href={buildAuditHref(filters, { orgId: row.orgId, offset: 0 })} className={styles.orgFilterLink}>
                        Filter
                      </Link>
                    </span>
                  ) : (
                    <span className={styles.dimText}>-</span>
                  )}
                </td>
                <td className={styles.actionCell}>
                  <span>{actionLabel(row.action)}</span>
                  <code>{row.action}</code>
                </td>
                <td className={styles.dimText}>{row.field ?? '-'}</td>
                <td>
                  <details className={styles.valueDetails}>
                    <summary>{fmtValue(row.oldValue)}</summary>
                    <pre>{fullValue(row.oldValue)}</pre>
                  </details>
                </td>
                <td>
                  <details className={styles.valueDetails}>
                    <summary>{fmtValue(row.newValue)}</summary>
                    <pre>{fullValue(row.newValue)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(hasPrev || hasNext) && (
        <div className={styles.pagination}>
          {hasPrev ? (
            <Link href={buildAuditHref(filters, { offset: offset - PAGE_SIZE })} className={styles.pageBtn}>Previous</Link>
          ) : (
            <span className={styles.pageBtnDisabled}>Previous</span>
          )}
          <span className={styles.pageInfo}>Showing {offset + 1}-{offset + rows.length}</span>
          {hasNext ? (
            <Link href={buildAuditHref(filters, { offset: offset + PAGE_SIZE })} className={styles.pageBtn}>Next</Link>
          ) : (
            <span className={styles.pageBtnDisabled}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
