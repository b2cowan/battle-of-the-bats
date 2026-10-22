import 'server-only';
import { getDivisionsForSeason, getLeagueSeasons, getRepTeams } from './db';
import { clubTeamBands, runningLeagueSeason, teamRowDivision, type TeamBand } from './club-site-home';
import { getClubTeamGroups, readClubTryouts } from './club-tryouts';
import { bornFactsOf, hasBornYears, type BornFacts } from './club-born-public';
import { seasonPhrase } from './season-phrase';
import { bornYearsOf } from './born-years';
import { hasModuleEntitlement } from './module-entitlements';
import { tournamentToday } from './timezone';
import type { Organization } from './types';

/**
 * A CLUB'S LISTED TEAMS, ONE READ FOR BOTH PAGES THAT SHOW THEM (Club Tier Stage 4b-2a): the home's team grid and the
 * Teams page. Every team that is not archived, under the club's own groups (`clubTeamBands`), each with whether its
 * tryouts are open — the one tryout rule, read once with the Tryouts page and Open now (`readClubTryouts`), so they can never
 * disagree. An archived team is not listed; its page still opens for old links.
 *
 * Stage 4c-2: each team also carries its birth years — its LIVE season's pair (the season the tryouts read names), read
 * under the club's cut-off for the team's sport (`bornFactsOf`). A team with none, or whose live season has no pair,
 * carries empty facts and shows no line.
 */
export interface ClubListedTeam {
  name: string;
  slug: string;
  groupId: string | null;
  /** The division, only where the band and the name do not already say it (End state 2). */
  division: string | null;
  tryoutsOpen: boolean;
  born: BornFacts;
}

export async function readClubTeams(
  orgId: string,
  cutoffs: Organization['birthdayCutoffs'],
): Promise<{ bands: TeamBand<ClubListedTeam>[]; count: number }> {
  // A failed tryout read costs the "Tryouts open" chips and the birth years, never the list.
  const [teams, groups, tryouts] = await Promise.all([
    getRepTeams(orgId),
    getClubTeamGroups(orgId),
    readClubTryouts(orgId, tournamentToday()).then(r => r.teams, () => []),
  ]);
  const open = new Set(tryouts.filter(t => t.standing.state === 'open').map(t => t.slug));
  const bySlug = new Map(tryouts.map(t => [t.slug, t]));
  const listed = teams.filter(t => !t.isArchived).map((t): ClubListedTeam => {
    const live = bySlug.get(t.slug);
    return {
      name: t.name,
      slug: t.slug,
      groupId: t.groupId,
      division: teamRowDivision(t.division, t.groupName, t.name),
      tryoutsOpen: open.has(t.slug),
      born: bornFactsOf(live?.bornYears ?? { from: null, to: null }, cutoffs, t.sport),
    };
  });
  return { bands: clubTeamBands(listed, groups), count: listed.length };
}

/** A house-league division a Born in pick can add to the Teams page: "U13 house league" over its line and season. */
export interface ClubListedDivision {
  id: string;
  /** The division's name as the club typed it ("U13"); the row says "{name} house league". */
  name: string;
  born: BornFacts;
}

export interface ClubLeagueDivisions {
  /** Where a row goes: the registration while it is open, else the season's page. */
  href: string;
  /** "2027 season", from the season's name (`seasonPhrase`, Convention 3). */
  seasonWords: string;
  divisions: ClubListedDivision[];
}

/**
 * The divisions of the house-league season the home names (the one running — `runningLeagueSeason`; a draft season is
 * never public), each read under the cut-off for the season's sport. Only a division that carries years is returned:
 * the Teams page lists divisions only under a Born in pick, and a division with no years says nothing about an age, so
 * it would be the same noise under every pick. Null when the club runs no house league or none is running.
 */
export async function readClubLeagueDivisions(org: Organization, orgSlug: string): Promise<ClubLeagueDivisions | null> {
  if (!hasModuleEntitlement(org, 'module_house_league')) return null;
  const seasons = (await getLeagueSeasons(org.id)).filter(s => s.status !== 'draft');
  const season = runningLeagueSeason(seasons);
  if (!season) return null;
  const divisions = (await getDivisionsForSeason(season.id))
    .map((d): ClubListedDivision => ({ id: d.id, name: d.name, born: bornFactsOf(bornYearsOf({ born_from_year: d.bornFromYear, born_to_year: d.bornToYear }), org.birthdayCutoffs, season.sport) }))
    .filter(d => hasBornYears(d.born));
  if (divisions.length === 0) return null;
  const base = `/${orgSlug}/league/${season.slug}`;
  return {
    href: season.status === 'registration_open' ? `${base}/register` : base,
    seasonWords: seasonPhrase(season.name),
    divisions,
  };
}
