import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { isPlatformAreaReadOnly } from '@/lib/platform-areas';
import HelpCallout from '@/components/help/HelpCallout';
import StatusControls from './[id]/StatusControls';
import FeedbackExportClient from './FeedbackExportClient';
import styles from './feedback.module.css';

const PAGE_SIZE = 100;
const TYPES = ['bug', 'feature', 'feedback'] as const;
const CATEGORIES = ['Tournaments', 'Coaches', 'Registrations', 'Accounting', 'Billing', 'Other'] as const;
const STATUSES = ['new', 'triaged', 'acknowledged', 'resolved'] as const;

interface Filters {
  type: string;
  category: string;
  status: string;
  offset: number;
}

type FeedbackRow = {
  id: string;
  org_id: string | null;
  user_email: string | null;
  submitter_name: string | null;
  type: string;
  category: string | null;
  title: string | null;
  body: string;
  status: string;
  severity: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
};

const TYPE_BADGE: Record<string, string> = {
  bug: 'badge-danger',
  feature: 'badge-info',
  feedback: 'badge-neutral',
};
const STATUS_BADGE: Record<string, string> = {
  new: 'badge-warning',
  triaged: 'badge-info',
  acknowledged: 'badge-info',
  resolved: 'badge-success',
};

function orgFromJoin(value: FeedbackRow['organizations']) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function requestIdOf(context: FeedbackRow['context']): string | null {
  if (!context || typeof context !== 'object') return null;
  const v = (context as Record<string, unknown>).requestId;
  return typeof v === 'string' && v ? v : null;
}

async function getRows(f: Filters): Promise<FeedbackRow[]> {
  let q = supabaseAdmin
    .from('feedback_submissions')
    .select(
      'id, org_id, user_email, submitter_name, type, category, title, body, status, severity, context, created_at, organizations(id, name)',
    )
    .order('created_at', { ascending: false })
    .range(f.offset, f.offset + PAGE_SIZE - 1);

  if (f.type) q = q.eq('type', f.type);
  if (f.category) q = q.eq('category', f.category);
  if (f.status) q = q.eq('status', f.status);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as FeedbackRow[];
}

/** Resolve each bug's last-seen requestId → its error_groups id, in one query, for "View related issue". */
async function getIssueLinks(rows: FeedbackRow[]): Promise<Map<string, string>> {
  const reqIds = [...new Set(rows.map(r => requestIdOf(r.context)).filter((v): v is string => !!v))];
  if (reqIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from('error_events')
    .select('request_id, group_id')
    .in('request_id', reqIds);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { request_id: string | null; group_id: string | null }[]) {
    if (row.request_id && row.group_id && !map.has(row.request_id)) map.set(row.request_id, row.group_id);
  }
  return map;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function buildHref(filters: Filters, extra: Partial<Filters> = {}) {
  const next = { ...filters, ...extra };
  const p = new URLSearchParams();
  if (next.type) p.set('type', next.type);
  if (next.category) p.set('category', next.category);
  if (next.status) p.set('status', next.status);
  if (next.offset > 0) p.set('offset', String(next.offset));
  const qs = p.toString();
  return `/platform-admin/feedback${qs ? `?${qs}` : ''}`;
}

export default async function FeedbackTriagePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string; status?: string; offset?: string }>;
}) {
  const auth = await requirePlatformAreaView('observability');
  const readOnly = isPlatformAreaReadOnly(auth.role, 'observability');

  const sp = await searchParams;
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10));
  const filters: Filters = {
    type: sp.type ?? '',
    category: sp.category ?? '',
    status: sp.status ?? '',
    offset,
  };

  const rows = await getRows(filters);
  const issueLinks = await getIssueLinks(rows);

  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = offset > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>System</div>
        <h1 className={styles.title}>Feedback</h1>
        <div className={styles.count}>{rows.length} shown</div>
      </header>

      <HelpCallout
        variant="info"
        title="In-app feedback queue"
        body={`Bug reports, feature requests, and general feedback submitted from inside the app (admin, coach, scorekeeper, and anonymous). Move each item New → Triaged → Acknowledged → Resolved; a bug that hit a captured error shows a link to the related issue. Feedback is retained indefinitely.${readOnly ? ' Status changes require product access — contact a product operator to triage or resolve items.' : ''}`}
      />

      <form method="GET" action="/platform-admin/feedback" className={styles.filterBar}>
        <select name="type" defaultValue={filters.type} className={styles.filterSelect}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="category" defaultValue={filters.category} className={styles.filterSelect}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="status" defaultValue={filters.status} className={styles.filterSelect}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit" className={styles.filterBtn}>Filter</button>
        <FeedbackExportClient type={filters.type} category={filters.category} status={filters.status} />
        {(filters.type || filters.category || filters.status) && (
          <Link href="/platform-admin/feedback" className={styles.filterClear}>Clear</Link>
        )}
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Org</th>
              <th>From</th>
              <th>Title / Body</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className={styles.emptyCell}>No feedback found.</td></tr>
            )}
            {rows.map(row => {
              const org = orgFromJoin(row.organizations);
              const reqId = requestIdOf(row.context);
              const groupId = reqId ? issueLinks.get(reqId) : undefined;
              return (
                <tr key={row.id}>
                  <td className={styles.tsCell}>{fmtDateTime(row.created_at)}</td>
                  <td>
                    <span className={`badge ${TYPE_BADGE[row.type] ?? 'badge-neutral'}`}>{row.type}</span>
                  </td>
                  <td className={styles.dimText}>{row.category ?? '—'}</td>
                  <td>
                    {row.org_id && org ? (
                      <Link href={`/platform-admin/orgs/${row.org_id}`} className={styles.orgLink}>{org.name}</Link>
                    ) : (
                      <span className={styles.dimText}>Platform / anonymous</span>
                    )}
                  </td>
                  <td className={styles.emailCell}>{row.user_email ?? row.submitter_name ?? '—'}</td>
                  <td>
                    <details className={styles.bodyDetails}>
                      <summary>{row.title ?? row.body.slice(0, 80)}</summary>
                      <pre>{row.body}</pre>
                      {groupId && (
                        <Link href={`/platform-admin/observability/${groupId}`} className={styles.issueLink}>
                          View related issue →
                        </Link>
                      )}
                    </details>
                  </td>
                  <td>
                    {readOnly ? (
                      <span className={`badge ${STATUS_BADGE[row.status] ?? 'badge-neutral'}`}>{row.status}</span>
                    ) : (
                      <StatusControls id={row.id} currentStatus={row.status} readOnly={readOnly} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(hasPrev || hasNext) && (
        <div className={styles.pagination}>
          {hasPrev ? (
            <Link href={buildHref(filters, { offset: offset - PAGE_SIZE })} className={styles.pageBtn}>Previous</Link>
          ) : (
            <span className={styles.pageBtnDisabled}>Previous</span>
          )}
          <span className={styles.pageInfo}>Showing {offset + 1}-{offset + rows.length}</span>
          {hasNext ? (
            <Link href={buildHref(filters, { offset: offset + PAGE_SIZE })} className={styles.pageBtn}>Next</Link>
          ) : (
            <span className={styles.pageBtnDisabled}>Next</span>
          )}
        </div>
      )}
    </div>
  );
}
