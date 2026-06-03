'use client';
/**
 * lib/team-calendar.ts
 * Public/fan calendar export — build an .ics of a single followed team's games
 * and trigger a download. Wraps the existing free `downloadICS()` exporter so
 * parents can add "my team's games" to their phone in one tap.
 */
import { downloadICS, type ICSEventInput } from './export/ics';
import { formatTime } from './utils';
import type { Game, Team, Division } from './types';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function resolveName(teams: Team[], id: string | undefined, placeholder: string | undefined | null): string {
  if (id && id !== NIL_UUID) {
    const found = teams.find(t => t.id === id);
    if (found) return found.name;
  }
  return placeholder ?? 'TBD';
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'team';
}

export interface TeamCalendarInput {
  team: Pick<Team, 'id' | 'name'>;
  games: Game[];
  teams: Team[];
  divisions: Division[];
  tournamentName: string;
  orgSlug: string;
  tournamentSlug: string;
}

/**
 * Build the followed team's schedule as ICS events and download it.
 * Includes every non-cancelled game the team appears in; cancelled games are
 * exported with STATUS:CANCELLED so re-imports clean up.
 */
export async function downloadTeamScheduleICS({
  team,
  games,
  teams,
  divisions,
  tournamentName,
  orgSlug,
  tournamentSlug,
}: TeamCalendarInput): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fieldlogichq.ca';

  const teamGames = games
    .filter(g => g.homeTeamId === team.id || g.awayTeamId === team.id)
    .filter(g => !!g.date)
    .sort((a, b) => (a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')));

  const events: ICSEventInput[] = teamGames.map(game => {
    const isHome = game.homeTeamId === team.id;
    const opponent = isHome
      ? resolveName(teams, game.awayTeamId, game.awayPlaceholder)
      : resolveName(teams, game.homeTeamId, game.homePlaceholder);
    const divisionName = divisions.find(d => d.id === game.divisionId)?.name ?? '';
    const stage = game.isPlayoff ? (game.bracketCode || 'Playoff') : divisionName;
    const titleSuffix = stage ? ` — ${stage}` : '';

    return {
      gameId: game.id,
      title: `${team.name} vs ${opponent}${titleSuffix}`,
      date: game.date,
      time: game.time || undefined,
      location: game.location || undefined,
      description: `${tournamentName}${divisionName ? ` · ${divisionName}` : ''}${game.time ? ` · ${formatTime(game.time)}` : ''}`,
      url: `${origin}/${orgSlug}/${tournamentSlug}/schedule/${game.id}`,
      cancelled: game.status === 'cancelled',
    };
  });

  if (events.length === 0) return;

  await downloadICS(`${slugify(team.name)}-schedule.ics`, events);
}
