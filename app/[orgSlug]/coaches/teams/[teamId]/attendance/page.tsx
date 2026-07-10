'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../coaches.module.css';

interface CategoryStat {
  attended: number;
  known: number;
  recorded: number;
}

interface AttendanceRow {
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  games: CategoryStat;
  practices: CategoryStat;
}

// "attended / known" — known excludes no-reply so an untracked RSVP never counts against a player.
function fraction(s: CategoryStat): string | null {
  return s.known > 0 ? `${s.attended}/${s.known}` : null;
}

// A single game/practice figure, styled neutrally (this is a support read, never a leaderboard).
function StatCell({ label, stat }: { label: string; stat: CategoryStat }) {
  const frac = fraction(stat);
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.38)' }}>{label}</div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: frac ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}>
        {frac ?? '—'}
      </div>
    </div>
  );
}

export default function CoachesAttendancePage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/attendance`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      setRows(data.players ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance.');
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

  // "Tracked" means we have at least one definite present/absent signal (a known event). Events
  // left at no-reply carry no reliability signal, so an all-no-reply player reads "not tracked yet"
  // rather than an ambiguous row of dashes.
  const hasAnyData = rows.some(r => r.games.known > 0 || r.practices.known > 0);

  return (
    <div className={styles.page}>
      {/* Drill-in sub-page back-link (the coach breadcrumb is globally hidden — 2026-07-08 rule).
          IA parent = the Insights hub; the Roster page keeps its own in-context button here. */}
      <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><CalendarCheck size={20} /></div>
          <div>
            <h1 className={styles.pageTitle}>Attendance</h1>
            <p className={styles.pageSub}>Who&apos;s been making it out this season</p>
          </div>
        </div>
      </div>

      <p className={styles.muted} style={{ fontSize: '0.85rem', margin: '0 0 1.25rem', maxWidth: 640 }}>
        A season view to support fair playing-time and spot when someone&apos;s drifting away — not a ranking.
        Each figure counts games or practices where you recorded attendance; a player is &ldquo;present&rdquo;
        when marked attending or late, and events with no reply aren&apos;t counted against anyone.
      </p>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : rows.length === 0 ? (
        <div className={styles.emptyState}>No active roster players found.</div>
      ) : !hasAnyData ? (
        <div className={styles.emptyState}>
          <CalendarCheck size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No attendance recorded yet</p>
          <p className={styles.emptyStateSub}>Mark attendance on your games and practices, and each player&apos;s season totals will show here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rows.map(r => {
            const tracked = r.games.known > 0 || r.practices.known > 0;
            return (
              <Link
                key={r.playerId}
                href={`${base}/roster/${r.playerId}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                  minHeight: 48, padding: '0.6rem 0.9rem', borderRadius: 9,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                  {[r.playerFirstName, r.playerLastName].filter(Boolean).join(' ')}
                </span>
                {tracked ? (
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <StatCell label="Games" stat={r.games} />
                    <StatCell label="Practices" stat={r.practices} />
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>not tracked yet</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
