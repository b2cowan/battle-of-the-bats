import { resolvePublicClub } from '@/lib/public-club-page';
import { getClubTeam, getClubTeamSeasons } from '@/lib/club-page-meta';
import { readTeamTryout } from '@/lib/club-tryouts';
import { tryoutCardFor } from '@/lib/club-share';
import { tournamentToday } from '@/lib/timezone';
import { clubShareCard, neutralShareCard, SHARE_CARD_SIZE, SHARE_CARD_TYPE } from '@/lib/club-share-card-image';

/**
 * A tryout's preview card (Club Tier Stage 4b-2b, End state 8): its state as the badge ("Tryouts open"), "15U AAA
 * tryouts", then "For the 2027 season · from Mon, Nov 2" — drawn from the state NOW. A preview already sent cannot update,
 * so the page names this card with its state in the address (`?s=open`): when the state changes, a fresh share fetches a
 * fresh card. The one rule first (the tryout pages ask for the rep-teams page): a refused club is the neutral card.
 */
export const alt = 'The team’s tryouts';
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_TYPE;
// Drawn from the club's data now, never at build time (the org layout's force-dynamic does not reach a route file).
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }) {
  const { orgSlug, teamSlug } = await params;
  const org = await resolvePublicClub(orgSlug, 'teams').catch(() => null);
  const team = org ? await getClubTeam(org.id, teamSlug).catch(() => null) : null;
  if (!org || !team) return neutralShareCard();
  const { season, standing } = await readTeamTryout(team, await getClubTeamSeasons(team.id), tournamentToday());
  return clubShareCard(org, tryoutCardFor({ clubName: org.name, teamName: team.name, season, standing }));
}
