import Link from 'next/link';
import type { GameRowView } from '@/lib/public-game-row';
import type { PublicGameState } from '@/lib/game-status';
import kit from './ClubKit.module.css';
import styles from './PublicParts.module.css';
import scheduleStyles from './PublicSchedule.module.css';
import RollingNumber from './RollingNumber';

/** The Schedule's accepted compact recipe: each team and score share a row, even when the name wraps. */
export function ScheduleMatchup({ time, division, pool, round, state, sides, href, noScore, foot }: {
  time: string; division: string | null; pool?: string | null; round?: string | null; state?: PublicGameState;
  sides: { name: string; score: number | null; result: 'win' | 'lose' | null }[];
  href?: string; noScore?: string | null; foot?: string;
}) {
  const status = state === 'live' ? 'Live now' : state === 'unofficial' ? 'Unofficial' : state === 'cancelled' ? 'Cancelled' : state === 'final' ? 'Final' : null;
  const body = <>
    <span className={scheduleStyles.gameHead}>
      <span className={scheduleStyles.gameMeta}>
        <span className={scheduleStyles.gameTime}>{time}{round && <small className={scheduleStyles.desktopRound}>{round}</small>}</span>
        <span className={scheduleStyles.gameContext}>{[division, pool].filter(Boolean).join(' · ')}{round && <span className={scheduleStyles.phoneRound}> · {round}</span>}</span>
      </span>
      {status && <span className={scheduleStyles.gameStatus} data-state={state}>{status}</span>}
    </span>
    <span className={scheduleStyles.gameTeams}>
      {sides.map((side, i) => <span key={`${i}:${side.name}`} className={scheduleStyles.gameSide} data-result={side.result ?? undefined}>
        <span className={scheduleStyles.gameName}>{side.name}</span>
        {side.score != null && <RollingNumber className={scheduleStyles.gameScore} value={side.score} />}
      </span>)}
    </span>
    {noScore && <span className={scheduleStyles.gameNoScore}>{noScore}</span>}
    {foot && <span className={scheduleStyles.stakes}>{foot}</span>}
  </>;
  return href ? <Link href={href} className={scheduleStyles.matchLink} data-state={state}>{body}</Link>
    : <div className={scheduleStyles.matchLink} data-state={state}>{body}</div>;
}

/**
 * The game row (Public tournament pages Stage 2; hub "The end state"): Up next and Latest results on the Overview, the
 * Schedule in Stage 3. The words are lib/public-game-row.ts's (`gameRowView`); this only draws them — the scheduled
 * face (time over day, both teams, division · field) and the finished face (Final over the date, the winner first and
 * bold, both scores). From 1,024 px a scheduled game reads on one line with its division and field on the right.
 * `href` (optional) makes the row a door to the game's page; the drawing shows no chevron, so none is drawn.
 */
export function PublicGameRow({ view, href, schedule = false }: {
  view: GameRowView; href?: string; schedule?: boolean;
}) {
  const final = view.face === 'final';
  if (schedule) {
    return <li className={scheduleStyles.gameRow} data-face={view.face} data-cancelled={view.cancelled || undefined}>
      <ScheduleMatchup time={view.head} division={view.sub} pool={view.poolTag} round={view.when} state={view.status}
        sides={view.sides} href={href} />
    </li>;
  }
  const body = (
    <>
      <span className={styles.when}>
        {view.head}
        {view.when && <small>{view.when}</small>}
      </span>
      <span className={styles.teams}>
        {view.sides.map((s, i) => (
          <span key={i} className={s.result === 'win' ? styles.win : s.result === 'lose' ? styles.lose : undefined}>{s.name}</span>
        ))}
      </span>
      {view.sub && <span className={styles.sub}>{view.sub}</span>}
      {final && (
        <span className={styles.scores}>
          <span className={kit.srOnly}>{view.sides.map(s => `${s.name} ${s.score}`).join(', ')}</span>
          {view.sides.map((s, i) => <span key={i} className={s.result === 'lose' ? styles.lose : undefined} aria-hidden>{s.score}</span>)}
        </span>
      )}
    </>
  );
  return (
    <li>
      {href
        ? <Link className={styles.row} data-face={view.face} href={href}>{body}</Link>
        : <div className={styles.row} data-face={view.face}>{body}</div>}
    </li>
  );
}

/** The card the rows sit in. */
export function PublicGameRows({ views, href }: { views: GameRowView[]; href?: (id: string) => string }) {
  if (views.length === 0) return null;
  return (
    <ul className={styles.rows}>
      {views.map(v => <PublicGameRow key={v.id} view={v} href={href?.(v.id)} />)}
    </ul>
  );
}
