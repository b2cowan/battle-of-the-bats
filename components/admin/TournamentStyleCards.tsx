'use client';

import type { TournamentFormat } from '@/lib/types';
import { TOURNAMENT_FORMAT_OPTIONS } from '@/lib/tournament-phase';
import styles from './TournamentStyleCards.module.css';

/**
 * The "Tournament style" cards — one per format, drawn from the single list in
 * lib/tournament-phase. Shared by the tournament setup wizard and the org sign-up wizard, which
 * used to carry identical inline copies of this markup: a third style (Exhibition, 2026-09-13)
 * had to land in both or the two doors would have offered different products.
 *
 * Three across on desktop; one per row at and below the tablet band so each card keeps its
 * whole sentence and the 44px tap floor.
 */
export default function TournamentStyleCards({
  value,
  onChange,
}: {
  value: TournamentFormat | undefined;
  onChange: (format: TournamentFormat) => void;
}) {
  const selected = value ?? 'round_robin_playoffs';
  return (
    <div className={styles.grid}>
      {TOURNAMENT_FORMAT_OPTIONS.map(opt => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={selected === opt.value}
          className={`${styles.card} ${selected === opt.value ? styles.cardSelected : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <span className={styles.title}>{opt.title}</span>
          <span className={styles.desc}>{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}
