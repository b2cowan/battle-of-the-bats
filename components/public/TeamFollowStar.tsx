'use client';
/**
 * components/public/TeamFollowStar.tsx
 * Compact follow/unfollow star for a specific team, droppable into server-rendered
 * surfaces (game detail) where a localStorage follow toggle is needed inline (J6-011).
 * Follows via the canonical helper so the dock/scorebug/strip light up immediately.
 */
import { Star } from 'lucide-react';
import type { PublicTeam } from '@/lib/types';
import { useFollowedTeam, useAccountFollowedTeamIds, unfollowTeamEverywhere } from '@/lib/follow';
import styles from './TeamFollowStar.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  team: Pick<PublicTeam, 'id' | 'name' | 'divisionId'>;
  size?: number;
}

export default function TeamFollowStar({ orgSlug, tournamentSlug, team, size = 15 }: Props) {
  const { followedTeamId, follow } = useFollowedTeam(orgSlug, tournamentSlug);
  // N2: a signed-in fan's ACCOUNT follows count too — her own team never shows "Follow".
  const accountIds = useAccountFollowedTeamIds(orgSlug, tournamentSlug);
  const isFollowed = followedTeamId === team.id || accountIds.has(team.id);

  function toggle() {
    if (isFollowed) unfollowTeamEverywhere(orgSlug, tournamentSlug, team.id);
    else follow(team);
  }

  return (
    <button
      type="button"
      className={`${styles.star} ${isFollowed ? styles.active : ''}`}
      onClick={toggle}
      aria-pressed={isFollowed}
      aria-label={isFollowed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
      title={isFollowed ? 'Following — tap to unfollow' : `Follow ${team.name}`}
    >
      <Star size={size} fill={isFollowed ? 'currentColor' : 'none'} />
    </button>
  );
}
