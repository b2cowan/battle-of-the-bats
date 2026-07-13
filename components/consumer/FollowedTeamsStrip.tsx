'use client';
import { useAllFollowedTeams } from '@/lib/follow';
import FollowCardList from './FollowCardList';
import styles from './ConsumerPage.module.css';

/** "Your teams" section shown atop the Scores tab — the device's followed teams. */
export default function FollowedTeamsStrip() {
  const { teams, ready } = useAllFollowedTeams();
  if (!ready || teams.length === 0) return null;
  return (
    <>
      <p className={styles.sectionLabel}>Your teams</p>
      <FollowCardList teams={teams} />
    </>
  );
}
