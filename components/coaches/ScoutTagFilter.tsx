'use client';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The observation-log tag filter — "All" + only the tags actually in use — shared by the
 * opponent card page and the schedule drawer's Scouting tab so the two filters can never
 * drift (they are the same control in the mockups). Renders nothing when no tag is in use:
 * a filter over an unfiltered list is chrome.
 */
export default function ScoutTagFilter({ tags, value, onChange }: {
  /** Tags in use — callers pass `tags.filter(t => observations.some(o => o.tag === t))`. */
  tags: string[];
  value: string | null;
  onChange: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={styles.scoutTagRow} role="group" aria-label="Filter observations by tag">
      <button type="button" className={styles.scoutTagChip} data-on={value === null ? 'yes' : 'no'} onClick={() => onChange(null)}>
        All
      </button>
      {tags.map(t => (
        <button key={t} type="button" className={styles.scoutTagChip} data-on={value === t ? 'yes' : 'no'} onClick={() => onChange(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
