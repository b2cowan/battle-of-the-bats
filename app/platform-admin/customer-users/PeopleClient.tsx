'use client';
/**
 * People — every customer account, a list that stays beside Find (Support console Stage 2, owner ruling A8).
 *
 * Find answers "this customer"; a list answers "everyone who never confirmed" or "everyone who signed up this week".
 * Server-paged through the sign-in lookup, with no 1,000 cap; the search goes in a POST body, never the address. Each row
 * opens the person record, which is where a person's actions now live (the row's action menu went with it). Staff accounts
 * are not customers and are left out, as before.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ExportMenu from '@/components/admin/ExportMenu';
import HelpCallout from '@/components/help/HelpCallout';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { PLAN_CONFIG } from '@/lib/plan-config';
import {
  downloadXLSX, generateCSV, downloadCSVBlob,
  buildFilename, serializeRows, serializeHeaders, type ExportColumnDef,
} from '@/lib/export';
import { takeListSearch } from '@/lib/console-recent';
import { consoleDate } from '@/lib/console-dates';
import kit from '../console.module.css';
import { humanize } from '../chips';
import styles from './customer-users.module.css';
import type { PeopleRow } from './people-rows';

// ── Export (dataset unchanged: the Export registry proves it against this code) ──────────────────────────────────────
const CUSTOMER_USERS_EXPORT_COLS: ExportColumnDef[] = [
  { label: 'Email',        key: 'email',       format: 'text' },
  { label: 'Display Name', key: 'displayName', format: 'text' },
  { label: 'User ID',      key: 'userId',      format: 'text' },
  { label: 'Auth Status',  key: 'authStatus',  format: 'text' },
  { label: 'Last Sign In', key: 'lastSignIn',  format: 'text' },
  { label: 'Organizations', key: 'orgs',       format: 'text' },
];

function statusChip(status: string) {
  if (status === 'active') return kit.chipOk;
  if (status === 'banned' || status === 'suspended') return kit.chipBad;
  if (status === 'unconfirmed' || status === 'invited') return kit.chipWarn;
  return kit.chipQuiet;
}

type Props = { initialRows: PeopleRow[]; initialTotal: number; pageSize: number; showStaffDoor: boolean };

export default function PeopleClient({ initialRows, initialTotal, pageSize, showStaffDoor }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [words, setWords] = useState('');
  const [applied, setApplied] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const first = useRef(true);

  const read = useCallback(async (q: string, s: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/platform-admin/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, status: s || null, page: p }),
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setFailed(typeof body?.error === 'string' ? body.error : 'People could not be read just now. Try again in a moment.');
        return;
      }
      setFailed(null);
      setRows(body.rows);
      setTotal(body.total);
    } finally {
      setLoading(false);
    }
  }, []);

  // Find's "All N in People" door hands its words over through this tab's session storage, never the address.
  useEffect(() => {
    // The search below picks the words up on the next render, like any typed words.
    const handed = takeListSearch('people');
    if (handed) setWords(handed);
  }, []);

  // A beat after the last keystroke (two characters or none), and on a filter or a page.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const q = words.trim();
    if (q.length === 1) return;
    const timer = window.setTimeout(() => {
      setApplied(q);
      void read(q, status, page);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [words, status, page, read]);

  function exportRows() {
    return rows.map(row => ({
      email:       row.email,
      displayName: row.displayName || '',
      userId:      row.userId,
      authStatus:  row.authStatus,
      lastSignIn:  row.lastSignIn ? consoleDate(row.lastSignIn) : '-',
      orgs:        row.memberships.map(m => `${m.orgName} (${m.role})`).join('; '),
    }));
  }
  const headers = serializeHeaders(CUSTOMER_USERS_EXPORT_COLS);
  const handleExportXLSX = () => downloadXLSX(buildFilename({ dataset: 'customer-users' }, 'xlsx'), headers, serializeRows(exportRows(), CUSTOMER_USERS_EXPORT_COLS), 'Customer Users');
  const handleExportCSV = () => downloadCSVBlob(buildFilename({ dataset: 'customer-users' }, 'csv'), generateCSV(headers, serializeRows(exportRows(), CUSTOMER_USERS_EXPORT_COLS)));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const open = (id: string) => router.push(`/platform-admin/customer-users/${id}`);

  return (
    <div className={kit.page}>
      <AdminPageHeader title="People" />

      <HelpCallout
        variant="info"
        title="This is the customer directory only"
        body="Staff accounts are left out of this list. Staff, their roles and their access are on the Staff page."
        dismissible
        {...(showStaffDoor ? { cta: { label: 'Open Staff', href: '/platform-admin/users' } } : {})}
      />

      <section className={kit.section}>
        <div className={kit.card}>
          <div className={kit.toolbar}>
            <span className={kit.count}>
              {applied.length >= 2 ? `${total} match${total === 1 ? '' : 'es'}` : `${total} ${total === 1 ? 'person' : 'people'}`}
            </span>
            <input
              type="text"
              inputMode="search"
              className={kit.search}
              value={words}
              onChange={e => { setWords(e.target.value); setPage(1); }}
              placeholder="Search email, name or club"
              aria-label="Search people"
              maxLength={120}
            />
            <select
              className={kit.select}
              aria-label="Filter by sign-in"
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
            >
              <option value="">Everyone</option>
              <option value="active">Active</option>
              <option value="unconfirmed">Unconfirmed</option>
              <option value="banned">Banned</option>
            </select>
            <span className={kit.toolbarEnd}>
              <ExportMenu formats={['xlsx', 'csv']} onExportXLSX={handleExportXLSX} onExportCSV={handleExportCSV} disabled={rows.length === 0} />
            </span>
          </div>

          {failed && <div className={`${kit.notice} ${kit.noticeBad} ${styles.inCellNotice}`}>{failed}</div>}

          <div className="table-cards">
            <table className={kit.comfortable} aria-busy={loading}>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Sign-in</th>
                  <th>Last signed in</th>
                  <th>Clubs</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className={kit.empty}>
                    {applied.length >= 2 ? `Nobody matches “${applied}”.` : 'Nobody here yet.'}
                  </td></tr>
                )}
                {rows.map(row => (
                  <tr key={row.userId} className={kit.clickableRow} onClick={() => open(row.userId)}>
                    <td className="table-cards-title">
                      <Link href={`/platform-admin/customer-users/${row.userId}`} className={kit.nameLink} onClick={e => e.stopPropagation()}>
                        {row.displayName || row.email}
                      </Link>
                      {row.displayName && <span className={kit.sub}>{row.email}</span>}
                      {row.livePortalCount > 1 && (
                        <div className={styles.inCell}>
                          <span
                            className={`${kit.chip} ${kit.chipBad}`}
                            title="This account owns more than one live Premium Coaches Portal — review for the one-portal cleanup."
                          >
                            ⚠ {row.livePortalCount} live portals
                          </span>
                        </div>
                      )}
                    </td>
                    <td data-label="Sign-in">
                      <span className={`${kit.chip} ${statusChip(row.authStatus)}`}>{humanize(row.authStatus)}</span>
                    </td>
                    <td className={kit.nowrap} data-label="Last signed in">
                      {row.lastSignIn ? consoleDate(row.lastSignIn) : <span className={kit.muted}>Never</span>}
                    </td>
                    <td data-label="Clubs">
                      <div className={styles.membershipList}>
                        {row.memberships.length === 0 && <span className={kit.muted}>No clubs</span>}
                        {row.memberships.map(m => (
                          <div key={`${row.userId}-${m.orgId}`} className={styles.membership}>
                            <Link href={`/platform-admin/orgs/${m.orgId}`} className={kit.nameLink} onClick={e => e.stopPropagation()}>{m.orgName}</Link>
                            <span className={`${kit.chip} ${kit.chipQuiet}`}>{humanize(m.role)}</span>
                            {m.status !== 'active' && <span className={`${kit.chip} ${statusChip(m.status)}`}>{humanize(m.status)}</span>}
                            <span className={kit.muted}>{PLAN_CONFIG[m.planId as keyof typeof PLAN_CONFIG]?.label ?? m.planId}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className={kit.rowDoor}>
                      <Link href={`/platform-admin/customer-users/${row.userId}`} className={kit.rowDoorLink} tabIndex={-1} aria-hidden onClick={e => e.stopPropagation()}>›</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > pageSize && (
            <div className={styles.pagination}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className={kit.countQuiet}>Page {page} of {totalPages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
