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

import { hideOnClubOwnHost } from '@/components/public/hideOnClubOwnHost';
interface Props {
  orgSlug: string;
  tournamentSlug: string;
  team: Pick<PublicTeam, 'id' | 'name' | 'divisionId'>;
  size?: number;
  /** Extra class from the host surface (e.g. the game-detail compact inline variant). */
  className?: string;
}

function TeamFollowStar({ orgSlug, tournamentSlug, team, size = 15, className }: Props) {
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
      className={`${styles.star} ${isFollowed ? styles.active : ''} ${className ?? ''}`}
      onClick={toggle}
      aria-pressed={isFollowed}
      aria-label={isFollowed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
      title={isFollowed ? 'Following — tap to unfollow' : `Follow ${team.name}`}
    >
      <Star size={size} fill={isFollowed ? 'currentColor' : 'none'} />
    </button>
  );
}

// A club's own web address has no signed-in visitors (host-only cookies): this piece is absent there (Club Tier Stage 4e).
export default hideOnClubOwnHost(TeamFollowStar);
