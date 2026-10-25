'use client';
/**
 * A record's Story, drawn (Support console Stage 2; drawings "The customer record reads first"). Columns When · What
 * happened · Who · Why, and — where the role may undo something — an unheaded last column holding Put it back.
 *
 *   • What happened is plain bold, never a link: an entry opens nothing (design pass);
 *   • Who never breaks; Why says "Not recorded" in grey for an older change that never kept one, "—" where none applies;
 *   • Put it back is ABSENT, not greyed, where it cannot apply (R5); an entry already put back says when instead;
 *   • the trail of records opened is never here (A3).
 * Shared by the club and the person record, so both read the same way.
 */
import { Undo2 } from 'lucide-react';
import type { StoryEntry, PutBackKind } from '@/lib/platform-story-view';
import { consoleClock, consoleWhen } from '@/lib/console-dates';
import kit from './console.module.css';
import styles from './record.module.css';

export default function StoryTable({ entries, canPutBack, onPutBack, emptyText }: {
  entries: StoryEntry[];
  /** Whether this role holds the power a kind of Put it back needs; no column at all when it holds none. */
  canPutBack?: (kind: PutBackKind) => boolean;
  onPutBack?: (entry: StoryEntry) => void;
  emptyText: string;
}) {
  const showColumn = !!canPutBack && (['plan', 'section', 'override'] as PutBackKind[]).some(k => canPutBack(k));
  return (
    <div className={kit.tableWrap}>
      <table className={`${styles.story} ${kit.comfortable}`}>
        <thead>
          <tr>
            <th className={styles.colWhen}>When</th>
            <th>What happened</th>
            <th className={styles.colWho}>Who</th>
            <th className={styles.colWhy}>Why</th>
            {showColumn && <th className={styles.colPut} aria-label="Put it back" />}
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr><td colSpan={showColumn ? 5 : 4} className={kit.empty}>{emptyText}</td></tr>
          )}
          {entries.map(e => (
            <tr key={e.key}>
              <td className={styles.colWhen}>{consoleWhen(e.at)}</td>
              <td>
                <span className={styles.what}>
                  {e.title}
                  {e.codes && <> <code className={kit.code}>{e.codes[0]}</code> → <code className={kit.code}>{e.codes[1]}</code></>}
                </span>
                {e.putBackAt
                  ? <span className={styles.putBackAt}>Put back at {consoleClock(e.putBackAt)}</span>
                  : e.sub && <span className={styles.whatSub}>{e.sub}</span>}
              </td>
              <td className={styles.colWho}>{e.who}</td>
              <td className={styles.colWhy}>
                {e.why ?? <span className={kit.muted}>{e.whyNotRecorded ? 'Not recorded' : '—'}</span>}
              </td>
              {showColumn && (
                <td className={styles.colPut}>
                  {e.putBack && canPutBack?.(e.putBack.kind) && (
                    <button type="button" className={styles.putDoor} onClick={() => onPutBack?.(e)}>
                      <Undo2 size={12} aria-hidden /> Put it back
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
