'use client';
import { useState, useEffect, useCallback, use } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck, ArrowRight } from 'lucide-react';
import { useCoaches, useCoachSeasonPage } from '@/lib/coaches-context';
import CoachPageHeader from '@/components/coaches/CoachPageHeader';
import CoachEmptyState from '@/components/coaches/CoachEmptyState';
import { SkeletonBlock } from '@/components/admin/AdminSkeleton';
import {
  COACH_GAME_EVENT_TYPES, eventDisplayTitle, formatEventWhen, pickNextOrMostRecent,
} from '@/lib/coach-tournament-games';
import type { RepTeamEvent } from '@/lib/types';
import styles from '../../../coaches.module.css';

/** Event types attendance is taken on — the games plus practices and multi-day tournaments,
 *  matching the server-side reliability rollup's buckets. */
const ATTENDANCE_EVENT_TYPES = [...COACH_GAME_EVENT_TYPES, 'external_tournament', 'practice'];

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
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--home-dim, rgba(255,255,255,0.38))' }}>{label}</div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: frac ? 'var(--home-ink, rgba(255,255,255,0.85))' : 'var(--home-dim, rgba(255,255,255,0.3))' }}>
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
  // Chunk F — which SEASON is on screen. `page.capabilities` are that season's (rule 1)
  // and `page.canWrite()` folds in read-only, so write flags go through it.
  const seasonSearchParams = useSearchParams();
  const page = useCoachSeasonPage(orgSlug, teamId, seasonSearchParams.get('year'));
  const seasonQuery = page.query;
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Batch 4 (f8-2): the report explained what it WOULD show but never said where attendance is
  // actually recorded. This is the event it points at — the next one coming up, or failing that
  // the most recent one played, so the answer to "where do I do this?" is a live link, not prose.
  const [markTarget, setMarkTarget] = useState<RepTeamEvent | null>(null);
  // ⚠ A null target and an unanswered request look identical from here. Rendering the empty state
  // on `null` alone meant every visit opened with "Nothing to take attendance for yet" for as long
  // as the lookup took — a confident, wrong answer given before we had looked. These two flags keep
  // the three states apart: still looking / looked and found nothing / could not look.
  const [markTargetLoading, setMarkTargetLoading] = useState(true);
  const [markTargetFailed, setMarkTargetFailed] = useState(false);

  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/attendance${seasonQuery}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load');
      const data = await res.json();
      if (!isStale()) setRows(data.players ?? []);
    } catch (e: unknown) {
      if (!isStale()) setError(e instanceof Error ? e.message : 'Failed to load attendance.');
    } finally {
      if (!isStale()) setLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  // Non-fatal: the report stands on its own if this fails — it just loses the shortcut.
  const loadMarkTarget = useCallback(async (isStale: () => boolean = () => false) => {
    // ⚠ All three reset together, and the remembered event MUST be one of them. Leaving it set
    // meant a lookup that FAILED kept the previous team's game on screen — the render tests
    // `markTarget` before `markTargetFailed`, so switching teams and hitting a network blip showed
    // team A's game behind a "Take attendance" button pointing at team B's schedule.
    setMarkTargetLoading(true);
    setMarkTargetFailed(false);
    setMarkTarget(null);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events${seasonQuery}`);
      if (!res.ok) { if (!isStale()) setMarkTargetFailed(true); return; }
      const data: { events?: RepTeamEvent[] } = await res.json();
      if (isStale()) return;
      setMarkTarget(pickNextOrMostRecent(data.events ?? [], {
        types: ATTENDANCE_EVENT_TYPES,
        now: Date.now(),
      }));
    } catch {
      /* the shortcut is a convenience, never a dependency */
      if (!isStale()) setMarkTargetFailed(true);
    } finally {
      if (!isStale()) setMarkTargetLoading(false);
    }
  }, [orgSlug, teamId, seasonQuery]);

  // Both loads are keyed on teamId, and a coach with several assignments can switch teams without
  // this page unmounting — so a slow response for the previous team must not land on the new one.
  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => { cancelled = true; };
  }, [load]);
  useEffect(() => {
    let cancelled = false;
    void loadMarkTarget(() => cancelled);
    return () => { cancelled = true; };
  }, [loadMarkTarget]);

  // ⚠ No `if (ctxLoading) return <p>Loading…</p>` here, deliberately. The title, sub-line and help
  // button need no fetch, so the frame renders straight away and only the two unknown regions below
  // shimmer — collapsing the whole page to a bare line was a second flash before the one this page
  // was really reported for. `hasAccess` is false until the context lands, hence the `!ctxLoading`.
  if (!ctxLoading && !page.hasAccess) {
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

  // One geometry, two renders — the skeleton rows have to land exactly where the real rows land,
  // or the list jumps as it settles.
  const attendanceRowStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    minHeight: 48, padding: '0.6rem 0.9rem', borderRadius: 9,
    background: 'var(--home-card, rgba(255,255,255,0.03))',
    border: '1px solid var(--home-line, rgba(255,255,255,0.07))',
  };

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      {/* Drill-in sub-page back-link (the coach breadcrumb is globally hidden — 2026-07-08 rule).
          IA parent = the Insights hub; the Roster page keeps its own in-context button here. */}
      <Link href={`${base}/history`} className={styles.lineupBackLink}>← Insights</Link>

      {/* Header (page-header ruling 2026-08-11): title + "?" in its fixed corner, nothing
          under the title. */}
      <CoachPageHeader
        icon={CalendarCheck}
        title="Attendance"
        season={page.season}
        teamBase={page.teamBase}
        helpLabel="Attendance"
        help={{ module: 'coaches', sectionIds: ['recipe-attendance'], fullGuideHref: `/${orgSlug}/coaches/help#recipe-attendance` }}
      />

      {/* Batch 4 — record first, review second. The review found this page explained what it would
          show but never linked to where attendance is actually taken; the round trip back from the
          game panel is the matching half. */}
      {markTargetLoading ? (
        // Card-shaped placeholder, not a message — the slot holds its size and says nothing it
        // might have to take back.
        <div className={styles.nowCard} aria-busy="true" aria-label="Looking for your next game or practice">
          <SkeletonBlock w="110px" h="0.7rem" />
          <SkeletonBlock w="min(360px, 85%)" h="1.35rem" />
          <SkeletonBlock w="170px" h="0.9rem" />
          <SkeletonBlock w="150px" h="30px" />
        </div>
      ) : markTarget ? (
        // Reuses the Overview "Right now" anchor-card family rather than a parallel set of
        // classes — same eyebrow / headline / meta / CTA shape, so the two read as one pattern.
        <div className={styles.nowCard}>
          <p className={styles.nowEyebrow}>Take attendance</p>
          <p className={styles.nowHeadline}>{eventDisplayTitle(markTarget)}</p>
          <p className={styles.nowMeta}>{formatEventWhen(markTarget.startsAt)}</p>
          <div className={styles.nowActions}>
            <Link href={`${base}/schedule?event=${markTarget.id}&tab=attendance`} className="btn btn-lime btn-sm">
              Take attendance <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </div>
      ) : markTargetFailed ? null : (
        // Only reached once the lookup has actually come back empty. A FAILED lookup renders
        // nothing at all above — we don't know the schedule is empty, so we don't say it is, and
        // the shortcut was never a dependency of the report below.
        <CoachEmptyState
          icon={<CalendarCheck size={22} aria-hidden />}
          eyebrow="Attendance"
          headline="Nothing to take attendance for yet"
          description="Attendance is marked on a game or practice. Add one to your schedule and it'll be one tap from here."
          primaryAction={{ label: 'Open schedule', href: `${base}/schedule` }}
        />
      )}

      <p className={styles.muted} style={{ fontSize: '0.85rem', margin: '1.25rem 0', maxWidth: 640 }}>
        A season view to inform playing-time decisions and spot when someone&apos;s drifting away — not a ranking.
        Each figure counts games or practices where you recorded attendance; a player is &ldquo;present&rdquo;
        when marked attending or late, and events with no reply aren&apos;t counted against anyone.
      </p>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }} aria-busy="true" aria-label="Loading attendance">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={attendanceRowStyle}>
              <SkeletonBlock w="130px" h="0.8rem" />
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <SkeletonBlock w="62px" h="0.8rem" />
                <SkeletonBlock w="62px" h="0.8rem" />
              </div>
            </div>
          ))}
        </div>
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
                style={{ ...attendanceRowStyle, textDecoration: 'none', color: 'inherit' }}
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
                  <span style={{ fontSize: '0.8rem', color: 'var(--home-dim, rgba(255,255,255,0.3))' }}>not tracked yet</span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
