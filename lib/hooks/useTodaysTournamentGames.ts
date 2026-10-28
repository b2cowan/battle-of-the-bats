'use client';
/**
 * lib/hooks/useTodaysTournamentGames.ts
 * Today's games of the public tournament the visitor is on, kept current by the live feed. Shared by today's scrolling
 * ticker (ScoreTicker) and the new frame's results line (TodaysResultsLine, Public tournament pages Stage 1): one
 * fetch rule, one "today", one publish gate (the public read already drops unpublished divisions). Self-gating: outside
 * the tournament's days, or once it is finished, it fetches nothing and returns no games.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useOrgNav } from '@/components/OrgNavContext';
import { useOrgHref } from '@/lib/use-public-pathname';
import { usePublicTournamentLive } from '@/lib/hooks/usePublicTournamentLive';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import { tournamentToday } from '@/lib/timezone';
import type { PublicTournamentPageData } from '@/lib/public-tournament-data';
import type { Game, PublicTeam } from '@/lib/types';

/** A team's name for a one-line strip: the parenthetical (a division or town note) dropped. */
export function teamShort(id: string | null | undefined, placeholder: string | null | undefined, teams: PublicTeam[]): string {
  const n = teams.find(t => t.id === id)?.name ?? placeholder ?? 'TBD';
  return n.replace(/\s*\([^)]*\)\s*/g, '').trim() || n;
}

// Unassigned-slot sentinel — same convention as ScheduleContent/game-detail.
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const unresolvedSlot = (id: string | null | undefined) => !id || id === NIL_UUID;

/** A playoff slot whose BOTH sides are still bracket refs ("Winner SF2") reads as jargon, and its time window can open
 *  before the feeders finish, so it must never dress as live: show the round and the time until the teams resolve. */
export function isPendingPlayoffSlot(g: Game): boolean {
  return (g.isPlayoff || !!g.bracketCode) && unresolvedSlot(g.awayTeamId) && unresolvedSlot(g.homeTeamId);
}

type TodayFeed = { teams: PublicTeam[]; games: Game[]; requireFinalization: boolean };
const EMPTY_FEED: TodayFeed = { teams: [], games: [], requireFinalization: true };

/** The slice of the schedule payload the strip reads, from the first fetch and from every live refresh alike. The
 *  organizer's "a score needs confirming" setting rides along, so a submitted score reads as the schedule reads it. */
function readFeed(d: PublicTournamentPageData): TodayFeed {
  return {
    teams: d.teams ?? [],
    games: d.games ?? [],
    requireFinalization: d.organization?.requireScoreFinalization ?? d.tournament?.requireScoreFinalization ?? true,
  };
}

export function useTodaysTournamentGames() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const orgHref = useOrgHref(orgSlug);
  const { tournamentStartDate, tournamentEndDate, tournamentStatus } = useOrgNav();

  const today = tournamentToday();
  const inWindow = !!tournamentStartDate && !!tournamentEndDate &&
    tournamentStatus !== 'completed' && tournamentStatus !== 'cancelled' &&
    today >= tournamentStartDate && today <= tournamentEndDate;
  const active = inWindow && !!orgSlug && !!tournamentSlug;

  const [{ teams, games, requireFinalization }, setFeed] = useState<TodayFeed>(EMPTY_FEED);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'schedule').then(d => {
      if (!cancelled && d) setFeed(readFeed(d));
    }).catch(() => { /* a network blip: the live poll below fills the feed on its next turn */ });
    return () => { cancelled = true; };
  }, [active, orgSlug, tournamentSlug]);

  usePublicTournamentLive({
    orgSlug,
    tournamentSlug,
    section: 'schedule',
    enabled: active,
    onData: d => setFeed(readFeed(d)),
  });

  const todayGames = useMemo(
    () => (active ? games.filter(g => g.date === today && g.status !== 'cancelled') : []),
    [active, games, today],
  );

  return {
    tournamentSlug,
    today,
    teams,
    todayGames,
    requireFinalization,
    gameHref: (id: string) => orgHref(`/${tournamentSlug}/schedule/${id}`),
  };
}
