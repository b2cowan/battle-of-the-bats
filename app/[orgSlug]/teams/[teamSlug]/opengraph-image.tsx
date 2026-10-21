import { resolvePublicClub } from '@/lib/public-club-page';
import { getClubTeam, getClubTeamSeasons } from '@/lib/club-page-meta';
import { liveSeasonOf } from '@/lib/season-live';
import { teamCard } from '@/lib/club-share';
import { clubShareCard, neutralShareCard, SHARE_CARD_SIZE, SHARE_CARD_TYPE } from '@/lib/club-share-card-image';

/**
 * A team's preview card (Club Tier Stage 4b-2b, End state 8): "15U AAA" over "Lakeshore Lynx · 2026 season", in the
 * club's colours. Never a player. The one rule first: a closed site, or a team the club does not have, is the neutral card.
 */
export const alt = 'The team';
export const size = SHARE_CARD_SIZE;
export const contentType = SHARE_CARD_TYPE;
// Drawn from the club's data now, never at build time (the org layout's force-dynamic does not reach a route file).
export const dynamic = 'force-dynamic';

export default async function Image({ params }: { params: Promise<{ orgSlug: string; teamSlug: string }> }) {
  const { orgSlug, teamSlug } = await params;
  const org = await resolvePublicClub(orgSlug, 'teams').catch(() => null);
  const team = org ? await getClubTeam(org.id, teamSlug).catch(() => null) : null;
  if (!org || !team) return neutralShareCard();
  const season = team.isArchived ? null : liveSeasonOf(await getClubTeamSeasons(team.id));
  return clubShareCard(org, teamCard({ clubName: org.name, teamName: team.name, seasonYear: season?.year ?? null }));
}
