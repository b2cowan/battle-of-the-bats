'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAllFollowedTeams, useAllFollowedTournaments, useAllFollowedOrgs } from '@/lib/follow';
import { useScoresFeed } from '@/lib/hooks/useScoresFeed';
import {
  buildScoresView,
  FUTURE_WINDOW_DAYS,
  PAST_WINDOW_DAYS,
  REASON_LABEL,
  type ScoresEvent,
  type ScoresOrgTile,
  type ScoresGameRow,
  type ScoresDayGroup,
} from '@/lib/scores-view';
import { teamColor, teamInitials } from '@/lib/team-color';
import warm from './warmTheme.module.css';
import styles from './ScoresClient.module.css';

/** The anon-safe platform live board (SSR'd) — the signed-out / zero-follows fallback. */
export interface ScoresBoardItem {
  id: string;
  href: string;
  logoUrl: string | null;
  tournamentName: string;
  orgName: string;
  sportLabel: string;
}

/**
 * Scores tab (Unified Home, Phase 3). Two lanes over the account's union of memberships +
 * follows — a My Events grid and a My Games list — client-fetched from /api/consumer/scores
 * so the SSR shell stays anon-safe (it renders only `liveBoard`). Signed-out visitors' device
 * follows populate the lanes client-side; a fresh live poll keeps the Live section current.
 */
export default function ScoresClient({ liveBoard }: { liveBoard: ScoresBoardItem[] }) {
  const { teams: deviceTeams, ready } = useAllFollowedTeams();
  const { tournaments: deviceTournaments, ready: tReady } = useAllFollowedTournaments();
  const { orgs: deviceOrgs, ready: oReady } = useAllFollowedOrgs();
  const deviceInputs = useMemo(
    () => deviceTeams.map(t => ({ teamId: t.id, teamName: t.name, orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
    [deviceTeams],
  );
  const deviceTournInputs = useMemo(
    () => deviceTournaments.map(t => ({ orgSlug: t.orgSlug, tournamentSlug: t.tournamentSlug })),
    [deviceTournaments],
  );
  const deviceOrgInputs = useMemo(() => deviceOrgs.map(o => ({ orgSlug: o.orgSlug })), [deviceOrgs]);
  const { payload, loading } = useScoresFeed({
    deviceTeams: deviceInputs,
    deviceTournaments: deviceTournInputs,
    deviceOrgs: deviceOrgInputs,
    deviceReady: ready && tReady && oReady,
  });

  const [filter, setFilter] = useState<'all' | 'live'>('all');
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [showLater, setShowLater] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);

  const events = payload?.events ?? [];
  const orgTiles = payload?.orgTiles ?? [];
  const liveCount = payload?.liveCount ?? 0;
  const hasPersonal = events.length > 0 || orgTiles.length > 0 || (payload?.games.length ?? 0) > 0;

  const view = useMemo(() => buildScoresView(payload?.games ?? []), [payload]);

  // Still resolving the first payload — quiet skeleton (the SSR shell already painted the board).
  if (!payload && loading) {
    return (
      <div className={`${warm.warm} ${styles.page}`}>
        <Header />
        <div className={styles.skeleton} aria-hidden />
      </div>
    );
  }

  // Nothing personal → the platform-wide live board + a gentle nudge (never a dead page).
  if (!hasPersonal) {
    return (
      <div className={`${warm.warm} ${styles.page}`}>
        <Header />
        <PlatformBoard board={liveBoard} signedIn={payload?.signedIn ?? false} />
      </div>
    );
  }

  const liveOnly = filter === 'live';
  // My Events grid = event tiles + one org rollup tile per followed org (F4), live tiles first.
  const gridItems: GridItem[] = [
    ...(liveOnly ? events.filter(e => e.liveCount > 0) : events).map(e => ({ type: 'event' as const, event: e })),
    ...(liveOnly ? orgTiles.filter(o => o.live) : orgTiles).map(o => ({ type: 'org' as const, org: o })),
  ].sort((a, b) => Number(itemLive(b)) - Number(itemLive(a)));
  const liveRows = view.live;

  // Upcoming / past caps: initial window shows today..+3 days and yesterday..-7 days;
  // the rest hides behind the ghost "Show later" / "Show earlier" buttons (no infinite scroll).
  const upcomingInWindow = view.upcoming.filter(g => g.dayOffset <= FUTURE_WINDOW_DAYS);
  const upcomingOverflow = view.upcoming.filter(g => g.dayOffset > FUTURE_WINDOW_DAYS);
  const pastInWindow = view.past.filter(g => g.dayOffset >= -PAST_WINDOW_DAYS);
  const pastOverflow = view.past.filter(g => g.dayOffset < -PAST_WINDOW_DAYS);

  // "Next up" only when there are genuinely not-yet-played games — a finished game earlier
  // today lands in view.upcoming (dayOffset 0) too, so gate the label on real upcoming state,
  // not just the presence of a today-or-later day group.
  const hasUpcomingGame = view.upcoming.some(g => g.rows.some(r => r.state === 'upcoming'));
  const gamesKicker = liveCount > 0 ? 'My Games' : hasUpcomingGame ? 'Next up' : 'Recent results';

  return (
    <div className={`${warm.warm} ${styles.page}`}>
      <Header />

      <div className={styles.filterRow}>
        <button
          type="button"
          className={`${styles.filterPill} ${!liveOnly ? styles.filterPillActive : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          className={`${styles.filterPill} ${liveOnly ? styles.filterPillActive : ''}`}
          onClick={() => setFilter('live')}
          aria-pressed={liveOnly}
        >
          <span className={styles.filterLiveDot} aria-hidden /> Live{' '}
          <span className={styles.filterCount}>· {liveCount}</span>
        </button>
      </div>

      {/* ── My Events grid ── */}
      {gridItems.length > 0 && (
        <section className={styles.section}>
          <p className={styles.kicker}>My Events</p>
          <EventsGrid items={gridItems} expanded={eventsExpanded} onToggle={() => setEventsExpanded(v => !v)} />
        </section>
      )}

      {/* ── My Games list ── */}
      <section className={styles.section}>
        <p className={styles.kicker}>{liveOnly ? 'Live now' : gamesKicker}</p>

        {liveRows.length > 0 && (
          <div className={styles.dayGroup}>
            {!liveOnly && <p className={styles.dayLabel}>Live</p>}
            <div className={styles.gameList}>
              {liveRows.map(row => <GameRow key={row.key} row={row} />)}
            </div>
          </div>
        )}

        {liveOnly ? (
          liveRows.length === 0 && (
            <p className={styles.quiet}>None of your games are live right now. Switch to All to see today&rsquo;s and upcoming games.</p>
          )
        ) : (
          <>
            <DayGroupWindow
              inWindow={upcomingInWindow}
              overflow={upcomingOverflow}
              expanded={showLater}
              onExpand={() => setShowLater(true)}
              label="Show later"
            />
            <DayGroupWindow
              inWindow={pastInWindow}
              overflow={pastOverflow}
              expanded={showEarlier}
              onExpand={() => setShowEarlier(true)}
              label="Show earlier results"
              past
            />

            {liveRows.length === 0 && view.upcoming.length === 0 && view.past.length === 0 && (
              <p className={styles.quiet}>No games yet for the teams and events you follow.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function Header() {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>Scores</h1>
      <p className={styles.subtitle}>Live scores for the teams and events you follow.</p>
    </div>
  );
}

/* ── My Events ─────────────────────────────────────────────────────────────── */

/** A My-Events grid cell — either a tournament/event tile or a followed-org rollup tile (F4). */
type GridItem = { type: 'event'; event: ScoresEvent } | { type: 'org'; org: ScoresOrgTile };
const itemKey = (i: GridItem) => (i.type === 'event' ? i.event.key : i.org.key);
const itemLive = (i: GridItem) => (i.type === 'event' ? i.event.liveCount > 0 : i.org.live);

function EventsGrid({ items, expanded, onToggle }: { items: GridItem[]; expanded: boolean; onToggle: () => void }) {
  const CAP = 4; // 2 columns × 2 rows
  const overflow = items.length > CAP;
  // Collapsed with overflow: 3 tiles + a "+N more" tile fills the 4th cell (2 rows).
  const visible = overflow && !expanded ? items.slice(0, CAP - 1) : items;
  const hiddenCount = items.length - (CAP - 1);

  return (
    <div className={styles.eventsGrid}>
      {visible.map(i => i.type === 'event'
        ? <EventTile key={itemKey(i)} event={i.event} />
        : <OrgTile key={itemKey(i)} org={i.org} />)}
      {overflow && !expanded && (
        <button type="button" className={styles.moreTile} onClick={onToggle}>+{hiddenCount} more</button>
      )}
      {overflow && expanded && (
        <button type="button" className={styles.moreTile} onClick={onToggle}>Show fewer</button>
      )}
    </div>
  );
}

/** F4: ONE rollup tile per followed org — round monogram + Following chip + one mono fragment;
 *  tap → the org page (which self-routes to its live event when exactly one is on). */
function OrgTile({ org }: { org: ScoresOrgTile }) {
  return (
    <Link href={org.href} className={styles.eventTile}>
      {org.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={org.logoUrl} alt="" className={`${styles.eventLogo} ${styles.orgLogoRound}`} />
      ) : (
        <span className={`${styles.eventLogo} ${styles.orgLogoRound}`} style={{ background: teamColor(org.orgName, 55, 42) }} aria-hidden>
          {teamInitials(org.orgName)}
        </span>
      )}
      <span className={styles.eventBody}>
        <span className={styles.eventTop}>
          <span className={styles.eventName}>{org.orgName}</span>
          <span className={styles.eventChip} data-reason="following">{REASON_LABEL.following}</span>
        </span>
        <span className={`${styles.eventFragment} ${org.live ? styles.eventFragmentLive : ''}`}>
          {org.live && <span className={styles.eventLiveDot} aria-hidden />}
          {org.fragment}
        </span>
      </span>
    </Link>
  );
}

function EventTile({ event }: { event: ScoresEvent }) {
  const live = event.group === 'live';
  return (
    <Link
      href={event.href}
      className={`${styles.eventTile} ${event.group === 'completed' ? styles.eventTileCompleted : ''}`}
    >
      {event.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.logoUrl} alt="" className={styles.eventLogo} />
      ) : (
        <span className={styles.eventLogo} style={{ background: teamColor(event.name, 55, 42) }} aria-hidden>
          {teamInitials(event.name)}
        </span>
      )}
      <span className={styles.eventBody}>
        <span className={styles.eventTop}>
          <span className={styles.eventName}>{event.name}</span>
          <span className={styles.eventChip} data-reason={event.reason}>{REASON_LABEL[event.reason]}</span>
        </span>
        <span className={`${styles.eventFragment} ${live ? styles.eventFragmentLive : ''}`}>
          {live && <span className={styles.eventLiveDot} aria-hidden />}
          {event.fragment}
        </span>
      </span>
    </Link>
  );
}

/* ── My Games ──────────────────────────────────────────────────────────────── */

/** In-window day groups + the ghost "Show more" cap for the overflow — one shape for both
 *  the upcoming ("Show later") and past ("Show earlier results") directions. */
function DayGroupWindow({ inWindow, overflow, expanded, onExpand, label, past }: {
  inWindow: ScoresDayGroup[];
  overflow: ScoresDayGroup[];
  expanded: boolean;
  onExpand: () => void;
  label: string;
  past?: boolean;
}) {
  return (
    <>
      {inWindow.map(g => <DayGroup key={g.date} group={g} past={past} />)}
      {overflow.length > 0 && (expanded
        ? overflow.map(g => <DayGroup key={g.date} group={g} past={past} />)
        : <button type="button" className={styles.showMore} onClick={onExpand}>{label}</button>)}
    </>
  );
}

function DayGroup({ group, past }: { group: ScoresDayGroup; past?: boolean }) {
  return (
    <div className={styles.dayGroup}>
      <p className={styles.dayLabel}>{group.label}</p>
      <div className={styles.gameList}>
        {group.rows.map(row => <GameRow key={row.key} row={row} past={past} />)}
      </div>
    </div>
  );
}

function GameRow({ row, past }: { row: ScoresGameRow; past?: boolean }) {
  const hasScores = row.myScore != null && row.oppScore != null;
  const myLead = hasScores && row.myScore! > row.oppScore!;
  const oppLead = hasScores && row.oppScore! > row.myScore!;

  // Finals collapse to a W/L/T chip; live rows carry the score motion; upcoming show the time.
  const outcome = (row.state === 'final' || row.state === 'unofficial') && hasScores
    ? (row.myScore! > row.oppScore! ? 'W' : row.myScore! < row.oppScore! ? 'L' : 'T')
    : null;

  const meta =
    row.state === 'live' ? { text: 'Live', live: true } :
    row.state === 'upcoming' ? { text: [row.timeLabel, row.location].filter(Boolean).join(' · ') || 'Scheduled', live: false } :
    { text: row.state === 'unofficial' ? 'Unofficial' : 'Final', live: false };

  return (
    <Link href={row.href} className={`${styles.gameRow} ${row.live ? styles.gameRowLive : ''} ${past ? styles.gameRowPast : ''}`}>
      <span className={styles.gameMono} style={{ background: teamColor(row.teamName, 55, 42) }} aria-hidden>
        {teamInitials(row.teamName)}
      </span>
      <span className={styles.gameBody}>
        <span className={styles.teamLine}>
          <span className={`${styles.teamName} ${styles.teamNameMine}`}>{row.teamName}</span>
          {hasScores && <span className={`${styles.teamScore} ${myLead ? styles.teamScoreLead : ''}`}>{row.myScore}</span>}
        </span>
        <span className={styles.teamLine}>
          <span className={styles.teamName}>{row.opponentName ?? 'TBD'}</span>
          {hasScores && <span className={`${styles.teamScore} ${oppLead ? styles.teamScoreLead : ''}`}>{row.oppScore}</span>}
        </span>
        <span className={`${styles.gameMeta} ${meta.live ? styles.gameMetaLive : ''}`}>
          {meta.live && <span className={styles.gameLiveDot} aria-hidden />}
          {meta.text}
        </span>
      </span>
      <span className={styles.gameTrail}>
        {outcome && (
          <span className={`${styles.wlChip} ${outcome === 'W' ? styles.wlWin : outcome === 'L' ? styles.wlLoss : styles.wlTie}`}>
            {outcome}
          </span>
        )}
      </span>
    </Link>
  );
}

/* ── Platform board (signed-out / zero-follows) ────────────────────────────── */

function PlatformBoard({ board, signedIn }: { board: ScoresBoardItem[]; signedIn: boolean }) {
  return (
    <>
      {board.length > 0 ? (
        <section className={styles.section}>
          <p className={styles.kicker}>Live around FieldLogicHQ</p>
          <div className={styles.gameList}>
            {board.map(item => (
              <Link key={item.id} href={item.href} className={styles.boardCard}>
                {item.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.logoUrl} alt="" className={styles.boardLogo} />
                ) : (
                  <span className={styles.boardLogo} style={{ background: teamColor(item.tournamentName, 55, 42) }} aria-hidden>
                    {teamInitials(item.tournamentName)}
                  </span>
                )}
                <span className={styles.boardBody}>
                  <span className={styles.boardName}>{item.tournamentName}</span>
                  <span className={styles.boardMeta}>{item.orgName} · {item.sportLabel}</span>
                </span>
                <span className={styles.boardLive}><span className={styles.boardLiveDot} aria-hidden />Live</span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <p className={styles.emptyTitle}>No games are live right now</p>
      )}

      <div className={styles.nudge}>
        <p className={styles.nudgeText}>
          {signedIn
            ? 'Follow a team or tournament and its scores show up here — live, today, and your recent results.'
            : 'Sign in or follow a team to build your own scoreboard — your live games, today, and recent results in one place.'}
        </p>
        <div className={styles.nudgeActions}>
          <Link href="/discover" className={`${styles.nudgeBtn} ${styles.nudgePrimary}`}>Browse tournaments</Link>
          {!signedIn && (
            <Link href="/auth/login?next=%2Fscores" className={`${styles.nudgeBtn} ${styles.nudgeGhost}`}>Sign in</Link>
          )}
        </div>
      </div>
    </>
  );
}
