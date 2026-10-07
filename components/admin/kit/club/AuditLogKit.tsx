'use client';
/**
 * THE AUDIT LOG on the kit — "who changed what about the board" (Club Tier Stage 1, specimen 11).
 *
 *   Four columns that read as a sentence: when · who · what happened · to whom. Times in the house
 *   clock ("Today, 9:14 a.m.", "Sep 24, 7:42 p.m.") in the organization's zone. The same six kinds of
 *   member change the log already records (plus a Rep Teams group change), the same export, still
 *   owner-only. The page names the organization when it asks (A04), and the rail links here (H08).
 *
 *   ⚠ HONEST STATES: a failed load says "The audit log didn't load. Try again." — and "No member
 *   changes yet" appears ONLY after a read that actually succeeded (today's page printed "No audit
 *   events recorded yet." under an Unauthorized error for months).
 *
 * Deliberately NOT added (specimen 11): filters, search, or events beyond member changes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { isTournamentTier } from '@/lib/billing-urls';
import { formatTime } from '@/lib/utils';
import { formatStoredDate, orgDayKey, tournamentToday, utcToZonedInputs } from '@/lib/timezone';
import {
  downloadXLSX, generateCSV, downloadCSVBlob, buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import ck from './ClubKit.module.css';
import styles from './AuditLog.module.css';

interface AuditRow extends Record<string, unknown> {
  id: string;
  action: string;
  actionLabel: string;
  actorEmail: string;
  targetEmail: string;
  details: string;
  createdAt: string;
  actorName?: string | null;
  targetName?: string | null;
  sentence?: string;
}
interface AuditPage { rows: AuditRow[]; total: number; page: number; pageSize: number }

// The same export the page always had (specimen 11: "same export").
const EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Timestamp',   key: 'createdAt',   format: 'text' },
  { label: 'Action',      key: 'actionLabel', format: 'text' },
  { label: 'Actor Email', key: 'actorEmail',  format: 'text' },
  { label: 'Target',      key: 'targetEmail', format: 'text' },
  { label: 'Details',     key: 'details',     format: 'text' },
];

/** "Today, 9:14 a.m." / "Sep 24, 7:42 p.m." — the org's day and the house clock. */
export function auditWhen(iso: string, today: string = tournamentToday()): string {
  const day = orgDayKey(iso) === today ? 'Today' : formatStoredDate(iso, { withYear: false });
  return `${day}, ${formatTime(utcToZonedInputs(iso).time)}`;
}

export default function AuditLogKit() {
  const { currentOrg, userRole, loading } = useOrg();
  usePageTitle('Audit log');
  const slug = currentOrg?.slug ?? '';
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data: AuditPage | null }>({ status: 'loading', data: null });

  // Only the latest page read paints — two quick clicks must not leave the pager on the older answer.
  const readGen = useRef(0);
  const load = useCallback(async (p: number) => {
    if (!slug) return;
    const gen = ++readGen.current;
    setState(prev => ({ status: 'loading', data: prev.data }));
    try {
      const res = await fetch(`/api/admin/members/audit?scope=members&page=${p}&orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json() as AuditPage;
      if (gen === readGen.current) setState({ status: 'ready', data });
    } catch {
      if (gen === readGen.current) setState({ status: 'error', data: null });
    }
  }, [slug]);

  useEffect(() => {
    if (userRole === 'owner') void load(page);
  }, [load, page, userRole]);

  if (loading || !currentOrg || !userRole) return <div className={ck.loading}>Loading…</div>;

  const eyebrow = isTournamentTier(currentOrg.planId) ? 'Tournament settings' : 'Organization';
  const membersHref = isTournamentTier(currentOrg.planId)
    ? `/${slug}/admin/tournaments/settings/members`
    : `/${slug}/admin/org/members`;

  if (userRole !== 'owner') {
    return (
      <div className={ck.page}>
        <AdminPageHeader eyebrow={eyebrow} title="Audit log" backTo={{ href: membersHref, label: 'Members' }} />
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>The audit log is the owner’s</h2>
          <p className={styles.emptyBody}>Only the organization’s owner can read who changed what about the board.</p>
        </div>
      </div>
    );
  }

  const { status, data } = state;
  const rows = data?.rows ?? [];
  const from = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const to = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const today = tournamentToday();

  // The export says what the screen says: the sentence, not the route's raw action key (a Rep Teams
  // group change has no legacy label and exported as "rep_group_scope_changed" — /review 2026-09-26).
  const exportRows = () => rows.map(r => ({
    ...r,
    createdAt: auditWhen(r.createdAt, today),
    actionLabel: r.sentence ?? r.actionLabel,
    actorEmail: r.actorName ? `${r.actorName} (${r.actorEmail})` : r.actorEmail,
    targetEmail: r.targetName ? `${r.targetName} (${r.targetEmail})` : r.targetEmail,
  }));
  const handleExportXLSX = () => downloadXLSX(
    buildFilename({ org: slug, dataset: 'member-audit' }, 'xlsx'),
    serializeHeaders(EXPORT_COLS), serializeRows(exportRows(), EXPORT_COLS), 'Audit Log');
  const handleExportCSV = () => downloadCSVBlob(
    buildFilename({ org: slug, dataset: 'member-audit' }, 'csv'),
    generateCSV(serializeHeaders(EXPORT_COLS), serializeRows(exportRows(), EXPORT_COLS)));

  return (
    <div className={ck.pageWide}>
      <AdminPageHeader
        eyebrow={eyebrow}
        title="Audit log"
        backTo={{ href: membersHref, label: 'Members' }}
        actions={
          <ExportMenu
            formats={['xlsx', 'csv']}
            onExportXLSX={handleExportXLSX}
            onExportCSV={handleExportCSV}
            disabled={rows.length === 0}
            planId={currentOrg.planId}
          />
        }
      />

      {status === 'error' ? (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>
            The audit log didn’t load.{' '}
            <button type="button" className={ck.link} onClick={() => void load(page)}>Try again</button>
          </div>
        </div>
      ) : status === 'loading' && !data ? (
        <div className={ck.loading}>Loading…</div>
      ) : rows.length === 0 ? (
        <p className={styles.none}>No member changes yet.</p>
      ) : (
        <>
          <div className={`${ck.tableFrame} ${styles.desk}`}>
            <table className={ck.table}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What happened</th>
                  <th scope="col">To</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className={styles.when}>{auditWhen(r.createdAt, today)}</td>
                    <td className={ck.cellTitle}>{r.actorName || r.actorEmail}</td>
                    <td>{r.sentence ?? r.actionLabel}</td>
                    <td>{r.targetName || r.targetEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`${ck.list} ${styles.phone}`}>
            {rows.map(r => (
              <div key={r.id} className={ck.row}>
                <span className={ck.rowMain}>
                  <span className={ck.rowTitle}>{r.sentence ?? r.actionLabel} · {r.targetName || r.targetEmail}</span>
                  <span className={ck.rowSub}>{auditWhen(r.createdAt, today)} · {r.actorName || r.actorEmail}</span>
                </span>
              </div>
            ))}
          </div>
          <div className={styles.pager}>
            <span className={ck.muted}>{from}–{to} of {data?.total} change{data?.total === 1 ? '' : 's'}</span>
            <span className={styles.pagerButtons}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1 || status === 'loading'}>
                <ChevronLeft size={14} aria-hidden /> Newer
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages || status === 'loading'}>
                Older <ChevronRight size={14} aria-hidden />
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
