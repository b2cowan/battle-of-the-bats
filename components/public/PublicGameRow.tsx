import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import type { GameRowView } from '@/lib/public-game-row';
import type { PublicGameState } from '@/lib/game-status';
import scheduleStyles from './PublicSchedule.module.css';
import RollingNumber from './RollingNumber';

const STATUS_WORD: Partial<Record<PublicGameState, string>> = {
  live: 'Live now', final: 'Final', unofficial: 'Unofficial', cancelled: 'Cancelled',
};

/**
 * A game's status pill, the one set every public page uses (Public page layout standard R9): Live now green, Final
 * neutral, Unofficial amber, Cancelled in the danger colour. A game that has not started has none. `className` places it
 * (a game's page puts Cancelled at its card's top right); the look is always this one.
 */
export function GameStatusPill({ state, className }: { state?: PublicGameState; className?: string }) {
  const word = state ? STATUS_WORD[state] : undefined;
  if (!word) return null;
  return <span className={className ? `${scheduleStyles.gameStatus} ${className}` : scheduleStyles.gameStatus} data-state={state}>{word}</span>;
}

export interface MatchupSide {
  name: string;
  score: number | null;
  /** Only once the game is final (or unofficial): the winner bold, the loser soft. A live game passes null (R6). */
  result: 'win' | 'lose' | null;
  /** A bracket slot no team fills yet ("Semifinal 2 winner"): drawn in dim ink. */
  placeholder?: boolean;
}

/**
 * ONE GAME, TWO FORMS (Public page layout standard R6; the Schedule's accepted compact recipe, owner 2026-10-29). The
 * head line is the time (and day or round) with the context left, the status pill right; then each team on its own
 * line owning its score, even when the name wraps.
 *
 *   · `form="wide"` (the default) — a wide desk list (Schedule, Playoffs): stacked on a phone, ONE line from 1,024 px on
 *     the 104 · rest · 104 grid for every state, live included.
 *   · `form="stacked"` — any column narrower than 600 px, at every width (the Overview, the bracket, a team's page, a
 *     game's page). `size` picks the compact bracket match (14 / 16 px) or a game's page (28 px scores); a live game wears
 *     the 3 px green edge inside the row.
 *
 * Optional lines under the teams: `noScore` ("No score yet", or a countdown), `foot` (the stakes, gold as shipped; a
 * game's page passes `footTone="plain"` for its sentences), and `place` — the field, with `action` (Directions) as a
 * strip under a hairline OUTSIDE the link, because a link cannot hold a link. `pill={false}` is for a row under a
 * "Live now" heading: the edge says it, the pill would say it twice.
 */
export function ScheduleMatchup({ time, division, pool, round, state, sides, href, noScore, foot, footTone = 'gold',
  form = 'wide', size, pill = true, place }: {
  /** Empty on a stacked result that leads with its context; a wide row always has one ("TBD" at worst). */
  time: string; division: string | null; pool?: string | null; round?: string | null; state?: PublicGameState;
  sides: MatchupSide[];
  href?: string; noScore?: string | null; foot?: string; footTone?: 'gold' | 'plain';
  form?: 'wide' | 'stacked'; size?: 'compact' | 'large'; pill?: boolean;
  place?: { text: string; action?: ReactNode };
}) {
  const stacked = form === 'stacked';
  const strip = place?.action != null;
  const body = <>
    <span className={scheduleStyles.gameHead}>
      <span className={scheduleStyles.gameMeta}>
        {/* A stacked result may lead with its context alone (the Overview's Latest results: no time, the pill says Final). */}
        {time && <span className={scheduleStyles.gameTime}>{time}{round && <small className={scheduleStyles.desktopRound}>{round}</small>}</span>}
        <span className={scheduleStyles.gameContext}>{[division, pool].filter(Boolean).join(' · ')}{round && <span className={scheduleStyles.phoneRound}>{division || pool ? ' · ' : ''}{round}</span>}</span>
      </span>
      {pill && <GameStatusPill state={state} />}
    </span>
    <span className={scheduleStyles.gameTeams}>
      {sides.map((side, i) => <Fragment key={`${i}:${side.name}`}>
        {/* Desktop only: the "vs" sits between the two sides, so it is equally close to both. */}
        {i === 1 && <span className={scheduleStyles.gameVs} aria-hidden />}
        <span className={scheduleStyles.gameSide} data-result={side.result ?? undefined} data-placeholder={side.placeholder || undefined}>
          <span className={scheduleStyles.gameName}>{side.name}</span>
          {side.score != null && <RollingNumber className={scheduleStyles.gameScore} value={side.score} />}
        </span>
      </Fragment>)}
    </span>
    {noScore && <span className={scheduleStyles.gameNoScore}>{noScore}</span>}
    {foot && <span className={scheduleStyles.stakes} data-tone={footTone === 'plain' ? 'plain' : undefined}>{foot}</span>}
    {place && !strip && <span className={scheduleStyles.gamePlace}>{place.text}</span>}
  </>;
  const edge = stacked && state === 'live' ? ` ${scheduleStyles.edge}` : '';
  const cls = `${scheduleStyles.matchLink} ${stacked ? scheduleStyles.stacked : scheduleStyles.wideForm}${strip ? '' : edge}`;
  const row = href
    ? <Link href={href} className={cls} data-state={state} data-size={stacked ? size : undefined}>{body}</Link>
    : <div className={cls} data-state={state} data-size={stacked ? size : undefined}>{body}</div>;
  if (!strip) return row;
  return <div className={`${scheduleStyles.withPlace}${edge}`}>
    {row}
    <div className={scheduleStyles.placeStrip}><span>{place.text}</span>{place.action}</div>
  </div>;
}

/**
 * A row of a wide game list — the Schedule and a team's page: the one-line row (`ScheduleMatchup`, form "wide") in the
 * list item the Schedule's day groups and highlight read. The words are lib/public-game-row.ts's (`gameRowView`); this
 * only draws them. `href` (optional) makes the row a door to the game's page; no chevron (R5's game-row exception).
 * The Overview's lists are the stacked form, drawn by the Overview itself (Public page layout standard A3).
 */
export function PublicGameRow({ view, href }: { view: GameRowView; href?: string }) {
  return <li className={scheduleStyles.gameRow} data-face={view.face} data-cancelled={view.cancelled || undefined}>
    <ScheduleMatchup time={view.head} division={view.sub} pool={view.poolTag} round={view.when} state={view.status}
      sides={view.sides} href={href} />
  </li>;
}
