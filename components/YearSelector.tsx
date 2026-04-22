'use client';
import { Tournament } from '@/lib/types';
import styles from './YearSelector.module.css';

interface Props {
  tournaments: Tournament[];
  selected: Tournament | null;
  onSelect: (t: Tournament) => void;
}

export default function YearSelector({ tournaments, selected, onSelect }: Props) {
  if (tournaments.length <= 1) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Season:</span>
      <div className={styles.tabs}>
        {tournaments.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${selected?.id === t.id ? styles.active : ''}`}
            onClick={() => onSelect(t)}
            id={`year-tab-${t.year}`}
          >
            {t.year}
            {t.isActive && <span className={styles.liveDot} title="Current season" />}
          </button>
        ))}
      </div>
    </div>
  );
}
