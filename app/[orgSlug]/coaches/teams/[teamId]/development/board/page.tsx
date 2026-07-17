'use client';
import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { formatValue, formatShortDate } from '@/lib/measurable-format';
import styles from '../../../../coaches.module.css';
import type { RepTeamMeasurableType } from '@/lib/types';

interface BoardRow {
  playerId: string;
  firstName: string;
  lastName: string | null;
  number: string | null;
  goals: { focusArea: string; status: string }[];
  latest: Record<string, { value: number; unit: string; recordedOn: string }>;
  lastRecordedOn: string | null;
}

interface BoardData {
  showGoals: boolean;
  showMeasurables: boolean;
  types: RepTeamMeasurableType[];
  rows: BoardRow[];
}

export default function DevelopmentBoardPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  // Fresh instance per team — same stale-fetch class as the session page (3A key= pattern).
  return <BoardView key={teamId} orgSlug={orgSlug} teamId={teamId} />;
}

function BoardView({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [data, setData] = useState<BoardData | null>(null);
  const [noSeason, setNoSeason] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/development/board`);
      const json = await res.json().catch(() => null);
      // No active program year is a legitimate state, not a retryable failure (hub parity).
      if (res.status === 404) {
        setNoSeason(true);
        setData({ showGoals: false, showMeasurables: false, types: [], rows: [] });
        setError('');
        return;
      }
      if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load the board — try again.');
      setData(json);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the board — try again.');
    }
  }, [orgSlug, teamId]);

  useEffect(() => { load(); }, [load]);

  if (!data && !error) {
    return <div className={styles.page}><div className={styles.loadingState}>Loading the board…</div></div>;
  }
  if (!data) {
    return (
      <div className={styles.page}>
        <Link href={`${base}/development`} className={styles.lineupBackLink}>← Development</Link>
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

  const { showGoals, showMeasurables, types, rows } = data;

  // Columns = tests that actually have at least one reading, most-used first, capped so the
  // table stays a list-shape (≤~5 data cols — the tableAsCards contract); the rest are on
  // each player's profile. Rows stay in ROSTER ORDER — never a ranking (binding, 2026-07-17).
  const usage = new Map<string, number>();
  for (const r of rows) for (const typeId of Object.keys(r.latest)) usage.set(typeId, (usage.get(typeId) ?? 0) + 1);
  const columnTypes = types
    .filter(t => (usage.get(t.id) ?? 0) > 0)
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0))
    .slice(0, showGoals ? 3 : 4);
  const hiddenTypeCount = usage.size - columnTypes.length;

  const anyData = rows.some(r => r.goals.length > 0 || Object.keys(r.latest).length > 0);

  return (
    <div className={styles.page}>
      <Link href={`${base}/development`} className={styles.lineupBackLink}>← Development</Link>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><LayoutGrid size={22} /></div>
          <div>
            <h1 className={styles.pageTitle}>Team board</h1>
            <p className={styles.pageSub}>Roster order — a coverage view, not a ranking</p>
          </div>
        </div>
      </div>

      {noSeason ? (
        <p className={styles.detailPlaceholder}>
          No active season for this team yet — the board fills in once a season is set up.
        </p>
      ) : !anyData ? (
        <p className={styles.detailPlaceholder}>
          Nothing on the board yet — run an evaluation session or add a focus area from any player&apos;s profile.
        </p>
      ) : (
        <>
          {hiddenTypeCount > 0 && (
            <p className={styles.devCardNote} style={{ marginBottom: '0.5rem' }}>
              Showing the {columnTypes.length} most-used tests — {hiddenTypeCount} more on each player&apos;s profile.
            </p>
          )}

          {/* ONE table — the documented .tableAsCards primitive reflows rows to cards @640
              via td[data-label] (the player cell has no label: it renders as the card title). */}
          <div className={`${styles.tableWrap} ${styles.tableAsCards}`}>
            <table className={styles.devBoardTable}>
              <thead>
                <tr>
                  <th>Player</th>
                  {showGoals && <th>Focus areas</th>}
                  {showMeasurables && columnTypes.map(t => <th key={t.id}>{t.name}</th>)}
                  {showMeasurables && <th>Last eval</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const name = [r.firstName, r.lastName].filter(Boolean).join(' ');
                  const working = r.goals.filter(g => g.status === 'working').map(g => g.focusArea).join(' · ');
                  return (
                    <tr key={r.playerId}>
                      <td>
                        <Link href={`${base}/roster/${r.playerId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {r.number ? <span className={styles.devRowNum}>#{r.number} </span> : null}{name}
                        </Link>
                      </td>
                      {showGoals && (
                        <td data-label="Focus areas">
                          {r.goals.length === 0
                            ? <span className={styles.devBoardMuted}>none yet</span>
                            : working || <span className={styles.devBoardMuted}>{r.goals.length} achieved/parked</span>}
                        </td>
                      )}
                      {showMeasurables && columnTypes.map(t => {
                        const v = r.latest[t.id];
                        return (
                          <td key={t.id} data-label={t.name} className={styles.devBoardVal}>
                            {v ? `${formatValue(v.value)} ${v.unit}` : <span className={styles.devBoardMuted}>—</span>}
                          </td>
                        );
                      })}
                      {showMeasurables && (
                        <td data-label="Last eval" className={styles.devBoardVal}>
                          {r.lastRecordedOn ? formatShortDate(r.lastRecordedOn) : <span className={styles.devBoardMuted}>—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
