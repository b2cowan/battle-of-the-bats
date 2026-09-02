'use client';
import styles from '../../app/[orgSlug]/coaches/coaches.module.css';

/**
 * The observation-log tag filter — "All" + only the tags actually in use — shared by the
 * opponent card page and the schedule drawer's Scouting tab so the two filters can never
 * drift (they are the same control in the mockups). Renders nothing when no tag is in use:
 * a filter over an unfiltered list is chrome.
 *
 * ⚖ **A SEGMENTED CONTROL, not tag chips** (One Tag Idiom Q7, owner-ruled 2026-09-01). Scouting
 * tags are a FIXED, owner-ratified sport-pack list — but this filter wore the same pill chips a
 * mintable tag picker wears, so a coach who had just minted a money tag read these as mintable
 * too. A segmented control cannot be added to; that is the whole message, and it needs no
 * caption (the 2026-08-29 facts-not-narration ruling). Same idiom as the Ledger's
 * Timeline · Bills · Payment schedule switch; scrolls sideways in its own container at phone
 * widths rather than wrapping into a fake tag cloud.
 *
 * ⚠ The observation ENTRY form's tag chooser (OpponentScoutingPanel, the opponent page) is a
 * different control — an input, not a filter — and is deliberately not restyled here; if it
 * changes it answers the form-selects-are-dropdowns ruling, its own question.
 */
export default function ScoutTagFilter({ tags, value, onChange }: {
  /** Tags in use — callers pass `tags.filter(t => observations.some(o => o.tag === t))`. */
  tags: string[];
  value: string | null;
  onChange: (tag: string | null) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className={styles.scoutSegWrap} role="group" aria-label="Filter observations by tag">
      <div className={styles.viewToggle}>
        <button
          type="button"
          className={`${styles.viewToggleBtn} ${value === null ? styles.viewToggleBtnActive : ''}`}
          onClick={() => onChange(null)}
        >
          All
        </button>
        {tags.map(t => (
          <button
            key={t}
            type="button"
            className={`${styles.viewToggleBtn} ${value === t ? styles.viewToggleBtnActive : ''}`}
            onClick={() => onChange(t)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
