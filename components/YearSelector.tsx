'use client';
import Link from 'next/link';
import { Tournament } from '@/lib/types';
import styles from './YearSelector.module.css';

interface Props {
  tournaments: Tournament[];
  orgSlug: string;
  currentTournamentSlug: string;
  currentPage: string;
}

export default function YearSelector({ tournaments, orgSlug, currentTournamentSlug, currentPage }: Props) {
  if (tournaments.length <= 1) return null;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Season:</span>
      <div className={styles.tabs}>
        {tournaments.map(t => (
          <Link
            key={t.id}
            href={`/${orgSlug}/${t.slug}/${currentPage}`}
            className={`${styles.tab} ${t.slug === currentTournamentSlug ? styles.active : ''}`}
            id={`year-tab-${t.year}`}
          >
            {t.year}
            {t.status === 'active' && <span className={styles.liveDot} title="Current season" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
