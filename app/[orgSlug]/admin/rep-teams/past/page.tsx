'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Archive, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../rep-teams.module.css';
import type { RepPastProgramYear } from '@/lib/types';

function groupByTeam(years: RepPastProgramYear[]): Map<string, RepPastProgramYear[]> {
  const map = new Map<string, RepPastProgramYear[]>();
  for (const y of years) {
    const list = map.get(y.teamId) ?? [];
    list.push(y);
    map.set(y.teamId, list);
  }
  return map;
}

export default function PastProgramYearsPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const [years, setYears] = useState<RepPastProgramYear[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch('/api/admin/rep-teams/past');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setYears(data.years ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load past program years.');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  if (loading) return <p className={styles.muted}>Loading…</p>;

  if (!userRole || !hasCapability(userRole, userCapabilities, 'module_rep_teams')) {
    return (
      <div className={styles.accessDenied}>
        <Archive size={32} />
        <h2>Access Restricted</h2>
        <p>You don&apos;t have access to the Rep Teams module.</p>
      </div>
    );
  }

  const grouped = groupByTeam(years);

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link href={`${base}/rep-teams`}>Rep Teams</Link>
        <span><ChevronRight size={12} /></span>
        <span>Past Seasons</span>
      </div>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Archive size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Past Seasons</h1>
            <p className={styles.pageSub}>{currentOrg?.name} — completed and archived program years</p>
          </div>
        </div>
      </div>

      {error && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

      {fetching ? (
        <p className={styles.muted}>Loading…</p>
      ) : years.length === 0 ? (
        <div className={styles.emptyState}>
          <Archive size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p>No completed or archived seasons yet.</p>
        </div>
      ) : (
        <div>
          {[...grouped.entries()].map(([teamId, teamYears]) => {
            const first = teamYears[0];
            return (
              <div key={teamId} style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {first.teamColor && (
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: first.teamColor, flexShrink: 0 }} />
                  )}
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{first.teamName}</h2>
                  {first.teamAgeGroup && (
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{first.teamAgeGroup}</span>
                  )}
                  <Link
                    href={`${base}/rep-teams/teams/${teamId}/history`}
                    style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}
                  >
                    Full history →
                  </Link>
                </div>
                <div className={styles.yearList}>
                  {teamYears.map(y => (
                    <div key={y.id} className={styles.yearCard}>
                      <div className={styles.yearCardLeft}>
                        <span className={styles.yearCardName}>{y.name}</span>
                        <div className={styles.yearCardMeta}>
                          <span className={`${styles.badge} ${y.status === 'archived' ? styles.badgeArchived : styles.badgeCompleted}`}>
                            {y.status === 'archived' ? 'Archived' : 'Completed'}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
                            {y.year} · {y.rosterCount} player{y.rosterCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className={styles.yearCardRight}>
                        <Link
                          href={`${base}/rep-teams/teams/${teamId}/history/${y.id}`}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
