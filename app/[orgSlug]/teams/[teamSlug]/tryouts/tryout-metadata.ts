import { getClubTeam, getClubTeamSeasons, type ClubPageMeta } from '@/lib/club-page-meta';
import { publicClubRefusal } from '@/lib/public-club-access';
import { readTeamTryout } from '@/lib/club-tryouts';
import { shareCardPath, tryoutCardFor } from '@/lib/club-share';
import { tryoutPageDescription } from '@/lib/tryout-season';
import { orgDayKey, tournamentToday } from '@/lib/timezone';
import type { Organization } from '@/lib/types';

/** The page part of the four tryout pages' tab titles (Club Tier Stage 4b-1): the team's tryouts, or its application
 *  when `register`. Each page hands it to `clubPageMetadata` itself (the club-frame guard looks for that call on every
 *  club page). The two season-numbered addresses carry an extra `yearId` param that the title does not need. A team
 *  that cannot be found returns null, which leaves the club's name alone. */
export function teamTryoutPageName(teamSlug: string, register: boolean) {
  return async (club: Organization): Promise<string | null> => {
    const team = await getClubTeam(club.id, teamSlug);
    return team ? (register ? `Register for ${team.name} tryouts` : `${team.name} tryouts`) : null;
  };
}

/**
 * The team-named tryout page's title, description and preview card (Club Tier Stage 4b-2b, End state 8), from the one
 * rule's state NOW. The card's address carries that state (`?s=open`): a chat app keeps a card it fetched, so a link
 * shared after sign-ups close must name a different address to get the new card.
 */
export function teamTryoutPageMeta(orgSlug: string, teamSlug: string) {
  return async (club: Organization): Promise<ClubPageMeta | null> => {
    // A club whose plan does not carry the team pages describes nothing behind them (the page itself is "not found").
    if (publicClubRefusal(club, 'teams')) return null;
    const team = await getClubTeam(club.id, teamSlug);
    if (!team) return null;
    const today = tournamentToday();
    const { season, standing } = await readTeamTryout(team, await getClubTeamSeasons(team.id), today);
    const firstUpcoming = standing.upcoming[0] ? orgDayKey(standing.upcoming[0].startsAt) : null;
    const seasonName = { year: season?.year ?? null, name: season?.name ?? '' };
    return {
      name: `${team.name} tryouts`,
      description: tryoutPageDescription(standing.state, team.name, seasonName, firstUpcoming, standing.lastDay, today),
      card: {
        path: shareCardPath.tryout(orgSlug, team.slug, standing.state, [season?.year ?? '', firstUpcoming ?? standing.lastDay ?? ''].join('.')),
        alt: tryoutCardFor({ clubName: club.name, teamName: team.name, season, standing }).alt,
      },
    };
  };
}
