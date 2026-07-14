'use client';
import type { FollowFeedEntry, FollowFeedGroup } from '@/lib/follow-feed';
import FollowFeedCard from './FollowFeedCard';
import styles from './ConsumerPage.module.css';

const GROUPS: { group: FollowFeedGroup; label: string }[] = [
  { group: 'live', label: 'Live now' },
  { group: 'upcoming', label: 'Coming up' },
  { group: 'recent', label: 'Recent' },
  { group: 'none', label: 'Nothing scheduled yet' },
];

/**
 * Groups an enriched follow feed into Live now → Coming up → Recent sections
 * (unified-app Phase 2 Slice 2) — live always floats to the top regardless of
 * how many teams are in each bucket. `loading` covers the signed-out first
 * fetch (no server seed to paint immediately); a settled-but-empty result
 * (e.g. every followed tournament dropped out) gets a quiet fallback line
 * instead of a blank gap under the page header.
 */
export default function FollowFeed({
  entries,
  loading,
}: {
  entries: FollowFeedEntry[];
  loading: boolean;
}) {
  if (entries.length === 0) {
    if (loading) return null;
    return (
      <p className={styles.subtitle}>
        Game info for your followed teams isn&rsquo;t available right now — try again shortly.
      </p>
    );
  }

  return (
    <>
      {GROUPS.map(({ group, label }) => {
        const rows = entries.filter(e => e.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group}>
            <p className={styles.sectionLabel}>{label}</p>
            <div className={styles.list}>
              {rows.map(entry => (
                <FollowFeedCard key={`${entry.orgSlug}/${entry.tournamentSlug}/${entry.teamId}`} entry={entry} />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
