import Link from 'next/link';
import type { FactRow } from '@/lib/public-pre-event';
import styles from './PublicParts.module.css';

/**
 * The facts list (Public tournament pages Stage 2 Part 3; hub "Before the event", the `dl` card): Divisions, Where, Schedule,
 * Rules — each a label and its answer, a door where the answer is somewhere else. Rows are lib/public-pre-event.ts's
 * (`preEventFacts`); a row the event has nothing for is not in the list. A place opens its directions in a new tab, a
 * page opens in the same one.
 */
export default function PublicFactsList({ rows }: { rows: FactRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className={styles.facts}>
      {rows.map(r => (
        <div key={r.key} className={styles.fact}>
          <dt>{r.label}</dt>
          <dd>
            {r.href ? (
              r.href.startsWith('http')
                ? <a className={styles.factLink} href={r.href} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${r.text}`}>{r.text} ›</a>
                : <Link className={styles.factLink} href={r.href}>{r.text} ›</Link>
            ) : (
              <span className={r.key === 'schedule' ? styles.factSoft : undefined}>{r.text}</span>
            )}
            {r.more && <span className={styles.factMore}>{r.more}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
