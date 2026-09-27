'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Archive, ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';
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
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  // Admin Design Continuity slice 3: the kit's patch over each hand-set style while the switch is on.
  const kx = useKitStyle();

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

  // A season's facts line, faint — on the kit the tertiary ink (the dark ramp's 35% misses AA there).
  const metaInk = kx({ fontSize: '0.78rem', color: 'var(--white-35)' }, KIT_INK.tertiary);

  return (
    <div className={styles.page}>
      {/* Header — today's breadcrumb and header as `legacy` while the switch is off. On the kit the team
          is the way up (the title's "{team} —" half, and the breadcrumb's middle) and "Rep Teams" the
          eyebrow; "Completed and archived program years" describes the list and is not re-homed — each
          season's chip says which it is (F3). */}
      <AdminPageHeader
        crumbs={[{ href: `${base}/rep-teams`, label: 'Rep Teams' }, { label: currentOrg?.name ?? '' }]}
        title="History"
        backTo={{ href: `${base}/rep-teams/teams/${params.teamId}`, label: team.name }}
        legacy={<>
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
        </>}
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
