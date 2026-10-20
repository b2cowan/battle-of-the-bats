import { getClubTeam } from '@/lib/club-page-meta';
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
