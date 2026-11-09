'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { TabPageHeader } from '@/components/admin/kit/club/PlaceFrame';
import { useHandNamedPlace } from '@/components/admin/AdminBarPlace';
import styles from '../../../rep-teams.module.css';
import type { RepTeam, RepTeamHistoryYear } from '@/lib/types';
import LoadingState from '@/components/shared/LoadingState';

// A season's facts line, faint — the tertiary ink (the dark ramp's 35% missed AA on the kit's ground).
const metaInk = { fontSize: '0.78rem', color: 'var(--text-tertiary)' };

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
  const { currentOrg, loading } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const [team, setTeam] = useState<RepTeam | null>(null);
  const [history, setHistory] = useState<RepTeamHistoryYear[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setFetching(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/rep-teams/teams/${params.teamId}/history${orgQuery}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setTeam(data.team);
      setHistory(data.history ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load team history.');
    } finally {
      setFetching(false);
    }
  }, [params.teamId, orgQuery]);

  useEffect(() => { if (currentOrg) load(); }, [currentOrg, load]);

  // ⚖ Admin header Phase 3 (A8): the header names the page, "← {team} │ History"; on a phone (the arrow alone) the team
  // rides the small line. The address said "← Team" until the team arrives.
  useHandNamedPlace(team ? {
    title: 'History', back: { href: `${base}/rep-teams/teams/${params.teamId}`, label: team.name }, facts: [team.name],
  } : null);

  if (loading || fetching) return <LoadingState label="Loading this team’s history…" />;

  if (!team) return <p className={styles.muted}>Team not found.</p>;

  return (
    <div className={styles.page}>
      {/* Header — the team is the way up (backTo) and "Rep Teams" the eyebrow. The old subtitle "Completed
          and archived program years" described the list and was not re-homed — each season's chip says
          which it is (F3). Only where the header keeps the club's name (Phase 3: it names this page otherwise). */}
      <TabPageHeader
        crumbs={[{ href: `${base}/rep-teams`, label: 'Rep teams' }, { label: currentOrg?.name ?? '' }]}
        title="History"
        backTo={{ href: `${base}/rep-teams/teams/${params.teamId}`, label: team.name }}
      />

      {error && <p style={{ color: 'var(--danger-light)', marginBottom: '1rem' }}>{error}</p>}

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
                    <span style={metaInk}>
                      {y.year}
                    </span>
                    <span style={metaInk}>
                      {y.rosterCount} player{y.rosterCount !== 1 ? 's' : ''}
                    </span>
                    <span style={metaInk}>
                      {record}
                    </span>
                    {y.tryoutTotal > 0 && (
                      <span style={metaInk}>
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
