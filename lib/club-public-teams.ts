import 'server-only';
import { getRepTeams } from './db';
import { clubTeamBands, teamRowDivision, type TeamBand } from './club-site-home';
import { getClubTeamGroups, readClubTryouts } from './club-tryouts';
import { tournamentToday } from './timezone';

/**
 * A CLUB'S LISTED TEAMS, ONE READ FOR BOTH PAGES THAT SHOW THEM (Club Tier Stage 4b-2a): the home's team grid and the
 * Teams page. Every team that is not archived, under the club's own groups (`clubTeamBands`), each with whether its
 * tryouts are open — the one tryout rule, read once with the Tryouts page and Open now (`readClubTryouts`), so they can never
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

export async function readClubTeams(orgId: string): Promise<{ bands: TeamBand<ClubListedTeam>[]; count: number }> {
  // A failed tryout read costs the "Tryouts open" chips, never the list.
  const [teams, groups, tryouts] = await Promise.all([
    getRepTeams(orgId),
    getClubTeamGroups(orgId),
    readClubTryouts(orgId, tournamentToday()).then(r => r.teams, () => []),
  ]);
  const open = new Set(tryouts.filter(t => t.standing.state === 'open').map(t => t.slug));
  const listed = teams.filter(t => !t.isArchived).map((t): ClubListedTeam => ({
    name: t.name,
    slug: t.slug,
    groupId: t.groupId,
    division: teamRowDivision(t.division, t.groupName, t.name),
    tryoutsOpen: open.has(t.slug),
  }));
  return { bands: clubTeamBands(listed, groups), count: listed.length };
}
