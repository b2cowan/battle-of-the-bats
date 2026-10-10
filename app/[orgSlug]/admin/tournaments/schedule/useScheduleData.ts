'use client';
/**
 * The schedule page's reads: games, accepted teams, divisions, venues and temporary facility lanes, with the full
 * refresh and the quiet games-only re-read. Moved out of the schedule page as it was (Stage 3 Part 0, a pure move).
 */
import { useCallback, useEffect, useState } from 'react';
import type { Division, Game, ScheduleFacilityLane, Team, Venue } from '@/lib/types';

export function useScheduleData({ tournamentId, tournamentLoading, orgSlug }: {
  tournamentId: string | undefined;
  tournamentLoading: boolean;
  orgSlug: string | undefined;
}) {
  const [games, setGames]       = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [teams, setTeams]       = useState<Team[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [facilityLanes, setFacilityLanes] = useState<ScheduleFacilityLane[]>([]);

  // A quiet re-read of the games only — no loading state, so an open inline row or the generator's open draft survives
  // it. Used after a refusal that can mean the schedule changed underneath (Stage 3 defects pass, /review).
  const reloadGames = useCallback(async () => {
    if (!tournamentId) return;
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';
    const res = await fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`).catch(() => null);
    if (res?.ok) setGames(await res.json());
  }, [tournamentId, orgSlug]);

  const refresh = useCallback(async () => {
    if (tournamentLoading) return;
    if (!tournamentId) {
      setGames([]);
      setTeams([]);
      setDivisions([]);
      setVenues([]);
      setFacilityLanes([]);
      setGamesLoading(false);
      return;
    }
    const orgParam = orgSlug ? `&orgSlug=${encodeURIComponent(orgSlug)}` : '';

    setGamesLoading(true);
    try {
      const [gamesRes, teamsRes, groupsRes, venuesRes, lanesRes] = await Promise.all([
        fetch(`/api/admin/games?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/teams?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/divisions?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/venues?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
        fetch(`/api/admin/schedule-facility-lanes?tournamentId=${encodeURIComponent(tournamentId)}${orgParam}`),
      ]);

      const games = gamesRes.ok ? await gamesRes.json() : [];
      const allTeams = teamsRes.ok ? await teamsRes.json() : [];
      const groups = groupsRes.ok ? await groupsRes.json() : [];
      const venues = venuesRes.ok ? await venuesRes.json() : [];
      const lanes = lanesRes.ok ? await lanesRes.json() : [];

      setGames(games);
      setTeams(allTeams.filter((t: any) => t.status === 'accepted'));
      setDivisions(groups);
      setVenues(venues);
      setFacilityLanes(lanes);
    } finally {
      setGamesLoading(false);
    }
  }, [tournamentId, tournamentLoading, orgSlug]);
  
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return { games, setGames, gamesLoading, teams, divisions, setDivisions, venues, setVenues, facilityLanes, setFacilityLanes, refresh, reloadGames };
}
