'use client';
import { useEffect, useState } from 'react';
import type { FollowFeedEntry, FollowFeedGroup } from '@/lib/follow-feed';
import FollowFeedCard from './FollowFeedCard';
import styles from './ConsumerPage.module.css';

const GROUPS: { group: FollowFeedGroup; label: string }[] = [
  { group: 'live', label: 'Live now' },
  { group: 'upcoming', label: 'Coming up' },
  { group: 'recent', label: 'Recent' },
  { group: 'none', label: 'Nothing scheduled yet' },
];

/** S2: quiet freshness hint while live-polling — recomputed on a slow tick. The
 *  label lives in state (not render-time Date.now(), which the compiler purity
 *  rule rejects); empty until the first effect pass, so SSR/first paint is blank. */
function UpdatedAgo({ at }: { at: number }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => {
      const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
      setLabel(secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m`);
    };
    update();
    const id = window.setInterval(update, 5_000);
    return () => window.clearInterval(id);
  }, [at]);
  if (!label) return null;
  return <span className={styles.updatedAgo}>updated {label} ago</span>;
}

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
  updatedAt,
}: {
  entries: FollowFeedEntry[];
  loading: boolean;
  /** S2: last successful poll timestamp — shown beside "Live now" only. */
  updatedAt?: number | null;
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
            <p className={styles.sectionLabel}>
              {label}
              {group === 'live' && updatedAt ? <UpdatedAgo at={updatedAt} /> : null}
            </p>
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
