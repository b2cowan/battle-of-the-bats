'use client';
/**
 * SWITCH ROWS — a list of 52px rows whose whole width is the switch (Tournament admin redesign Stage 5, E6 + E7, A54):
 * Notifications' "Tell me when" and Public site's Pages. A 36×20 switch in a table cell, and 15px page checkboxes,
 * before. Each row is ONE button (role="switch"), so a tap anywhere on it toggles and focus stays on it while it saves.
 *
 *   SwitchRows   the list (`columns={2}` lays it in two columns at a desk — Public site's Pages)
 *   SwitchRow    one row: its name, an optional caption, the drawn switch
 */
import type { ReactNode } from 'react';
import styles from './SwitchRows.module.css';

export function SwitchRows({ label, columns = 1, children }: { label?: string; columns?: 1 | 2; children: ReactNode }) {
  return <ul className={columns === 2 ? `${styles.rows} ${styles.rowsTwo}` : styles.rows} aria-label={label}>{children}</ul>;
}

export function SwitchRow({ on, name, caption, onToggle }: {
  on: boolean; name: ReactNode; caption?: ReactNode; onToggle: () => void;
}) {
  return (
    <li>
      <SwitchButton on={on} name={name} caption={caption} onToggle={onToggle} />
    </li>
  );
}

/** The row's button alone — for a single switch standing in its own card (Mute everything from this tournament). */
export function SwitchButton({ on, name, caption, onToggle }: {
  on: boolean; name: ReactNode; caption?: ReactNode; onToggle: () => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} className={styles.row} onClick={onToggle}>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {caption != null && <span className={styles.caption}>{caption}</span>}
      </span>
      <span className={styles.switch} aria-hidden />
    </button>
  );
}
