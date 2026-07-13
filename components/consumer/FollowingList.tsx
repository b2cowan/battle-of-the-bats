'use client';
import Link from 'next/link';
import { useAllFollowedTeams } from '@/lib/follow';
import FollowCardList from './FollowCardList';
import styles from './ConsumerPage.module.css';

/**
 * The Following tab (unified-app Phase 1). Lists every team this device follows,
 * across all tournaments — the anonymous, per-device follow mechanism. Account-linked
 * follows that survive device changes arrive in Phase 2.
 */
export default function FollowingList() {
  const { teams, ready } = useAllFollowedTeams();

  // Still hydrating from localStorage — don't flash the empty state.
  if (!ready) return <div className={styles.page} />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Following</h1>
        <p className={styles.subtitle}>
          Teams you follow on this device. Follow a team from any tournament to see it here.
        </p>
      </div>

      {teams.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>You&rsquo;re not following any teams yet</p>
          <p className={styles.emptyText}>
            Find a tournament, open a team, and tap Follow — it&rsquo;ll show up here on this device.
          </p>
          <Link href="/discover" className={styles.cta}>Browse tournaments →</Link>
        </div>
      ) : (
        <FollowCardList teams={teams} />
      )}
    </div>
  );
}
