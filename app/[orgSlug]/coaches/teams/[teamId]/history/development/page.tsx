'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { formatShortDate } from '@/lib/measurable-format';
import styles from '../../../../coaches.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Development report (Player Development 3D — D4 Option B, owner 2026-07-17).
// The page behind the Insights hub's sixth doorway tile: one row per active
// player, ROSTER ORDER ONLY — a coverage checklist, never a leaderboard.
// Architected as the future development-analytics home: the coverage table is
// SECTION ONE; future player-vs-self sections land as new sections here (per
// the multi-domain layout rule) — never as cross-season deltas (scrapbook rule).
// ─────────────────────────────────────────────────────────────────────────────

interface ReportRow {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  goals: { focusArea: string; status: string }[];
  latest: Record<string, { value: number; unit: string; recordedOn: string }>;
  lastRecordedOn: string | null;
  historyLinked: string | null;
}

interface ReportData {
  showGoals: boolean;
  showMeasurables: boolean;
  rows: ReportRow[];
}

export default function DevelopmentReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — no cross-team fetch races (3A key= pattern).
  return <ReportView key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

function ReportView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<ReportData | null>(null);
  const [noSeason, setNoSeason] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // ?history=1 → the board GET adds the History-linked column (opt-in; the board page
      // and the hub tile don't render it, so they don't pay for the prior-season scan).
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/board?history=1`);
      const json = await res.json().catch(() => null);
      // No active program year is a legitimate state, not a retryable failure (board parity).
      if (res.status === 404) {
        setNoSeason(true);
        setData({ showGoals: false, showMeasurables: false, rows: [] });
        setError('');
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load the report — try again.');
      setData(json);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the report — try again.');
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  if (!data && !error) {
    return <div className={styles.page}><div className={styles.loadingState}>Loading the report…</div></div>;
  }
  if (!data) {
    return (
      <div className={styles.page}>
        <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>
        <p className={styles.detailPlaceholder}>
          {error}{' '}
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem' }}
            onClick={() => { setError(''); load(); }}>
            Try again
          </button>
        </p>
      </div>
    );
  }

  const { showGoals, rows } = data;
  const anyData = rows.some(r => r.goals.length > 0 || Object.keys(r.latest).length > 0 || r.historyLinked);

  return (
    <div className={styles.page}>
      <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><TrendingUp size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Development</h1>
            <p className={styles.pageSub}>Is everyone getting attention? — roster order, a coverage checklist, not a ranking</p>
          </div>
        </div>
      </div>

      {noSeason ? (
        <p className={styles.detailPlaceholder}>
          No active season for this team yet — the report fills in once a season is set up.
        </p>
      ) : !anyData ? (
        <p className={styles.detailPlaceholder}>
          Nothing to cover yet — run an evaluation session in Development or add a focus area from any player&apos;s profile.
        </p>
      ) : (
        /* Section 1 · Coverage — the board's data face (.tableAsCards reflows @640). */
        <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
          <table className={styles.devBoardTable}>
            <thead>
              <tr>
                <th>Player</th>
                {showGoals && <th>Active focus</th>}
                <th>Last measurable</th>
                <th>History linked</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
                const working = r.goals.filter(g => g.status === 'working').length;
                return (
                  <tr key={r.playerId}>
                    <td>
                      <Link href={`${base}/roster/${r.playerId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {r.number ? <span className={styles.devRowNum}>#{r.number} </span> : null}{name}
                      </Link>
                    </td>
                    {showGoals && (
                      <td data-label="Active focus" className={styles.devBoardVal}>
                        {working > 0 ? working : <span className={styles.devBoardMuted}>none yet</span>}
                      </td>
                    )}
                    <td data-label="Last measurable" className={styles.devBoardVal}>
                      {r.lastRecordedOn ? formatShortDate(r.lastRecordedOn) : <span className={styles.devBoardMuted}>—</span>}
                    </td>
                    <td data-label="History linked" className={styles.devBoardVal}>
                      {r.historyLinked ? `${r.historyLinked} ✓` : <span className={styles.devBoardMuted}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
