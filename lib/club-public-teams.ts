import 'server-only';
import { getOpenTryoutsByOrg, getRepTeamGroups, getRepTeams, type OpenTryout } from './db';
import { clubTeamBands, teamRowDivision, type TeamBand } from './club-site-home';

/**
 * A CLUB'S LISTED TEAMS, ONE READ FOR BOTH PAGES THAT SHOW THEM (Club Tier Stage 4b-2a): the home's team grid and the
 * Teams page. Every team that is not archived, under the club's own groups (`clubTeamBands`), each with whether its
 * tryouts are open — the one public tryout rule (`getOpenTryoutsByOrg`), so the grid, the list and Open now can never
 * disagree. An archived team is not listed; its page still opens for old links.
 */
export interface ClubListedTeam {
  name: string;
  slug: string;
  groupId: string | null;
  /** The division, only where the band and the name do not already say it (End state 2). */
  division: string | null;
  tryoutsOpen: boolean;
}

export async function readClubTeams(orgId: string): Promise<{ bands: TeamBand<ClubListedTeam>[]; count: number; openTryouts: OpenTryout[] }> {
  const [teams, groups, openTryouts] = await Promise.all([getRepTeams(orgId), getRepTeamGroups(orgId), getOpenTryoutsByOrg(orgId)]);
  const open = new Set(openTryouts.map(t => t.teamId));
  const listed = teams.filter(t => !t.isArchived).map((t): ClubListedTeam => ({
    name: t.name,
    slug: t.slug,
    groupId: t.groupId,
    division: teamRowDivision(t.division, t.groupName, t.name),
    tryoutsOpen: open.has(t.id),
  }));
  return { bands: clubTeamBands(listed, groups), count: listed.length, openTryouts };
}
