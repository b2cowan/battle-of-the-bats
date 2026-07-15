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
import { useState } from 'react';
import Link from 'next/link';
import { Pin } from 'lucide-react';
import RollingNumber from '@/components/public/RollingNumber';
import InstallAppPrompt from '@/components/InstallAppPrompt';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { useFollowedTeam } from '@/lib/follow';
import { teamColor, teamInitials } from '@/lib/team-color';
import type { CSSProperties } from 'react';
import type { GameStatus } from '@/lib/types';
import styles from './CoachLiveSchedule.module.css';

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
  opponentInitials: string;
  /** CSS colour value for the opponent monogram. */
  opponentColor: string;
  location: string | null;
  isPlayoff: boolean;
  myScore: number | null;
  oppScore: number | null;
  status: GameStatus;
};

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  teamId: string;
  teamName: string;
  teamDivisionId: string | null;
  /** Tournament public (active|completed) AND division schedule visible → links + follow. */
  live: boolean;
  /** Poll for live scores — game day only. */
  pollEnabled: boolean;
  /** Result phase (event over) → retire the live-updates copy + the install banner (5m, J5-054). */
  isResult?: boolean;
  initialGames: CoachScheduleGame[];
}

type LivePatch = { myScore: number | null; oppScore: number | null; status: GameStatus };

export default function CoachLiveSchedule({
  orgSlug,
  tournamentSlug,
  teamId,
  teamName,
  teamDivisionId,
  live,
  pollEnabled,
  isResult = false,
  initialGames,
}: Props) {
  const [games, setGames] = useState<CoachScheduleGame[]>(initialGames);

  // Live merge: only the volatile fields (scores + status) come from the poll,
  // keyed by game id. Opponent name / link / time stay from the server-resolved
  // initialGames so the poll can never re-introduce an unresolved name.
  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: pollEnabled,
    onData: data => {
      const patches = new Map<string, LivePatch>();
      for (const g of data.games ?? []) {
        if (g.homeTeamId !== teamId && g.awayTeamId !== teamId) continue;
        const isHome = g.homeTeamId === teamId;
        patches.set(g.id, {
          myScore: (isHome ? g.homeScore : g.awayScore) ?? null,
          oppScore: (isHome ? g.awayScore : g.homeScore) ?? null,
          status: g.status,
        });
      }
      if (patches.size === 0) return;
      setGames(prev => prev.map(row => {
        const patch = patches.get(row.id);
        return patch ? { ...row, ...patch } : row;
      }));
    },
  });

  const { followedTeamId, follow, unfollow } = useFollowedTeam(orgSlug, tournamentSlug);
  const isFollowing = followedTeamId === teamId;

  // UTC today, matching the page's server `today` + the phase derivation + the
  // public ScheduleContent LIVE check (consistent across the app).
  const today = new Date().toISOString().split('T')[0];
  const myColor = teamColor(teamName);
  const myInitials = teamInitials(teamName);

  return (
    <div className={styles.bridge}>
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
          {/* N3a: this is the anonymous DEVICE highlight, not alerts — a coach reading
              "Follow this team" reasonably believed they'd enabled notifications. The
              label + hint now say exactly what it does; own-team alerts live in the
              account sheet on the public page (N3b). */}
          <div className={styles.controls}>
            <button
              type="button"
              className={isFollowing ? styles.followActive : styles.followBtn}
              onClick={() =>
                isFollowing
                  ? unfollow()
                  : follow({ id: teamId, name: teamName, divisionId: teamDivisionId ?? '' })
              }
              aria-pressed={isFollowing}
            >
              <Pin size={14} fill={isFollowing ? 'currentColor' : 'none'} aria-hidden />
              {isFollowing ? 'Highlighted' : 'Highlight my team'}
            </button>
            <span className={styles.followHint}>
              {isResult
                ? 'Highlighted on the public schedule on this device.'
                : isFollowing
                  ? 'Pinned on this device’s public schedule & live scorebug.'
                  : 'Pins your team on this device’s public schedule & live scorebug — it doesn’t send alerts.'}
            </span>
          </div>
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

          const oppStyle = { '--opp-color': game.opponentColor } as CSSProperties;
          const myStyle = { '--opp-color': myColor } as CSSProperties;
          const sideLabel = game.isHome ? 'Home' : 'Away';

          // ── LIVE broadcast row — the marquee scorebug, reserved for a game in
          //    progress (submitted score, today). Mirrors the public broadcast card.
          if (isLive) {
            const inner = (
              <>
                <span className={styles.liveBadge}><span className={styles.liveDot} />LIVE</span>
                <div className={styles.matchup}>
                  <div className={styles.side}>
                    <span className={styles.mono} style={myStyle} aria-hidden>{myInitials}</span>
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
                    <span className={styles.mono} style={oppStyle} aria-hidden>{game.opponentInitials}</span>
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
              <Link key={game.id} href={game.href} className={`${styles.row} ${styles.live} ${styles.rowLink}`}>
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
                <span className={styles.monoSm} style={oppStyle} aria-hidden>{game.opponentInitials}</span>
                <span className={styles.oppName}>
                  <span className={styles.vs}>{game.isHome ? 'vs' : '@'}</span> {game.opponentName}
                  {game.isPlayoff ? <span className={styles.tag}>Playoff</span> : null}
                </span>
              </div>
              {game.location && <div className={styles.rowLoc}>{game.location}</div>}
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

          return game.href ? (
            <Link key={game.id} href={game.href} className={`${styles.row} ${styles.rowLink}`}>
              {inner}
            </Link>
          ) : (
            <div key={game.id} className={styles.row}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
