import Link from 'next/link';
import type { GameRowView } from '@/lib/public-game-row';
import kit from './ClubKit.module.css';
import styles from './PublicParts.module.css';

/**
 * The game row (Public tournament pages Stage 2; hub "The end state"): Up next and Latest results on the Overview, the
 * Schedule in Stage 3. The words are lib/public-game-row.ts's (`gameRowView`); this only draws them — the scheduled
 * face (time over day, both teams, division · field) and the finished face (Final over the date, the winner first and
 * bold, both scores). From 1,024 px a scheduled game reads on one line with its division and field on the right.
 * `href` (optional) makes the row a door to the game's page; the drawing shows no chevron, so none is drawn.
 */
export function PublicGameRow({ view, href }: { view: GameRowView; href?: string }) {
  const final = view.face === 'final';
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
