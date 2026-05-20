import type {
  PublicTournamentPageData,
  PublicTournamentSection,
} from './public-tournament-data';

export async function fetchPublicTournamentData(
  orgSlug: string,
  tournamentSlug: string | null,
  section: PublicTournamentSection,
): Promise<PublicTournamentPageData | null> {
  const params = new URLSearchParams({ orgSlug, section });
  if (tournamentSlug) params.set('tournamentSlug', tournamentSlug);

  const res = await fetch(`/api/public/tournament-data?${params.toString()}`);
  if (!res.ok) return null;
  return res.json();
}
