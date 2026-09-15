'use client';
import styles from '../../../../coaches.module.css';
import type { RepTeamTag } from '@/lib/types';

/** A record's money tags as chips, in the picker's own idiom — the same flat white/black pill,
 *  a club-shared tag told apart by its dot rather than the chip's fill (owner ruling 2026-09-15).
 *  One renderer for both rooms' facts lines — it had shipped once per band before. */
export function TagChips({ tagIds, moneyTags }: { tagIds: string[]; moneyTags: RepTeamTag[] }) {
  const tags = tagIds
    .map(id => moneyTags.find(t => t.id === id))
    .filter((t): t is RepTeamTag => !!t);
  return (
    <>
      {tags.map(t => {
        const isOrg = t.teamId === null;
        return (
          <span key={t.id} className={styles.tagComboChip} style={{ marginLeft: '0.5rem' }}>
            <span className={`${styles.tagComboDot} ${isOrg ? styles.tagComboDotOrg : styles.tagComboDotOwn}`} aria-hidden />
            {t.name}
          </span>
        );
      })}
    </>
  );
}
