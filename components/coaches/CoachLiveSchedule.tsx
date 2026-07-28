'use client';
/**
 * components/coaches/CoachLiveSchedule.tsx  (slice 5i)
 *
 * The accepted-coach game-day bridge: the team's schedule with opponent names +
 * monograms, rows that deep-link to the organizer's PUBLIC game page, and — on
 * game day — a live, auto-updating scorebug for the game in progress.
 *
 * Reuses public primitives as clean drop-ins:
 *   - usePublicTournamentLive  → 30s poll (game-day only), pauses on hidden tab.
 *   - RollingNumber            → odometer score that animates only on an actual
 *                                change (a poll returning the same score is a no-op).
 *   - lib/follow               → the SAME localStorage key as the public dock, so
 *                                following here pre-follows the team on the public site.
 *   - InstallAppPrompt         → self-managing add-to-home-screen banner.
 *
 * ⚠ Honesty: this only mounts for an ACCEPTED team whose DIVISION schedule is
 * published. `live` additionally requires the tournament to be public (active|
 * completed) — when false we render the static schedule (names, no links, no
 * polling, no follow), because the public game page + follow dock don't exist yet.
 * NULL home/away (TBD bracket games) render "TBD", never a broken link.
 *
 * Single-poll by design: the live game renders inline as a prominent broadcast row
 * (mirroring the public ScheduleContent), so there's no second polling surface.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import RollingNumber from '@/components/public/RollingNumber';
import { getMapsUrl } from '@/components/LocationLink';
import { AlertTriangle, MapPin } from 'lucide-react';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';


import type { GameStatus } from '@/lib/types';
import styles from './CoachLiveSchedule.module.css';
import { tournamentToday } from '@/lib/timezone';

export type CoachScheduleGame = {
  id: string;
  /** Deep link to the public game page; null in static (non-public) mode. */
  href: string | null;
  dateLabel: string;
  timeLabel: string | null;
  /** YYYY-MM-DD — used for the LIVE (submitted && today) check. */
  date: string | null;
  isHome: boolean;
  /** Resolved opponent name, or "TBD" for unscheduled bracket games. */
  opponentName: string;
  location: string | null;
  isPlayoff: boolean;
  myScore: number | null;
  oppScore: number | null;
  status: GameStatus;
};

/** B2.1 (owner ruling 2026-07-28): the id of the empty slot the record page renders ABOVE
 *  the Schedule zone heading. The change bar is portalled into it so it sits where the eye
 *  lands first on game day, while the 30s poll stays single-owner in THIS component — the
 *  record page is a server component and cannot hold this client state. A portal (rather
 *  than a context/provider indirection) costs nothing at first paint: the bar never exists
 *  on the server render, it only ever appears from a client-side poll. */
export const SCHEDULE_ALERT_SLOT_ID = 'coach-schedule-alert-slot';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  teamId: string;
  teamName: string;
  /** Tournament public (active|completed) AND division schedule visible → links + follow. */
  live: boolean;
  /** Poll for schedule changes + live scores. Since the owner ruling it runs from schedule
   *  publication (not game day alone) until the event is over. */
  pollEnabled: boolean;
  /** Poll cadence. Game day stays 30s; the pre-event run-up is deliberately slower. */
  pollIntervalMs?: number;
  /** When set, the change bar is hoisted out of this block into that DOM node (above the
   *  zone heading). Omit to keep the bar inline at the top of the schedule block. */
  alertSlotId?: string;
  /** Result phase (event over) → retire the live-updates copy + the install banner (5m, J5-054). */
  isResult?: boolean;
  initialGames: CoachScheduleGame[];
}

type LivePatch = {
  myScore: number | null;
  oppScore: number | null;
  status: GameStatus;
  /** B2.1: the poll has always carried these; the merge used to throw them away. */
  date: string | null;
  dateLabel: string;
  timeLabel: string | null;
  location: string | null;
};

/** B2.1 — one detected change to one of the coach's own games, kept only for this
 *  mounted session (a reload re-baselines against the fresh server render). */
type ScheduleChange = {
  gameId: string;
  kind: 'moved' | 'cancelled';
  opponentName: string;
  isHome: boolean;
  wasDateLabel: string;
  wasTimeLabel: string | null;
  wasLocation: string | null;
  nowDateLabel: string;
  nowTimeLabel: string | null;
  nowLocation: string | null;
  /** True when only the day moved (drives "moved to Sat, Jul 20" vs "moved to 3:15pm"). */
  dateChanged: boolean;
};

/* B2.1: client twins of the server-side label helpers (`formatGameDateLabel` /
   `formatGameTimeLabel` in lib/basic-coach-teams.ts, which is server-only so it can't be
   imported here). The EXPRESSIONS are identical on purpose — a polled row must render the
   same label shape as the server-rendered rows beside it. Keep them in step.
   Both are timezone-safe: the date parse pins T00:00:00 (never a bare date string, which
   would be UTC midnight and print a day early), and the time parse is a wall-clock value
   formatted in the same locale it was parsed in. */
function clientGameDateLabel(gameDate: string | null): string {
  return gameDate
    ? new Date(gameDate + 'T00:00:00').toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD';
}

function clientGameTimeLabel(gameTime: string | null): string | null {
  return gameTime
    ? new Date(`1970-01-01T${gameTime}`).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })
    : null;
}

/** "3:15 p.m. at Diamond 4" / "3:15 p.m." / "Diamond 4" — whichever parts actually exist. */
function whenWhere(timeLabel: string | null, location: string | null, dateLabel?: string): string {
  const when = [dateLabel, timeLabel].filter(Boolean).join(', ');
  if (when && location) return `${when} at ${location}`;
  return when || location || 'a time to be confirmed';
}

export default function CoachLiveSchedule({
  orgSlug,
  tournamentSlug,
  teamId,
  teamName,
  live,
  pollEnabled,
  pollIntervalMs,
  alertSlotId,
  isResult = false,
  initialGames,
}: Props) {
  const [games, setGames] = useState<CoachScheduleGame[]>(initialGames);
  // B2.1: changes detected since this page was loaded, and whether the coach has waved
  // them away. Session-only by design — a reload re-baselines against the server render,
  // so a coach never returns to a stale "your game moved" from three visits ago.
  const [changes, setChanges] = useState<ScheduleChange[]>([]);
  const [changesDismissed, setChangesDismissed] = useState(false);
  // The comparison baseline. A ref (not the state itself) so the diff runs OUTSIDE the
  // state updater — computing it inside would make the updater impure and double-run it
  // under StrictMode, duplicating every change entry.
  const gamesRef = useRef(games);
  useEffect(() => { gamesRef.current = games; }, [games]);

  // Live merge, keyed by game id. Opponent name and the public deep link stay from the
  // server-resolved initialGames so the poll can never re-introduce an unresolved name.
  //
  // B2.1: the poll has always delivered the game's date, time and location — this merge
  // used to keep only the score and status and silently discard the rest, which is why a
  // coach whose game moved mid-event saw nothing. Now the difference is applied AND
  // announced.
  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: pollEnabled,
    intervalMs: pollIntervalMs,
    onData: data => {
      const patches = new Map<string, LivePatch>();
      for (const g of data.games ?? []) {
        if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) continue;
        const isHome = g.homeTeamId === teamId;
        patches.set(g.id, {
          myScore: (isHome ? g.homeScore : g.awayScore) ?? null,
          oppScore: (isHome ? g.awayScore : g.homeScore) ?? null,
          status: g.status,
          date: g.date ?? null,
          dateLabel: clientGameDateLabel(g.date ?? null),
          timeLabel: clientGameTimeLabel(g.time ?? null),
          location: g.location ?? null,
        });
      }
      if (patches.size === 0) return;

      const detected: ScheduleChange[] = [];
      for (const row of gamesRef.current) {
        const patch = patches.get(row.id);
        if (!patch) continue;

        // A cancellation is the change a coach most needs to read correctly, so it wins
        // over any time/place difference in the same poll.
        const justCancelled = patch.status === 'cancelled' && row.status !== 'cancelled';
        const dateChanged = patch.dateLabel !== row.dateLabel;
        const timeChanged = patch.timeLabel !== row.timeLabel;
        const placeChanged = (patch.location ?? null) !== (row.location ?? null);
        if (!justCancelled && !dateChanged && !timeChanged && !placeChanged) continue;

        detected.push({
          gameId: row.id,
          kind: justCancelled ? 'cancelled' : 'moved',
          opponentName: row.opponentName,
          isHome: row.isHome,
          wasDateLabel: row.dateLabel,
          wasTimeLabel: row.timeLabel,
          wasLocation: row.location,
          nowDateLabel: patch.dateLabel,
          nowTimeLabel: patch.timeLabel,
          nowLocation: patch.location,
          dateChanged,
        });
      }

      if (detected.length > 0) {
        // Keep only the LATEST change per game — two moves in one sitting should read as
        // one correction ("was 2:00, now 4:30"), not a history the coach has to unpick.
        // The original "was" is preserved: the first entry's baseline is what they saw.
        setChanges(prev => {
          const byId = new Map(prev.map(c => [c.gameId, c] as const));
          for (const c of detected) {
            const first = byId.get(c.gameId);
            byId.set(c.gameId, first ? { ...c, wasDateLabel: first.wasDateLabel, wasTimeLabel: first.wasTimeLabel, wasLocation: first.wasLocation } : c);
          }
          return [...byId.values()];
        });
        setChangesDismissed(false); // a NEW change re-raises a bar the coach dismissed earlier
      }

      setGames(prev => prev.map(row => {
        const patch = patches.get(row.id);
        return patch ? { ...row, ...patch } : row;
      }));
    },
  });

  const visibleChanges = changesDismissed ? [] : changes;
  const changedById = new Map(changes.map(c => [c.gameId, c] as const));

  // B2.1 hoist: resolve the slot AFTER mount (document isn't available during render, and
  // the slot is server-rendered by the same page so it always exists by the time this runs).
  // Null → the bar falls back to rendering inline, so a caller that omits the slot, or a
  // future page that drops it, degrades to the old placement instead of losing the alert.
  const [alertSlot, setAlertSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!alertSlotId) return;
    // Reading the slot in a useState initializer instead would run during RENDER, and on a
    // client-side navigation (Overview → this record page) the new tree renders before it is
    // committed to the document, so the lookup would miss and the bar would silently fall
    // back inline for the rest of that visit. Post-commit is the only point the node is
    // guaranteed to exist. This runs once per mount and cannot cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlertSlot(document.getElementById(alertSlotId));
  }, [alertSlotId]);

  const changeBar = visibleChanges.length > 0 ? (
    <button
      type="button"
      className={`${styles.changeBar}${alertSlot ? ` ${styles.changeBarHoisted}` : ''}`}
      onClick={() => setChangesDismissed(true)}
      aria-label="Dismiss schedule update"
    >
      <span className={styles.changeTitle} role="status">
        <AlertTriangle size={14} aria-hidden />
        Schedule updated
      </span>
      <span className={styles.changeBody}>{changeSentence(visibleChanges)}</span>
      <span className={styles.changeMeta}>Tap to dismiss</span>
    </button>
  ) : null;

  // The auto-follow seeding that used to live here MOVED to CoachTeamAutoFollow (B2.2, ◆V1).
  // It was gated on `live`, which tied "am I a recipient of schedule alerts?" to "is the live
  // schedule on screen?" — so a coach was unreachable during the run-up, exactly when
  // organizers rearrange most. It now runs on any accepted record.

  // UTC today, matching the page's server `today` + the phase derivation + the
  // public ScheduleContent LIVE check (consistent across the app).
  const today = tournamentToday();

  return (
    <div className={styles.bridge}>
      {/* B2.1 — the organizer moved something and nobody told the coach. This is a SERVICE
          message: it states what changed and stops. It carries no upgrade prompt on any
          plan, per the pressure-ladder rule (BUSINESS_DECISIONS.md 2026-07-27), and it is
          FREE on every plan (◆R1) — push notification is the paid convenience, being
          informed is not. */}
      {changeBar && (alertSlot ? createPortal(changeBar, alertSlot) : changeBar)}

      {live && (
        <>
          {/* The install banner sells "live game updates" — only meaningful before/during the
              event, so it's retired in the result phase (5m). */}
          {!isResult && (
            <InstallAppPrompt
              appName="FieldLogicHQ"
              subtitle="Add it to your home screen for live game updates."
            />
          )}
        </>
      )}

      <div className={styles.list}>
        {games.map(game => {
          const isLive = game.status === 'submitted' && game.date === today;
          const isFinal = game.status === 'completed';
          const isCancelled = game.status === 'cancelled';
          const hasScore =
            (isFinal || game.status === 'submitted') &&
            game.myScore !== null &&
            game.oppScore !== null;

          const sideLabel = game.isHome ? 'Home' : 'Away';

          // ── LIVE broadcast row — the marquee scorebug, reserved for a game in
          //    progress (submitted score, today). Mirrors the public broadcast card.
          if (isLive) {
            const inner = (
              <>
                <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
                <div className={styles.matchup}>
                  <div className={styles.side}>
                    <span className={styles.sideName}>{teamName}</span>
                  </div>
                  <div className={styles.bcScores}>
                    {hasScore ? (
                      <>
                        <RollingNumber value={game.myScore} className={styles.bcScore} />
                        <span className={styles.bcSep}>–</span>
                        <RollingNumber value={game.oppScore} className={styles.bcScore} />
                      </>
                    ) : (
                      // Live (submitted, today) but no score posted yet — don't
                      // imply a real 0–0; RollingNumber would coalesce null→0.
                      <span className={styles.bcAwaiting}>Awaiting score</span>
                    )}
                  </div>
                  <div className={`${styles.side} ${styles.sideRight}`}>
                    <span className={styles.sideName}>{game.opponentName}</span>
                  </div>
                </div>
                <div className={styles.bcMeta}>
                  {game.timeLabel ? `${game.timeLabel} · ` : ''}{sideLabel}
                  {game.isPlayoff ? ' · Playoff' : ''}
                  {game.location ? ` · ${game.location}` : ''}
                </div>
              </>
            );
            return game.href ? (
              // B1.2: `rowLink` retired with the standard-row restructure; the live row is
              // still a single anchor (its venue stays plain text inside the broadcast meta,
              // so there's no nested-anchor problem here) and takes the same hover/press
              // feedback from `rowInteractive`.
              <Link key={game.id} href={game.href} className={`${styles.row} ${styles.live} ${styles.rowInteractive}`}>
                {inner}
              </Link>
            ) : (
              <div key={game.id} className={`${styles.row} ${styles.live}`}>{inner}</div>
            );
          }

          // ── Standard row — opponent monogram + name, deep-link, score/status.
          const result = hasScore
            ? (game.myScore as number) > (game.oppScore as number)
              ? 'W'
              : (game.myScore as number) < (game.oppScore as number)
                ? 'L'
                : 'T'
            : null;

          const inner = (
            <>
              <div className={styles.rowDate}>
                {game.dateLabel}{game.timeLabel ? ` · ${game.timeLabel}` : ''}
              </div>
              <div className={styles.rowOpp}>
                <span className={styles.oppName}>
                  <span className={styles.vs}>{game.isHome ? 'vs' : '@'}</span> {game.opponentName}
                  {game.isPlayoff ? <span className={styles.tag}>Playoff</span> : null}
                </span>
              </div>
              {isCancelled ? (
                <span className={styles.cancelChip}>Cancelled</span>
              ) : hasScore ? (
                <div className={styles.rowScore}>
                  <span className={result === 'W' ? styles.resultWin : styles.resultMuted}>{result}</span>
                  {game.myScore}–{game.oppScore}
                </div>
              ) : (
                <span className={styles.sideChip}>{sideLabel}</span>
              )}
            </>
          );

          // B1.2 — the venue is now its own Maps link, and an <a> inside an <a> is invalid
          // HTML, so the row card can no longer BE the game link. The card keeps its flex
          // layout; `.rowMain` carries the deep-link and the same wrapping behaviour the
          // row had. Rows without a public game page render the same shape, minus the link.
          // B2.1: mark the row that moved and state what it used to be, so a coach who
          // half-remembers "we're at 2" sees the correction instead of doubting themselves.
          // Survives dismissing the bar — the bar is the interruption, this is the record.
          const changed = changedById.get(game.id);

          return (
            <div key={game.id} className={`${styles.row}${game.href ? ` ${styles.rowInteractive}` : ''}${changed ? ` ${styles.rowChanged}` : ''}`}>
              {game.href ? (
                <Link href={game.href} className={styles.rowMain}>{inner}</Link>
              ) : (
                <div className={styles.rowMain}>{inner}</div>
              )}
              {game.location && (
                /* Reuses LocationLink's URL builder rather than the component itself:
                   LocationLink styles its anchor with INLINE styles (org `--primary-light`),
                   which no stylesheet can override — and in the coach portal's warm theme
                   that renders as muted grey, so the venue didn't read as tappable at all.
                   The approved mockups call for a clear link, so the anchor is styled here
                   while the Maps URL, new-tab semantics and pin icon stay identical. */
                <div className={styles.rowLoc}>
                  <a
                    href={getMapsUrl(game.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Search "${game.location}" in Google Maps`}
                    className={styles.rowLocLink}
                    onClick={e => e.stopPropagation()}
                  >
                    <MapPin size={11} aria-hidden />
                    <span className={styles.rowLocText}>{game.location}</span>
                  </a>
                </div>
              )}
              {changed && (
                <p className={styles.rowWas}>
                  {changed.kind === 'cancelled'
                    ? 'Cancelled by the organizer'
                    : `was ${whenWhere(changed.wasTimeLabel, changed.wasLocation, changed.dateChanged ? changed.wasDateLabel : undefined)}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * B2.1 banner sentence. One change gets named in full — that is the whole value, and a
 * coach mid-tournament should not have to hunt for which game moved. Two or more collapse
 * to a count plus a pointer at the marked rows, because five stacked sentences on a phone
 * is not an alert, it is a wall.
 */
function changeSentence(changes: ScheduleChange[]): string {
  if (changes.length > 1) {
    return `${changes.length} of your games have changed — see the highlighted rows below.`;
  }
  const c = changes[0];
  const which = `${c.wasTimeLabel ? `${c.wasTimeLabel} ` : ''}${c.isHome ? 'vs' : 'at'} ${c.opponentName}`;
  if (c.kind === 'cancelled') {
    return `Your ${which} has been cancelled by the organizer.`;
  }
  const now = whenWhere(c.nowTimeLabel, c.nowLocation, c.dateChanged ? c.nowDateLabel : undefined);
  return `Your ${which} moved to ${now}.`;
}
