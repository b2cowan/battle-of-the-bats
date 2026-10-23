import 'server-only';
import { getOrgMemberDisplayNames, getRepTeams, getRepProgramYearsForTeams } from './db';
import { liveSeasonOf } from './season-live';
import { publicPersonName } from './tryout-contact-rules';
import { listActiveMembershipsForTeams } from './coach-membership';
import { coachNamesRoleOf, type ListingSeat } from './coach-names-policy';

/**
 * lib/coach-names-audience.ts — THE ORG-WIDE READ BEHIND THE CLUB'S COACH-NAMES CHOICE (mig 352): the window's counts and
 * the notice's audience. Read-only.
 *
 * "Who a choice could list" is every ACTIVE seat on a team that is not archived and has a LIVE season — the same teams whose
 * public page shows a Coaches shelf at all (a team between seasons shows no names). The comparison itself is the pure
 * `listingChange` in `lib/coach-names-policy.ts`; this only gathers the seats.
 */
export async function loadListingSeats(orgId: string): Promise<ListingSeat[]> {
  const teams = (await getRepTeams(orgId)).filter(t => !t.isArchived);
  if (teams.length === 0) return [];
  const seasons = await getRepProgramYearsForTeams(teams.map(t => t.id));
  const liveTeamIds = teams
    .map(t => t.id)
    .filter(id => liveSeasonOf(seasons.filter(s => s.teamId === id)));
  if (liveTeamIds.length === 0) return [];

  const rows = await listActiveMembershipsForTeams(orgId, liveTeamIds);
  if (rows.length === 0) return [];

  const names = await getOrgMemberDisplayNames(orgId, [...new Set(rows.map(m => m.userId))]);
  return rows.map(m => ({
    teamId: m.teamId,
    userId: m.userId,
    role: coachNamesRoleOf(m),
    ownSwitch: m.showNamePublic,
    hasName: !!publicPersonName(names[m.userId]),
  }));
}
