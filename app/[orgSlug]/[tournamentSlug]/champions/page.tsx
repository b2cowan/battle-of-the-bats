import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import {
  getOrganizationBySlug,
  getPublicTournamentBySlug,
  getGames,
  getTeams,
  getDivisions,
} from '@/lib/db';
import { toPublicTeam } from '@/lib/public-tournament-data';
import { onlyPublishedGames } from '@/lib/public-games';
import { deriveTierChampions, isTournamentPlayoffsComplete } from '@/lib/champions';
import { championCards } from '@/lib/public-host-card';
import { isPublicPageEnabled, isPublicBracketVisible } from '@/lib/public-pages';
import PublicChampionsPage from '@/components/public/PublicChampionsPage';
import { orgLinks } from '@/lib/org-links';

export const dynamic = 'force-dynamic';

export default async function ChampionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/${tournamentSlug}/champions`);
  const org = await getOrganizationBySlug(orgSlug);
  if (!org || org.subscriptionStatus === 'canceled') notFound();
  const tournament = await getPublicTournamentBySlug(org.id, tournamentSlug);
  if (!tournament) notFound();

  const orgHref = await orgLinks(orgSlug);
  const publicBase = orgHref(`/${tournamentSlug}`);

  // The Champions recap shows final results, so it inherits the Standings page's visibility — an organizer who hid
  // Standings must not have the final results leaked through this URL (same rule as the Playoff Picture).
  if (!isPublicPageEnabled(tournament, 'standings')) {
    return <PublicChampionsPage standingsHidden cards={[]} homeHref={publicBase} />;
  }

  const readOptions = { admin: true } as const;
  const [rawGames, allTeams, divisions] = await Promise.all([
    getGames(tournament.id, readOptions),
    getTeams(tournament.id, readOptions),
    getDivisions(tournament.id, readOptions),
  ]);
  // Only published divisions' games — no champion is crowned from an unpublished schedule (D1).
  const allGames = onlyPublishedGames(rawGames, divisions);
  const teams = allTeams
    .filter(t => t.status === 'accepted')
    .map(t => toPublicTeam(t, tournament.coachNamesShowOnPublic === true));
  const sortedDivisions = [...divisions].sort((a, b) => a.order - b.order);

  const tierChampions = deriveTierChampions(allGames, teams, sortedDivisions);

  // Only crown once the WHOLE tournament's playoffs are complete — same gate as the home hero and the one-time
  // announcement. This stops the recap from surfacing a winner from a final that's been score-entered but not yet
  // finalized ('submitted'). And never while a division's schedule is still held back (D1): the reveal is
  // all-or-nothing, so one held-back division withholds every champion.
  const playoffsComplete = allGames.length === rawGames.length && isTournamentPlayoffsComplete(allGames, sortedDivisions);
  const resultsWithheld = divisions.some(division => division.scheduleVisibility !== 'published');
  const showPlayoffs = isPublicBracketVisible(tournament);
  if (!playoffsComplete || tierChampions.length === 0 || resultsWithheld) {
    return <PublicChampionsPage standingsHidden={false} cards={[]} homeHref={publicBase} showPlayoffs={showPlayoffs} />;
  }

  return <PublicChampionsPage standingsHidden={false} cards={championCards(tierChampions, sortedDivisions.length > 1)}
    homeHref={publicBase} showPlayoffs={showPlayoffs} />;
}
