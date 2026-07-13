'use client';
import Link from 'next/link';
import type { FollowedTeamEntry } from '@/lib/follow';
import styles from './ConsumerPage.module.css';

/** Turn a kebab-case slug into a readable label ("battle-of-the-bats" → "Battle Of The Bats"). */
function prettifySlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Renders followed teams as tappable cards linking into their tournament. */
export default function FollowCardList({ teams }: { teams: FollowedTeamEntry[] }) {
  return (
    <div className={styles.list}>
      {teams.map((t) => (
        <Link
          key={`${t.orgSlug}/${t.tournamentSlug}/${t.id}`}
          href={`/${t.orgSlug}/${t.tournamentSlug}`}
          className={styles.card}
        >
          <span className={styles.cardLogoFallback} aria-hidden>
            {(t.name || '?').charAt(0).toUpperCase()}
          </span>
          <span className={styles.cardBody}>
            <span className={styles.cardName}>{t.name || 'Followed team'}</span>
            <span className={styles.cardMeta}>{prettifySlug(t.tournamentSlug)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
