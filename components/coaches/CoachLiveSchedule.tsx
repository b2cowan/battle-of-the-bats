'use client';
/**
 * components/coaches/CoachLiveSchedule.tsx — "Your games" on the coach's tournament page.
 *
 * Club Tier Stage 7d (drawing 7): the team's games are the portal's row list — the date and time
 * leading (a plain column on a computer, the caption line on a phone), "vs" at home and "at" away,
 * the score and result last. While the event runs it polls the public schedule (one poll, owned
 * here) for scores AND for the organizer moving a game, and says what moved.
 *
 * ⚠ THE BOOKING'S CLOCK (T7). A game's day and time are the wall-clock strings the organizer typed;
 * they are labelled by `lib/game-clock-labels.ts`, the same helpers the server render uses, so a
 * polled row and a server row cannot differ and a 6:00 p.m. game reads "6:00 p.m." on any phone. The
 * device-locale "client twins" that lived here are gone.
 * ⚠ THE ONE LIVE RULE (T8). "Playing now" is `isGameLive` (lib/game-status.ts) — the game's own time
 * window — not "a score was entered today", which missed a game in progress with no score yet.
 *
 * ⚠ Honesty: this only mounts for an ACCEPTED team whose DIVISION schedule is published. Polling
 * (`pollEnabled`) additionally requires the tournament to be public and not over; the caller decides.
 * NULL home/away (TBD bracket games) render "TBD", never a broken link.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import RollingNumber from '@/components/public/RollingNumber';
import { CoachRow, CoachRowList } from '@/components/coaches/CoachRowList';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { formatGameDateLabel, formatGameTimeLabel, homeAwayWord } from '@/lib/game-clock-labels';
import { useMinuteClock } from '@/lib/use-minute-clock';
import { isGameLive, DEFAULT_GAME_DURATION_MINUTES } from '@/lib/game-status';
import type { GameStatus } from '@/lib/types';
import portalStyles from '@/app/coaches/coaches-portal.module.css';
import styles from './CoachLiveSchedule.module.css';

export type CoachScheduleGame = {
  id: string;
  /** Deep link to the public game page; null in static (non-public) mode. */
  href: string | null;
  dateLabel: string;
  timeLabel: string | null;
  /** YYYY-MM-DD and HH:MM — the booking's own wall clock, for the live window. */
  date: string | null;
  time: string | null;
  durationMinutes: number | null;
  isHome: boolean;
  /** Resolved opponent name, or "TBD" for unscheduled bracket games. */
  opponentName: string;
  location: string | null;
  isPlayoff: boolean;
  myScore: number | null;
  oppScore: number | null;
  status: GameStatus;
};

/** B2.1 (owner ruling 2026-07-28): the id of the empty slot the record page renders ABOVE the games
 *  heading. The change bar is portalled into it so it sits where the eye lands first on game day, while
 *  the poll stays single-owner in THIS component (the record page is a server component). */
export const SCHEDULE_ALERT_SLOT_ID = 'coach-schedule-alert-slot';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  teamId: string;
  /** Poll for schedule changes + live scores — from schedule publication until the event is over. */
  pollEnabled: boolean;
  /** Poll cadence. Game day stays 30s; the pre-event run-up is deliberately slower. */
  pollIntervalMs?: number;
  /** When set, the change bar is hoisted into that DOM node (above the heading). */
  alertSlotId?: string;
  initialGames: CoachScheduleGame[];
}

type LivePatch = Pick<CoachScheduleGame, 'myScore' | 'oppScore' | 'status' | 'date' | 'time' | 'dateLabel' | 'timeLabel' | 'location'>;

/** B2.1 — one detected change to one of the coach's own games, kept only for this mounted session. */
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
  /** True when the day moved (drives "moved to Sat, Jul 20" vs "moved to 3:15 p.m."). */
  dateChanged: boolean;
};

/** "Sat, Oct 17 · 6:00 p.m." — the row's lead; the day alone when no time is set. */
function gameLead(game: Pick<CoachScheduleGame, 'dateLabel' | 'timeLabel'>): string {
  return [game.dateLabel, game.timeLabel].filter(Boolean).join(' · ');
}

/** "vs Guelph Royals 15U" / "Playoff · at Milton Mustangs 15U". */
function gameTitle(game: Pick<CoachScheduleGame, 'isHome' | 'opponentName' | 'isPlayoff'>): string {
  return `${game.isPlayoff ? 'Playoff · ' : ''}${homeAwayWord(game.isHome)} ${game.opponentName}`;
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
  pollEnabled,
  pollIntervalMs,
  alertSlotId,
  initialGames,
}: Props) {
  const [games, setGames] = useState<CoachScheduleGame[]>(initialGames);
  // Changes detected since this page was loaded, and whether the coach waved them away. Session-only:
  // a reload re-baselines against the server render.
  const [changes, setChanges] = useState<ScheduleChange[]>([]);
  const [changesDismissed, setChangesDismissed] = useState(false);
  // The comparison baseline — a ref, so the diff runs OUTSIDE the state updater (StrictMode-safe).
  const gamesRef = useRef(games);
  useEffect(() => { gamesRef.current = games; }, [games]);
  // The minute, so "Playing now" starts and ends on time between polls.
  const nowMs = useMinuteClock();

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
          time: g.time ?? null,
          dateLabel: formatGameDateLabel(g.date ?? null),
          timeLabel: formatGameTimeLabel(g.time ?? null),
          location: g.location ?? null,
        });
      }
      if (patches.size === 0) return;

      const detected: ScheduleChange[] = [];
      for (const row of gamesRef.current) {
        const patch = patches.get(row.id);
        if (!patch) continue;
        // A cancellation is the change a coach most needs to read correctly, so it wins.
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
        // The LATEST change per game, with the FIRST "was" — one correction, not a history.
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

  // Resolve the hoist slot AFTER mount (on a client navigation the new tree renders before it is
  // committed, so a render-time lookup would miss). Null → the bar renders inline.
  const [alertSlot, setAlertSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!alertSlotId) return;
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

  return (
    <>
      {/* A SERVICE message — what changed, and nothing else; free on every plan (◆R1). */}
      {changeBar && (alertSlot ? createPortal(changeBar, alertSlot) : changeBar)}

      <CoachRowList label="Your games">
        {games.map(game => {
          const live = isGameLive(
            { status: game.status, date: game.date, time: game.time },
            game.durationMinutes ?? DEFAULT_GAME_DURATION_MINUTES,
            new Date(nowMs),
          );
          const hasScore = game.myScore !== null && game.oppScore !== null &&
            (live || game.status === 'completed' || game.status === 'submitted' || game.status === 'forfeit');
          const result = hasScore
            ? (game.myScore as number) > (game.oppScore as number) ? 'W'
              : (game.myScore as number) < (game.oppScore as number) ? 'L' : 'T'
            : null;

          const trail = game.status === 'cancelled' ? (
            <span className={`${portalStyles.coachLifecycleChip} ${portalStyles.coachLifecycleChipComplete}`}>Cancelled</span>
          ) : live ? (
            <span className={styles.liveTrail}>
              <span className={`${portalStyles.coachLifecycleChip} ${portalStyles.coachLifecycleChipLive}`}>
                <span className={portalStyles.coachLifecycleChipDot} aria-hidden />Playing now
              </span>
              {hasScore && (
                <span className={styles.score}>
                  <RollingNumber value={game.myScore} />–<RollingNumber value={game.oppScore} />
                </span>
              )}
            </span>
          ) : hasScore ? (
            <span className={styles.score} data-result={result}>
              <span className={styles.result}>{result}</span> {game.myScore}–{game.oppScore}
            </span>
          ) : null;

          // B2.1: the row that moved says what it used to be — the bar is the interruption, this is the record.
          const changed = changedById.get(game.id);
          const note = changed
            ? changed.kind === 'cancelled'
              ? 'Cancelled by the organizer'
              : `was ${whenWhere(changed.wasTimeLabel, changed.wasLocation, changed.dateChanged ? changed.wasDateLabel : undefined)}`
            : undefined;

          const face = {
            lead: gameLead(game),
            leadKind: 'date-time' as const,
            title: gameTitle(game),
            caption: game.location ?? undefined,
            note,
            trail,
            className: changed ? styles.rowChanged : undefined,
            'data-day': game.date ?? undefined,
          };
          return game.href
            ? <CoachRow key={game.id} as="link" href={game.href} tooltip="Open the live game page" door="chevron" {...face} />
            : <CoachRow key={game.id} as="static" {...face} />;
        })}
      </CoachRowList>
    </>
  );
}

/**
 * B2.1 banner sentence. One change gets named in full; two or more collapse to a count plus a pointer
 * at the marked rows — five stacked sentences on a phone is not an alert, it is a wall.
 */
function changeSentence(changes: ScheduleChange[]): string {
  if (changes.length > 1) {
    return `${changes.length} of your games have changed — see the highlighted rows below.`;
  }
  const c = changes[0];
  const which = `${c.wasTimeLabel ? `${c.wasTimeLabel} ` : ''}${homeAwayWord(c.isHome)} ${c.opponentName}`;
  if (c.kind === 'cancelled') {
    return `Your ${which} has been cancelled by the organizer.`;
  }
  const now = whenWhere(c.nowTimeLabel, c.nowLocation, c.dateChanged ? c.nowDateLabel : undefined);
  return `Your ${which} moved to ${now}.`;
}
