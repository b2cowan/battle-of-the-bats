'use client';
import styles from '../../../../coaches.module.css';
import type { RepTeamTag } from '@/lib/types';

/** A record's money tags as chips, in the picker's own idiom (a club-shared tag reads blue). One
 *  renderer for both rooms' facts lines — it had shipped once per band before. */
export function TagChips({ tagIds, moneyTags }: { tagIds: string[]; moneyTags: RepTeamTag[] }) {
  const tags = tagIds
    .map(id => moneyTags.find(t => t.id === id))
    .filter((t): t is RepTeamTag => !!t);
  return (
    <>
      {tags.map(t => (
        <span key={t.id} className={`${styles.tagComboChip} ${t.teamId === null ? styles.tagComboChipOrg : ''}`} style={{ marginLeft: '0.5rem' }}>
          {t.name}
        </span>
      ))}
    </>
  );
}
