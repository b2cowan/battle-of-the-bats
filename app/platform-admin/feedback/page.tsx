import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { consoleWhen } from '@/lib/console-dates';
import FeedbackTable, { type FeedbackListRow } from './FeedbackTable';
import FeedbackExportClient from './FeedbackExportClient';
import { cap } from '../chips';
import kit from '../console.module.css';

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
  user_id: string | null;
  user_email: string | null;
  submitter_name: string | null;
  type: string;
  category: string | null;
  title: string | null;
  body: string;
  status: string;
  severity: string | null;
  context: Record<string, unknown> | null;
  escalated_at: string | null;
  created_at: string;
  organizations: { id: string; name: string } | { id: string; name: string }[] | null;
};

function orgFromJoin(value: FeedbackRow['organizations']) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function getRows(f: Filters): Promise<FeedbackRow[]> {
  let q = supabaseAdmin
    .from('feedback_submissions')
    .select(
      'id, org_id, user_id, user_email, submitter_name, type, category, title, body, status, severity, context, escalated_at, created_at, organizations(id, name)',
    )
    .order('created_at', { ascending: false })
    .range(f.offset, f.offset + PAGE_SIZE - 1);

  if (f.type) q = q.eq('type', f.type);
  if (f.category) q = q.eq('category', f.category);
  // `escalated` is a synthetic status that filters on the escalation flag, not the status column
  // (an escalated item keeps its own new/triaged/… status). `all` = no status filter.
  if (f.status === 'escalated') q = q.not('escalated_at', 'is', null);
  else if (f.status && f.status !== 'all') q = q.eq('status', f.status);

  const { data, error } = await q;
  if (error || !data) return [];
  return data as FeedbackRow[];
}

/** The newest SENT reply's time for each feedback item on the page, in one query ("Replied" column). */
async function getLastReplies(rows: FeedbackRow[]): Promise<Map<string, string>> {
  const ids = rows.map(r => r.id);
  if (ids.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from('platform_feedback_replies')
    .select('feedback_id, created_at, finished_at')
    .in('feedback_id', ids)
    .eq('status', 'sent')
    .order('created_at', { ascending: false });
  const map = new Map<string, string>();
  for (const r of (data ?? []) as { feedback_id: string; created_at: string; finished_at: string | null }[]) {
    if (!map.has(r.feedback_id)) map.set(r.feedback_id, r.finished_at ?? r.created_at);
  }
  return map;
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
  await requirePlatformAreaView('feedback');

  const sp = await searchParams;
  const offset = Math.max(0, parseInt(sp.offset ?? '0', 10));
  const filters: Filters = {
    type: sp.type ?? '',
    category: sp.category ?? '',
    // Default to the actionable view (New) on a bare visit; the "All statuses"
    // option submits `status=all` (a non-empty token so it survives buildHref),
    // which getRows treats as no status filter.
    status: sp.status ?? 'new',
    offset,
  };

  const rows = await getRows(filters);
  const lastReplies = await getLastReplies(rows);
  const listRows: FeedbackListRow[] = rows.map(row => {
    const org = orgFromJoin(row.organizations);
    const repliedAt = lastReplies.get(row.id);
    return {
      id: row.id,
      when: consoleWhen(row.created_at),
      type: row.type,
      category: row.category,
      org: row.org_id && org ? { id: row.org_id, name: org.name } : null,
      from: row.user_id ? { name: row.submitter_name || row.user_email || 'Signed-in user', href: `/platform-admin/customer-users/${row.user_id}` } : null,
      title: row.title || row.body.slice(0, 80),
      status: row.status,
      escalated: !!row.escalated_at,
      replied: repliedAt
        ? { text: consoleWhen(repliedAt), quiet: false }
        : { text: row.user_id && row.user_email ? 'Not yet' : 'No address', quiet: true },
    };
  });

  const hasNext = rows.length === PAGE_SIZE;
  const hasPrev = offset > 0;

  return (
    <div className={kit.page}>
      <AdminPageHeader title="Feedback" />

      <div className={kit.card}>
        <form method="GET" action="/platform-admin/feedback" className={kit.toolbar}>
          <span className={kit.count}>{rows.length} shown</span>
          <select name="type" defaultValue={filters.type} className={kit.select} aria-label="Type">
            <option value="">All types</option>
            {TYPES.map(t => <option key={t} value={t}>{cap(t)}</option>)}
          </select>
          <select name="category" defaultValue={filters.category} className={kit.select} aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="status" defaultValue={filters.status} className={kit.select} aria-label="Status">
            <option value="all">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
            <option value="escalated">Escalated</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm">Filter</button>
          {(filters.type || filters.category || filters.status !== 'all') && (
            // status=all widens to every status (and clears type/category); a bare URL would re-apply New.
            <Link href="/platform-admin/feedback?status=all" className={kit.door}>Clear</Link>
          )}
          <span className={kit.toolbarEnd}>
            <FeedbackExportClient type={filters.type} category={filters.category} status={filters.status} />
          </span>
        </form>

        <FeedbackTable rows={listRows} />

        {(hasPrev || hasNext) && (
          <div className={kit.foot}>
            <span className={kit.countQuiet}>Showing {offset + 1}-{offset + rows.length}</span>
            <span className={kit.toolbarEnd}>
              {hasPrev ? (
                <Link href={buildHref(filters, { offset: offset - PAGE_SIZE })} className="btn btn-secondary btn-sm">Previous</Link>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" disabled>Previous</button>
              )}
              {hasNext ? (
                <Link href={buildHref(filters, { offset: offset + PAGE_SIZE })} className="btn btn-secondary btn-sm">Next</Link>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" disabled>Next</button>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
