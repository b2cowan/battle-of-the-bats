'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../coaches.module.css';
import type { RepTeamHistoryYear } from '@/lib/types';

interface HistoryYearWithAccounting extends RepTeamHistoryYear {
  accounting: {
    duesCollected: number;
    duesOutstanding: number;
    totalExpenses: number;
  };
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function acceptanceRate(total: number, accepted: number): string {
  if (!total) return '—';
  return `${Math.round((accepted / total) * 100)}%`;
}

export default function CoachesHistoryPage({
  params,
}: {
  params: { orgSlug: string; teamId: string };
}) {
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [history, setHistory] = useState<HistoryYearWithAccounting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/history`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Archive size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <span>Past Seasons</span>
            </nav>
            <h1 className={styles.pageTitle}>Past Seasons</h1>
            <p className={styles.pageSub}>{assignment.teamName} — read-only history</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : history.length === 0 ? (
        <div className={styles.emptyState}>
          <Archive size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p>No completed or archived seasons yet.</p>
        </div>
      ) : (
        <div>
          {history.map(y => {
            const record =
              y.wins || y.losses || y.ties
                ? `${y.wins}W – ${y.losses}L – ${y.ties}T`
                : null;
            const acct = y.accounting;
            return (
              <div
                key={y.id}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '1.25rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{y.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                      {y.year}
                      {record && <span style={{ marginLeft: '0.75rem' }}>{record}</span>}
                      {y.tryoutTotal > 0 && (
                        <span style={{ marginLeft: '0.75rem' }}>
                          Tryout acceptance: {acceptanceRate(y.tryoutTotal, y.tryoutAccepted)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      background: y.status === 'archived' ? 'rgba(255,255,255,0.06)' : 'rgba(74,222,128,0.1)',
                      color: y.status === 'archived' ? 'rgba(255,255,255,0.35)' : '#4ade80',
                    }}
                  >
                    {y.status === 'archived' ? 'Archived' : 'Completed'}
                  </span>
                </div>

                {/* Quick stats row */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{y.rosterCount}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Players</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#4ade80' }}>{fmt(acct.duesCollected)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Dues collected</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: acct.duesOutstanding > 0 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                      {fmt(acct.duesOutstanding)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Outstanding</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{fmt(acct.totalExpenses)}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Expenses</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
