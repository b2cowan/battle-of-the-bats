import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { hasPlatformPower, requirePlatformAreaView } from '@/lib/platform-auth';
import { canViewPlatformArea } from '@/lib/platform-areas';
import { auditDoors, isScheduledEntry } from '@/lib/platform-audit-doors';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import kit from '../console.module.css';
import { humanize } from '../chips';
import styles from './audit.module.css';
import HelpCallout from '@/components/help/HelpCallout';
import AuditExportClient from './AuditExportClient';
import AuditTable, { type AuditRowView } from './AuditTable';
import DateInput from '@/components/shared/DateInput';
import RecordsOpened, { RECORDS_OPENED } from './RecordsOpened';

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
  bulk_create_override: 'Bulk create override',
  bulk_update_addons: 'Bulk update add-ons',
  bulk_update_org_plan_and_limit: 'Bulk update plan and limit',
  create_internal_note: 'Create internal note',
  delete_internal_note: 'Delete internal note',
  extend_billing_retention: 'Extend billing retention',
  generate_reset_link: 'Send password reset email',
  invite_platform_user: 'Invite platform user',
  remove_platform_user: 'Remove platform user',
  revoke_override: 'Revoke override',
  run_bulk_operation: 'Run bulk operation',
  update_addons: 'Update add-ons',
  update_early_access_lead: 'Update early access lead',
  update_feedback_status: 'Update feedback status',
  update_internal_note: 'Update internal note',
  update_org_identity: 'Update organization identity',
  update_org_plan_and_limit: 'Update plan and limit',
  update_plan: 'Update plan field',
  update_plan_config: 'Update plan config',
  update_plan_gating: 'Update plan availability',
  update_platform_user: 'Update platform user',
  update_stripe_price_id: 'Update Stripe price ID',
};

function actionLabel(action: string) {
  // Curated label when we have one; otherwise a clean sentence-case fallback (never the raw snake_case key).
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  return humanize(action);
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
  const auth = await requirePlatformAreaView('audit');
  // The trail of records opened (Support console Stage 2, A3) is Super admin's: the `records_opened` power.
  const readsTrail = hasPlatformPower(auth.role, 'records_opened');
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

  if (readsTrail && filters.action === RECORDS_OPENED) {
    return (
      <div className={kit.page}>
        <AdminPageHeader title="Audit log" />
        <div className={kit.toolbar}>
          <Link href="/platform-admin/audit" className={kit.door}>‹ All changes</Link>
        </div>
        <RecordsOpened offset={offset} pageHref={o => buildAuditHref({ ...filters, q: '', from: '', to: '', orgId: '' }, { offset: o })} />
      </div>
    );
  }

  const [rows, actions] = await Promise.all([
    getAuditLog(filters),
    getDistinctActions(),
  ]);

  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = offset > 0;

  const rowViews: AuditRowView[] = rows.map(row => {
    const scheduled = isScheduledEntry(row.action, row.actorEmail);
    const orgFilterHref = row.orgId && row.orgName ? buildAuditHref(filters, { orgId: row.orgId, offset: 0 }) : null;
    return {
      id: row.id,
      actorEmail: row.actorEmail,
      orgId: row.orgId,
      orgName: row.orgName,
      action: row.action,
      actionLabel: actionLabel(row.action),
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      dateLabel: fmtDate(row.createdAt),
      timeLabel: fmtTime(row.createdAt),
      momentKey: new Date(row.createdAt).toISOString().slice(0, 19),
      orgFilterHref,
      doors: auditDoors({
        action: row.action,
        orgId: row.orgId,
        orgName: row.orgName,
        orgEntriesHref: orgFilterHref ?? buildAuditHref(filters, { offset: 0 }),
        canView: area => canViewPlatformArea(auth.role, area),
        scheduled,
      }),
      scheduled,
    };
  });

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Audit log" />

      <HelpCallout
        variant="info"
        title="About this log"
        body="The audit log records all consequential admin actions across all orgs. Use the filters to narrow by org, date, or action type. Logs are retained indefinitely."
      />

      <section className={kit.section}>
        <div className={kit.card}>
          <div className={kit.toolbar}>
          <span className={kit.count}>{rows.length} entries</span>
          <form method="GET" action="/platform-admin/audit" className={styles.filterForm}>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Search org or email..."
              aria-label="Search org or email"
              className={kit.search}
            />
            <DateInput
              name="from"
              defaultValue={filters.from}
              className={kit.field}
              inline
              title="From date"
              aria-label="From date"
            />
            <DateInput
              name="to"
              defaultValue={filters.to}
              className={kit.field}
              inline
              rangeStart={filters.from || undefined}
              title="To date"
              aria-label="To date"
            />
            <select name="action" defaultValue={filters.action} className={kit.select} aria-label="Action">
              <option value="">All actions</option>
              {readsTrail && <option value={RECORDS_OPENED}>Records opened</option>}
              {[...actions]
                .sort((a, b) => actionLabel(a).localeCompare(actionLabel(b)))
                .map(a => (
                  <option key={a} value={a}>{actionLabel(a)}</option>
                ))}
            </select>
            {filters.orgId && <input type="hidden" name="orgId" value={filters.orgId} />}
            <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
            {(filters.q || filters.from || filters.to || filters.action || filters.orgId) && (
              <Link href="/platform-admin/audit" className={kit.door}>Clear</Link>
            )}
          </form>
          <span className={kit.toolbarEnd}>
            <AuditExportClient
              q={filters.q}
              from={filters.from}
              to={filters.to}
              action={filters.action}
              orgId={filters.orgId}
            />
          </span>
          </div>

          <AuditTable rows={rowViews} />

          {(hasPrev || hasNext) && (
            <div className={styles.pagination}>
              {hasPrev ? (
                <Link href={buildAuditHref(filters, { offset: offset - PAGE_SIZE })} className="btn btn-secondary btn-sm">Previous</Link>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" disabled>Previous</button>
              )}
              <span className={kit.countQuiet}>Showing {offset + 1}-{offset + rows.length}</span>
              {hasNext ? (
                <Link href={buildAuditHref(filters, { offset: offset + PAGE_SIZE })} className="btn btn-secondary btn-sm">Next</Link>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" disabled>Next</button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
