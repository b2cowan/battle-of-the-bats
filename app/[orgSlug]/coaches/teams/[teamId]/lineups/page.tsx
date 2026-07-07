'use client';
import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ListOrdered, ArrowRight, CheckCircle2, TriangleAlert, CalendarPlus } from 'lucide-react';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent } from '@/lib/types';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];
// Cap how many games we probe for lineup-readiness so a busy season doesn't fan out dozens of
// requests — the nearest upcoming games (the ones a coach is about to coach) are what matter.
const READINESS_LIMIT = 20;

function formatDay(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}
function gameTitle(e: RepTeamEvent) {
  if (e.opponent) return `${e.homeAway === 'away' ? '@' : 'vs'} ${e.opponent}`;
  return e.name || 'Game';
}

export default function CoachesLineupsPage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(paramsPromise);
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  // Fail-open like the nav — the server still enforces on every lineup route.
  const canLineups = assignment ? assignment.capabilities.lineups : true;

  const [upcoming, setUpcoming] = useState<RepTeamEvent[]>([]);
  const [recent, setRecent] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-game lineup readiness: true = a lineup is saved, false = not yet, undefined = not checked.
  const [ready, setReady] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error('Games could not be loaded');
      const data: { events?: RepTeamEvent[] } = await res.json();
      const games = (data.events ?? []).filter(e => GAME_EVENT_TYPES.includes(e.eventType) && e.status !== 'cancelled');
      // Compute the split here (not during render) so we never call Date.now() in the render body.
      const now = Date.now();
      const isUpcoming = (e: RepTeamEvent) => new Date(e.startsAt).getTime() >= now && e.status === 'scheduled';
      setUpcoming(games.filter(isUpcoming).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
      setRecent(games.filter(e => !isUpcoming(e)).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()).slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Games could not be loaded');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  // Wait for the assignments context to resolve before deciding whether to fetch — otherwise the
  // fail-open `canLineups` default would fire the fetch for an assistant whose access is revoked.
  // When lineups aren't permitted the page returns the "not enabled" state below instead.
  useEffect(() => { if (!ctxLoading && canLineups) void Promise.resolve().then(load); }, [ctxLoading, canLineups, load]);

  // Probe lineup readiness for the nearest upcoming games (bounded).
  useEffect(() => {
    if (!canLineups || upcoming.length === 0) return;
    let cancelled = false;
    const probe = upcoming.slice(0, READINESS_LIMIT);
    Promise.all(
      probe.map(async e => {
        try {
          const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${e.id}/lineup`);
          if (!res.ok) return [e.id, undefined] as const;
          const json = await res.json();
          const entries = (json.entries ?? []) as { inningPositions?: Record<string, string> }[];
          return [e.id, entries.some(en => Object.values(en.inningPositions ?? {}).some(Boolean))] as const;
        } catch {
          return [e.id, undefined] as const;
        }
      }),
    ).then(pairs => {
      if (cancelled) return;
      const next: Record<string, boolean> = {};
      for (const [id, val] of pairs) if (typeof val === 'boolean') next[id] = val;
      setReady(next);
    });
    return () => { cancelled = true; };
  }, [canLineups, orgSlug, teamId, upcoming]);

  if (ctxLoading) return <div className={styles.loadingState}>Loading…</div>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const header = (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderLeft}>
        <div className={styles.headerIcon}><ListOrdered size={22} /></div>
        <div>
          <nav className={styles.breadcrumb}>
            <Link href={`/${orgSlug}/coaches`}>Portal</Link>
            <span>/</span>
            <Link href={base}>{assignment.teamName}</Link>
            <span>/</span>
            <span>Lineups</span>
          </nav>
          <h1 className={styles.pageTitle}>Lineups</h1>
          <p className={styles.pageSub}>Set the batting order and field positions for each game.</p>
        </div>
      </div>
    </div>
  );

  if (!canLineups) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.emptyState}>
          <ListOrdered size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>Lineups aren&apos;t enabled for you</p>
          <p className={styles.emptyStateSub}>Ask your head coach to grant lineup access.</p>
        </div>
      </div>
    );
  }

  const renderRow = (e: RepTeamEvent, action: string) => {
    const r = ready[e.id];
    return (
      <Link key={e.id} href={`${base}/schedule?event=${e.id}&tab=lineup`} className={styles.lineupFrontRow}>
        <span className={styles.lineupFrontDate}>
          <span className={styles.lineupFrontDay}>{new Date(e.startsAt).getDate()}</span>
          <span className={styles.lineupFrontMonth}>{new Date(e.startsAt).toLocaleDateString('en-CA', { month: 'short' })}</span>
        </span>
        <span className={styles.lineupFrontMain}>
          <span className={styles.lineupFrontTitle}>{gameTitle(e)}</span>
          <span className={styles.lineupFrontMeta}>{formatDay(e.startsAt)} · {formatTime(e.startsAt)}</span>
        </span>
        {r === true && <span className={styles.lineupFrontChip} data-tone="ok"><CheckCircle2 size={13} aria-hidden /> Lineup set</span>}
        {r === false && <span className={styles.lineupFrontChip} data-tone="warn"><TriangleAlert size={13} aria-hidden /> Not set</span>}
        <span className={styles.lineupFrontAction}>
          <span className={styles.lineupFrontActionLabel}>{action}</span>
          <ArrowRight size={14} aria-hidden />
        </span>
      </Link>
    );
  };

  const noGames = !loading && !error && upcoming.length === 0 && recent.length === 0;

  return (
    <div className={styles.page}>
      {header}

      {loading ? (
        <div className={styles.loadingState}>Loading games…</div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : noGames ? (
        <div className={styles.emptyState}>
          <CalendarPlus size={28} style={{ opacity: 0.3, margin: '0 auto 0.75rem', display: 'block' }} />
          <p className={styles.emptyStateTitle}>No games yet</p>
          <p className={styles.emptyStateSub}>Add a game to your schedule, then build its lineup here.</p>
          <Link href={`${base}/schedule`} className="btn btn-lime btn-sm" style={{ marginTop: '0.9rem' }}>
            Add a game <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section aria-labelledby="lineups-upcoming">
              <p className={styles.sectionKicker} id="lineups-upcoming">Upcoming games</p>
              <div className={styles.lineupFrontList}>
                {upcoming.map(e => renderRow(e, 'Build lineup'))}
              </div>
            </section>
          )}

          {recent.length > 0 && (
            <section aria-labelledby="lineups-recent">
              <p className={styles.sectionKicker} id="lineups-recent">Recent games</p>
              <div className={styles.lineupFrontList}>
                {recent.map(e => renderRow(e, 'Open lineup'))}
              </div>
            </section>
          )}

          <p className={styles.setupGuideFooter}>
            Saved lineup templates live on the <Link href={`${base}/schedule`}>Schedule</Link>, inside a game&apos;s lineup tab.
          </p>
        </>
      )}
    </div>
  );
}
