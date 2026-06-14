'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../../rep-teams.module.css';
import type { RepTeam, RepTeamHistoryYear } from '@/lib/types';

function acceptanceRate(total: number, accepted: number): string {
  if (!total) return '—';
  return `${Math.round((accepted / total) * 100)}%`;
}

export default function TeamHistoryPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const [team, setTeam] = useState<RepTeam | null>(null);
  const [history, setHistory] = useState<RepTeamHistoryYear[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${params.teamId}/history`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setTeam(data.team);
      setHistory(data.history ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load team history.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  if (loading || fetching) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Archive size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  if (!team) return <p className={styles.muted}>Team not found.</p>;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <Link href={`${base}/rep-teams/teams/${params.teamId}`}>{team.name}</Link>
        <span><ChevronRight size={12} /></span>
        <span>History</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          {team.color && (
            <span className={styles.colorSwatch} style={{ background: team.color, width: 20, height: 20 }} />
          )}
          <div>
            <h1 className={styles.pageTitle}>{team.name} — History</h1>
            <p className={styles.pageSub}>Completed and archived program years</p>
          </div>
        </div>
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

      {history.length === 0 ? (
        <div className={styles.emptyState}>
          <Archive size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p>No completed or archived seasons yet.</p>
        </div>
      ) : (
        <div className={styles.yearList}>
          {history.map(y => {
            const record =
              y.wins || y.losses || y.ties
                ? `${y.wins}W – ${y.losses}L – ${y.ties}T`
                : '—';
            return (
              <div key={y.id} className={styles.yearCard}>
                <div className={styles.yearCardLeft}>
                  <span className={styles.yearCardName}>{y.name}</span>
                  <div className={styles.yearCardMeta}>
                    <span
                      className={`${styles.badge} ${y.status === 'archived' ? styles.badgeArchived : styles.badgeCompleted}`}
                    >
                      {y.status === 'archived' ? 'Archived' : 'Completed'}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--white-35)' }}>
                      {y.year}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--white-35)' }}>
                      {y.rosterCount} player{y.rosterCount !== 1 ? 's' : ''}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--white-35)' }}>
                      {record}
                    </span>
                    {y.tryoutTotal > 0 && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--white-35)' }}>
                        Tryout acceptance: {acceptanceRate(y.tryoutTotal, y.tryoutAccepted)}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.yearCardRight}>
                  <Link
                    href={`${base}/rep-teams/teams/${params.teamId}/history/${y.id}`}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
