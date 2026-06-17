'use client';
/**
 * lib/follow.ts
 * Single source of truth for the anonymous "follow a team" feature on public
 * tournament pages. State lives in localStorage (no account required) under
 * `fl_follow_team_${orgSlug}_${tournamentSlug}` → { id, name, divisionId }.
 *
 * Previously these helpers were duplicated across ScheduleContent, StandingsContent,
 * and TeamsContent. Keep the storage key + shape identical to those originals so
 * existing followers carry over.
 */
import { useCallback, useEffect, useState } from 'react';
import { tournamentToday } from './timezone';
import type { Team, Tournament } from './types';

export interface FollowedTeam {
  id: string;
  name: string;
  divisionId?: string;
}

export function followKey(orgSlug: string, tournamentSlug: string): string {
  return `fl_follow_team_${orgSlug}_${tournamentSlug}`;
}

export function readFollowedTeam(orgSlug: string, tournamentSlug: string): FollowedTeam | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(followKey(orgSlug, tournamentSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FollowedTeam>;
    return parsed.id ? { id: parsed.id, name: parsed.name ?? '', divisionId: parsed.divisionId } : null;
  } catch {
    return null;
  }
}

export function readFollowedTeamId(orgSlug: string, tournamentSlug: string): string | null {
  return readFollowedTeam(orgSlug, tournamentSlug)?.id ?? null;
}

export function saveFollowedTeam(
  orgSlug: string,
  tournamentSlug: string,
  team: Pick<Team, 'id' | 'name' | 'divisionId'>,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    followKey(orgSlug, tournamentSlug),
    JSON.stringify({ id: team.id, name: team.name, divisionId: team.divisionId }),
  );
  // Notify same-tab listeners (the native `storage` event only fires cross-tab).
  window.dispatchEvent(new CustomEvent('fl-follow-change'));
}

export function clearFollowedTeam(orgSlug: string, tournamentSlug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(followKey(orgSlug, tournamentSlug));
  window.dispatchEvent(new CustomEvent('fl-follow-change'));
}

/**
 * Hook wrapper around the followed-team state. Hydrates after first paint
 * (browser-only storage), and keeps in sync across tabs (`storage`) and across
 * components in the same tab (`fl-follow-change`).
 */
export function useFollowedTeam(orgSlug: string, tournamentSlug: string) {
  const [followedTeamId, setFollowedTeamId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setFollowedTeamId(readFollowedTeamId(orgSlug, tournamentSlug));
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === followKey(orgSlug, tournamentSlug)) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('fl-follow-change', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('fl-follow-change', sync);
    };
  }, [orgSlug, tournamentSlug]);

  const follow = useCallback(
    (team: Pick<Team, 'id' | 'name' | 'divisionId'>) => {
      saveFollowedTeam(orgSlug, tournamentSlug, team);
      setFollowedTeamId(team.id);
    },
    [orgSlug, tournamentSlug],
  );

  const unfollow = useCallback(() => {
    clearFollowedTeam(orgSlug, tournamentSlug);
    setFollowedTeamId(null);
  }, [orgSlug, tournamentSlug]);

  return { followedTeamId, follow, unfollow } as const;
}

/**
 * A tournament is "in progress" when today falls within its event window.
 * Used to gate live polling so we only refresh on game day. Mirrors the
 * `isInProgress` check in TournamentHomeContent.
 */
export function isTournamentInProgress(
  tournament: Pick<Tournament, 'startDate' | 'endDate' | 'status'> | null | undefined,
): boolean {
  if (!tournament) return false;
  if (tournament.status !== 'active') return false;
  const { startDate, endDate } = tournament;
  if (!startDate || !endDate) return false;
  // Tournament-local date, not UTC — otherwise this flips false after ~8 PM Eastern on
  // the final evening, killing the dock + live polling during championship play (J6-056).
  const today = tournamentToday();
  return today >= startDate && today <= endDate;
}
