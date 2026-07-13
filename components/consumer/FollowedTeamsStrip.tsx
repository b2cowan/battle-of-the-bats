'use client';
import { useAllFollowedTeams } from '@/lib/follow';
import FollowCardList from './FollowCardList';
import styles from './ConsumerPage.module.css';

/**
 * "Your teams live now" — shown atop the Scores tab. The device's followed teams,
 * narrowed to those whose tournament is currently live (the live-now tournament keys
 * are resolved server-side on the Scores page and passed in). On non-game-days this
 * renders nothing, so Scores stays a genuine live lens instead of duplicating the
 * Following tab (which owns the full, unfiltered follow list).
 */
export default function FollowedTeamsStrip({ liveKeys }: { liveKeys: string[] }) {
  const { teams, ready } = useAllFollowedTeams();
  if (!ready) return null;

  const liveSet = new Set(liveKeys);
  const liveTeams = teams.filter(t => liveSet.has(`${t.orgSlug}/${t.tournamentSlug}`));
  if (liveTeams.length === 0) return null;

  return (
    <>
      <p className={styles.sectionLabel}>Your teams live now</p>
      <FollowCardList teams={liveTeams} />
    </>
  );
}
