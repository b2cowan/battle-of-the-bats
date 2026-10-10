'use client';

import type { KeyboardEvent } from 'react';
import type { TournamentFormat } from '@/lib/types';
import { TOURNAMENT_FORMAT_OPTIONS } from '@/lib/tournament-phase';
import styles from './TournamentStyleCards.module.css';

/**
 * The tournament's style — one radio row per format, each with its one-line explanation (Tournament admin redesign
 * Stage 5, E1: "a choice with sub-text stays a radio row — the dropdown convention excludes it"), drawn from the single
 * list in lib/tournament-phase so every door offers the same three styles (a third, Exhibition, landed in 2026-09).
 *
 * One per row at every width (a row keeps its whole sentence and the 44px tap floor); the chosen row wears the olive
 * selection. A radio group: the arrow keys move the choice, Tab enters on the chosen row (WAI-ARIA radio group).
 */
export default function TournamentStyleCards({
  value,
  onChange,
  labelledBy,
}: {
  value: TournamentFormat | undefined;
  onChange: (format: TournamentFormat) => void;
  /** The field label's id, so the group has a name. */
  labelledBy?: string;
}) {
  const selected = value ?? 'round_robin_playoffs';
  const values = TOURNAMENT_FORMAT_OPTIONS.map(o => o.value);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = values.indexOf(selected);
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = values[(i + step + values.length) % values.length];
    onChange(next);
    const group = e.currentTarget.parentElement;
    requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>(`[data-format="${next}"]`)?.focus());
  }

  return (
    <div className={styles.group} role="radiogroup" aria-labelledby={labelledBy}>
      {TOURNAMENT_FORMAT_OPTIONS.map(opt => {
        const on = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-format={opt.value}
            className={`${styles.row}${on ? ` ${styles.rowOn}` : ''}`}
            onClick={() => onChange(opt.value)}
            onKeyDown={onKeyDown}
          >
            <span className={styles.dot} aria-hidden />
            <span className={styles.text}>
              <span className={styles.title}>{opt.title}</span>
              <span className={styles.desc}>{opt.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
