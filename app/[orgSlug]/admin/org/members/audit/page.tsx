'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ScrollText, Users2, ArrowLeft } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import styles from '../members.module.css';

const ACTION_BADGE: Record<string, string> = {
  member_invited:       'badge-success',
  member_removed:       'badge-danger',
  role_changed:         'badge-primary',
  capabilities_changed: 'badge-neutral',
  member_suspended:     'badge-warning',
  member_reinstated:    'badge-success',
};

interface AuditRow {
  id: string;
  action: string;
  actionLabel: string;
  actorEmail: string;
  targetEmail: string;
  details: string;
  createdAt: string;
}

interface AuditResponse {
  rows: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const { currentOrg, userRole, loading } = useOrg();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!currentOrg) return;
    load(page);
  }, [currentOrg, page]);

  async function load(p: number) {
    setFetching(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/admin/members/audit?page=${p}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to load audit log');
      }
      setData(await res.json());
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setFetching(false);
    }
  }

  if (loading) {
    return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  }

  if (userRole !== 'owner') {
    return (
      <div className={styles.page}>
        <div className={styles.accessDenied}>
          <Users2 size={32} className={styles.accessDeniedIcon} />
          <h2>Access Denied</h2>
          <p>Only organization owners can view the audit log.</p>
        </div>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}><ScrollText size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Audit Log</h1>
            <p className={styles.pageSub}>Member change history for your organization</p>
          </div>
        </div>
        <Link
          href={`/${currentOrg?.slug}/admin/org/members`}
          className="btn btn-outline btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ArrowLeft size={14} />
          Members
        </Link>
      </div>

      {errorMsg && (
        <p style={{ color: 'var(--danger, #ef4444)', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {errorMsg}
        </p>
      )}

      <div className={styles.tableWrap}>
        {fetching ? (
          <p className={styles.muted} style={{ padding: '1.5rem' }}>Loading…</p>
        ) : !data || data.rows.length === 0 ? (
          <p className={styles.muted} style={{ padding: '1.5rem' }}>No audit events recorded yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(row => (
                <tr key={row.id}>
                  <td className={styles.dimCell} style={{ whiteSpace: 'nowrap' }}>
                    {formatTimestamp(row.createdAt)}
                  </td>
                  <td>
                    <span className={`badge ${ACTION_BADGE[row.action] ?? 'badge-neutral'}`}>
                      {row.actionLabel}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{row.actorEmail}</td>
                  <td style={{ fontSize: '0.82rem' }}>{row.targetEmail}</td>
                  <td className={styles.dimCell} style={{ fontSize: '0.82rem' }}>{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '1rem',
          fontSize: '0.82rem',
          color: 'var(--white-40, rgba(255,255,255,0.4))',
        }}>
          <span>
            Page {data.page} of {totalPages} · {data.total} event{data.total === 1 ? '' : 's'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page <= 1 || fetching}
            >
              Previous
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages || fetching}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
