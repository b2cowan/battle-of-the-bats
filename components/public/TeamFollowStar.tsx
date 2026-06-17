'use client';
/**
 * components/public/TeamFollowStar.tsx
 * Compact follow/unfollow star for a specific team, droppable into server-rendered
 * surfaces (game detail) where a localStorage follow toggle is needed inline (J6-011).
 * Follows via the canonical helper so the dock/scorebug/strip light up immediately.
 */
import { Star } from 'lucide-react';
import type { PublicTeam } from '@/lib/types';
import { useFollowedTeam } from '@/lib/follow';
import styles from './TeamFollowStar.module.css';

interface Props {
  orgSlug: string;
  tournamentSlug: string;
  team: Pick<PublicTeam, 'id' | 'name' | 'divisionId'>;
  size?: number;
}

export default function TeamFollowStar({ orgSlug, tournamentSlug, team, size = 15 }: Props) {
  const { followedTeamId, follow, unfollow } = useFollowedTeam(orgSlug, tournamentSlug);
  const isFollowed = followedTeamId === team.id;
  return (
    <button
      type="button"
      className={`${styles.star} ${isFollowed ? styles.active : ''}`}
      onClick={() => (isFollowed ? unfollow() : follow(team))}
      aria-pressed={isFollowed}
      aria-label={isFollowed ? `Unfollow ${team.name}` : `Follow ${team.name}`}
      title={isFollowed ? 'Following — tap to unfollow' : `Follow ${team.name}`}
    >
      <Star size={size} fill={isFollowed ? 'currentColor' : 'none'} />
    </button>
  );
}
