'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Scale, BarChart3 } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import { getSportPack, DEFAULT_SPORT } from '@/lib/sports';
import styles from '../../../../coaches.module.css';
import type { SeasonLineupAnalytics } from '@/lib/lineup-season-analytics';

// One player per row — the five old accordion read-outs merged into a single table (design log
// 2026-07-09: reports are real tables, never stacked disclosure widgets).
interface PlayerRow {
  playerId: string;
  name: string;
  fieldInnings: number;
  benchInnings: number;
  backToBackGames: number;
  positions: string[];
  inningsPitched: number | null;
  perGameCap: number | null;
  overCapGames: number;
}

function mergeRows(a: SeasonLineupAnalytics): PlayerRow[] {
  const byId = new Map<string, PlayerRow>();
  const ensure = (playerId: string, name: string): PlayerRow => {
    let r = byId.get(playerId);
    if (!r) {
      r = { playerId, name, fieldInnings: 0, benchInnings: 0, backToBackGames: 0, positions: [], inningsPitched: null, perGameCap: null, overCapGames: 0 };
      byId.set(playerId, r);
    }
    return r;
  };
  for (const f of a.fairPlay) {
    const r = ensure(f.playerId, f.name);
    r.fieldInnings = f.fieldInnings;
    r.benchInnings = f.benchInnings;
  }
  for (const b of a.benchBalance) ensure(b.playerId, b.name).backToBackGames = b.backToBackGames;
  for (const p of a.positionVariety) ensure(p.playerId, p.name).positions = p.positions;
  for (const c of a.armCare) {
    const r = ensure(c.playerId, c.name);
    r.inningsPitched = c.inningsPitched;
    r.perGameCap = c.perGameCap;
    r.overCapGames = c.overCapGames;
  }
  // Most-benched first — this is the fairness question the page answers.
  return [...byId.values()].sort((x, y) => y.benchInnings - x.benchInnings);
}

export default function CoachesPlayingTimeReportPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const sportPack = getSportPack(assignment?.teamSport ?? DEFAULT_SPORT);
  const periods = sportPack.periodLabelPlural.toLowerCase();
  const canLineups = !!assignment?.capabilities.lineups;

  const [analytics, setAnalytics] = useState<SeasonLineupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Guards the stale-team flash on client-side team switches (page doesn't remount).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/lineup-analytics`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnalytics(data.analytics ?? null);
    } catch {
      setError('This report couldn’t be loaded — refresh to try again.');
    } finally {
      setLoadedFor(teamId);
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (ctxLoading || !canLineups) return;
    void Promise.resolve().then(load);
  }, [ctxLoading, canLineups, load]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const rows = analytics && analytics.gamesWithLineup > 0 ? mergeRows(analytics) : [];

  return (
    <div className={styles.page}>
      <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Scale size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Is playing time fair?</h1>
            <p className={styles.pageSub}>One row per player, from your saved lineups</p>
          </div>
        </div>
      </div>

      {!canLineups ? (
        <div className={styles.emptyState}>
          <Scale size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>Lineups aren&apos;t enabled for you</p>
          <p className={styles.emptyStateSub}>Ask your head coach to grant lineup access.</p>
        </div>
      ) : loading || loadedFor !== teamId ? (
        <div className={styles.loadingState}>Loading report…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : !analytics || analytics.gamesWithLineup === 0 ? (
        <div className={styles.emptyState}>
          <BarChart3 size={26} style={{ opacity: 0.3, margin: '0 auto 0.6rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No playing-time data yet</p>
          <p className={styles.emptyStateSub}>Save a lineup for a few games and this report fills in on its own.</p>
        </div>
      ) : (
        <>
          <p className={styles.insightsBasis}>Based on the {analytics.gamesWithLineup} game{analytics.gamesWithLineup === 1 ? '' : 's'} you&apos;ve saved a lineup for.</p>

          <div className={styles.insightsTableWrap}>
            <table className={styles.insightsTable}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>On field</th>
                  <th>Bench</th>
                  <th>Back-to-back sits</th>
                  <th>Positions played</th>
                  <th>Pitching</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const total = r.fieldInnings + r.benchInnings;
                  const pct = total > 0 ? Math.round((r.fieldInnings / total) * 100) : 0;
                  return (
                    <tr key={r.playerId}>
                      <td>{r.name}</td>
                      <td className={styles.insightsNum}>
                        {r.fieldInnings}
                        <span className={styles.insightsFieldBar} aria-hidden><i style={{ width: `${pct}%` }} /></span>
                      </td>
                      <td className={styles.insightsNum}>{r.benchInnings}</td>
                      <td className={styles.insightsNum}>{r.backToBackGames > 0 ? r.backToBackGames : '—'}</td>
                      <td>{r.positions.length ? r.positions.join(', ') : '—'}</td>
                      <td className={styles.insightsNum}>
                        {r.inningsPitched != null && r.inningsPitched > 0 ? (
                          <>
                            {r.inningsPitched} {sportPack.periodLabel === 'Inning' ? 'IP' : periods}
                            {r.perGameCap != null && <span className={styles.mutedInline}> · cap {r.perGameCap}/g</span>}
                            {r.overCapGames > 0 && <span className={styles.insightsFlagWarn}> ⚠ over cap ×{r.overCapGames}</span>}
                          </>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section style={{ marginTop: '1.75rem' }}>
            <p className={styles.sectionKicker}>Which lineup wins?</p>
            {analytics.reusedLineups.length === 0 ? (
              <p className={styles.insightsQuietText}>No batting order has been reused across multiple games yet — once you run one twice, its record shows up here.</p>
            ) : (
              <>
                <div className={styles.insightsTableWrap}>
                  <table className={styles.insightsTable}>
                    <thead><tr><th>Batting order</th><th>Record</th><th>Times used</th></tr></thead>
                    <tbody>
                      {analytics.reusedLineups.map((r, i) => (
                        <tr key={i}>
                          <td>{r.label}</td>
                          <td className={styles.insightsNum}>
                            {r.scoredGames > 0
                              ? <b className={styles.insightsRecGood}>{r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ''}</b>
                              : <span className={styles.mutedInline}>no scores yet</span>}
                          </td>
                          <td className={styles.insightsNum}>
                            {r.games}{r.scoredGames > 0 && r.scoredGames < r.games ? <span className={styles.mutedInline}> ({r.scoredGames} scored)</span> : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.insightsBasis} style={{ marginTop: '0.5rem' }}>Records count only games with a score entered.</p>
              </>
            )}
          </section>

          <Link href={`${base}/lineups`} className={styles.insightsOpsLink}>Manage lineups →</Link>
        </>
      )}
    </div>
  );
}
