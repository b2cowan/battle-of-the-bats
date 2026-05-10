'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { BarChart2 } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import styles from '../../../house-league.module.css';
import type { LeagueDivision, LeagueStandingsRow } from '@/lib/types';

interface SeasonInfo { id: string; name: string; }

export default function StandingsPage() {
  const { orgSlug, seasonId } = useParams<{ orgSlug: string; seasonId: string }>();
  const { user, userRole, userCapabilities } = useOrg();

  const canView = hasCapability(userRole ?? 'staff', userCapabilities ?? null, 'module_house_league');

  const [season, setSeason]         = useState<SeasonInfo | null>(null);
  const [divisions, setDivisions]   = useState<LeagueDivision[]>([]);
  const [selectedDiv, setSelectedDiv] = useState<string>('');
  const [standings, setStandings]   = useState<LeagueStandingsRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Load season + divisions
  useEffect(() => {
    if (!canView) return;
    fetch(`/api/admin/house-league/seasons/${seasonId}`)
      .then(r => r.json())
      .then(d => {
        if (d.season) setSeason({ id: d.season.id, name: d.season.name });
        if (d.divisions?.length) {
          setDivisions(d.divisions);
          setSelectedDiv(d.divisions[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [seasonId, canView]);

  // Load standings when division changes
  const loadStandings = useCallback(async (divId: string) => {
    if (!divId) return;
    setStandingsLoading(true);
    try {
      const r = await fetch(
        `/api/admin/house-league/seasons/${seasonId}/standings?divisionId=${divId}`,
      );
      const d = await r.json();
      setStandings(d.standings ?? []);
    } finally {
      setStandingsLoading(false);
    }
  }, [seasonId]);

  useEffect(() => {
    if (selectedDiv) loadStandings(selectedDiv);
  }, [selectedDiv, loadStandings]);

  if (!user) return null;
  if (!canView) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
          You don&apos;t have access to this page.
        </p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className={styles.page}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}>
            <BarChart2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem' }}>
              <Link href={`/${orgSlug}/admin/house-league`} style={{ color: 'inherit', textDecoration: 'none' }}>
                House League
              </Link>
              {season && (
                <>
                  {' / '}
                  <Link
                    href={`/${orgSlug}/admin/house-league/seasons/${seasonId}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {season.name}
                  </Link>
                </>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#f0f0f0' }}>
              Standings
            </h1>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.scheduleToolbar}>
        {divisions.length > 1 && (
          <select
            className={styles.divSelect}
            value={selectedDiv}
            onChange={e => setSelectedDiv(e.target.value)}
          >
            {divisions.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Standings table */}
      {standingsLoading ? (
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Loading standings…</p>
      ) : standings.length === 0 ? (
        <div style={{
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          border: '1px dashed rgba(255,255,255,0.1)',
          borderRadius: '10px',
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.9rem',
        }}>
          No completed games yet — standings will appear once scores are entered.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.scheduleTable}>
            <thead>
              <tr>
                <th style={{ width: '2.5rem', textAlign: 'center' }}>#</th>
                <th>Team</th>
                <th style={{ textAlign: 'center' }}>GP</th>
                <th style={{ textAlign: 'center' }}>W</th>
                <th style={{ textAlign: 'center' }}>L</th>
                <th style={{ textAlign: 'center' }}>T</th>
                <th style={{ textAlign: 'center' }}>Pts</th>
                <th style={{ textAlign: 'center' }}>GF</th>
                <th style={{ textAlign: 'center' }}>GA</th>
                <th style={{ textAlign: 'center' }}>Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.team.id} style={i === 0 ? { background: 'rgba(163,230,53,0.04)' } : undefined}>
                  <td style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                    {i + 1}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                      {row.team.color && (
                        <span className={styles.teamDot} style={{ background: row.team.color }} />
                      )}
                      <span style={{ fontWeight: 600, color: i === 0 ? '#a3e635' : '#f0f0f0' }}>
                        {row.team.name}
                      </span>
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>{row.gamesPlayed}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.wins}</td>
                  <td style={{ textAlign: 'center' }}>{row.losses}</td>
                  <td style={{ textAlign: 'center' }}>{row.ties}</td>
                  <td className={styles.scoreCell} style={{ textAlign: 'center' }}>{row.points}</td>
                  <td style={{ textAlign: 'center' }}>{row.runsFor}</td>
                  <td style={{ textAlign: 'center' }}>{row.runsAgainst}</td>
                  <td style={{
                    textAlign: 'center',
                    fontWeight: 600,
                    color: row.runDifferential > 0
                      ? '#4ade80'
                      : row.runDifferential < 0
                        ? '#f87171'
                        : 'rgba(255,255,255,0.4)',
                  }}>
                    {row.runDifferential > 0 ? '+' : ''}{row.runDifferential}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {standings.length > 0 && (
        <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
          Pts: W=2, T=1, L=0 &nbsp;·&nbsp; Tiebreaker: run differential, then runs for
        </p>
      )}
    </div>
  );
}
