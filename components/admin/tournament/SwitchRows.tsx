'use client';
/**
 * SWITCH ROWS — a list of 52px rows whose whole width is the switch (Tournament admin redesign Stage 5, E6 + E7, A54):
 * Notifications' "Tell me when" and Public site's Pages. A 36×20 switch in a table cell, and 15px page checkboxes,
 * before. Each row is ONE button (role="switch"), so a tap anywhere on it toggles and focus stays on it while it saves.
 *
 *   SwitchRows   the list (`columns={2}` lays it in two columns at a desk — Public site's Pages)
 *   SwitchRow    one row: its name, an optional caption, the drawn switch
 *
 * Event settings' 16 on/off settings stand on it too (Stage 5 addendum, P1, owner 2026-10-12), with two states it
 * brought: `dim` (a setting not in effect right now — the six coach emails while Automatic coach emails is off — still
 * a switch, keeping its value) and `disabled` (one the plan doesn't include; the caller says why beside it). A list
 * laid edge to edge in a card body lines its text up with the fields by setting `--switch-row-inline` to the card's
 * own side padding.
 *
 *   SwitchFixedRow  a row in the list that is not a switch: its name, its caption and a word where the switch would be
 *                   (Event settings' "Player names · Always" — every roster carries them)
 */
import type { ReactNode } from 'react';
import styles from './SwitchRows.module.css';

export function SwitchRows({ label, columns = 1, children }: { label?: string; columns?: 1 | 2; children: ReactNode }) {
  return <ul className={columns === 2 ? `${styles.rows} ${styles.rowsTwo}` : styles.rows} aria-label={label}>{children}</ul>;
}

type SwitchProps = {
  on: boolean; name: ReactNode; caption?: ReactNode; onToggle: () => void;
  /** Not in effect right now (see the header): the kit's off row, still a switch. */
  dim?: boolean;
  /** Not on the plan: the switch can't be pressed. */
  disabled?: boolean;
};

export function SwitchRow(props: SwitchProps) {
  return (
    <li>
      <SwitchButton {...props} />
    </li>
  );
}

/** A row in the list that is not a switch: the row's look, with a word in the switch's place. */
export function SwitchFixedRow({ name, caption, word }: { name: ReactNode; caption?: ReactNode; word: ReactNode }) {
  return (
    <li>
      <div className={`${styles.row} ${styles.rowFixed}`}>
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          {caption != null && <span className={styles.caption}>{caption}</span>}
        </span>
        <span className={styles.word}>{word}</span>
      </div>
    </li>
  );
}

/** The row's button alone — for a single switch standing in its own card (Mute everything from this tournament). */
export function SwitchButton({ on, name, caption, onToggle, dim = false, disabled = false }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={on} className={dim ? `${styles.row} ${styles.rowDim}` : styles.row}
      onClick={onToggle} disabled={disabled}>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {caption != null && <span className={styles.caption}>{caption}</span>}
      </span>
      <span className={styles.switch} aria-hidden />
    </button>
  );
}
