import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getBasicCoachTeamsForUser, resolveBasicCoachTeamIdForWorkspace } from './basic-coach-teams';
import { getTeamStaffMembershipById, listActiveStaffForTeams, listActiveStaffTeamIdsForUser } from './coach-membership';
import { isLivePortalStatus } from './coach-team-page';
import { resolveCoachUserIdentities } from './db';
import { buildRegistrableTeams, findRegistrableTeam, type LivePortal, type RegistrableTeam } from './registrable-teams';

/**
 * Loads `buildRegistrableTeams`' inputs for one signed-in person (the rule and its reasons are in
 * `lib/registrable-teams.ts`). Batched — a handful of reads however many teams the person is on:
 *
 *   1. their free-team memberships, and their ACTIVE staff memberships (the access truth, mig 245);
 *   2. every workspace either one reaches — by rep team (staff) or by back-link (free team);
 *   3. for the LIVE ones (`isLivePortalStatus` — the free shell's own test): the team's current name,
 *      its org's slug, its active staff, and its twin;
 *   4. names, only where a card shows one — who can register a LOCKED card, and an OPEN card's head
 *      coaches (Stage 1b) — since each name is an auth lookup.
 *
 * `forCheck` is the SERVER's question ("may this person file under this team?"), asked before an
 * entry is created, before one is linked, and on the free record's way to the portal's. It answers
 * from what is recorded: no names (nobody reads them; the head coach the route records is read by
 * `getEntryHeadCoachIdentity`), and a missing twin is NOT repaired — a team
 * the form offered has one already, because the form's own load (`forCheck` off) resolved it with
 * `resolveBasicCoachTeamIdForWorkspace` (which may adopt or create one, the same repair the Premium
 * Tournaments page runs on read). So a validation path never writes.
 */
export async function getRegistrableTeamsForUser(
  userId: string,
  opts: { forCheck?: boolean } = {},
): Promise<RegistrableTeam[]> {
  const [freeTeams, staffTeamIds] = await Promise.all([
    getBasicCoachTeamsForUser(userId),
    listActiveStaffTeamIdsForUser(userId),
  ]);
  const backLinkedIds = [...new Set(freeTeams.map(t => t.teamWorkspaceId).filter((id): id is string => !!id))];
  if (staffTeamIds.length === 0 && backLinkedIds.length === 0) {
    return buildRegistrableTeams({ userId, freeTeams, portals: [] });
  }

  const reach = [
    staffTeamIds.length > 0 ? `rep_team_id.in.(${staffTeamIds.join(',')})` : null,
    backLinkedIds.length > 0 ? `id.in.(${backLinkedIds.join(',')})` : null,
  ].filter(Boolean).join(',');
  const { data: workspaceRows, error: workspaceError } = await supabaseAdmin
    .from('team_workspaces')
    .select('id, rep_team_id, subscription_status, workspace_state, primary_owner_user_id, source_tournament_team_id, basic_coach_team_id')
    .or(reach);
  if (workspaceError) throw workspaceError;

  const live = (workspaceRows ?? []).filter(w => isLivePortalStatus(w.subscription_status as string | null));
  if (live.length === 0) return buildRegistrableTeams({ userId, freeTeams, portals: [] });

  const staffTeamSet = new Set(staffTeamIds);
  // A team moved into its club keeps a live workspace marked org_owned (mig 313) — out of scope.
  const isStandalone = (w: { workspace_state: string | null }) =>
    w.workspace_state !== 'org_owned' && w.workspace_state !== 'archived';
  const onStaffOf = live.filter(w => isStandalone(w) && staffTeamSet.has(w.rep_team_id as string));

  const [{ data: repTeams, error: repError }, staff, twinIds] = await Promise.all([
    supabaseAdmin.from('rep_teams').select('id, name, org_id').in('id', [...new Set(live.map(w => w.rep_team_id as string))]),
    listActiveStaffForTeams(onStaffOf.map(w => w.rep_team_id as string)),
    opts.forCheck
      ? Promise.resolve(onStaffOf.map(w => (w.basic_coach_team_id as string | null) ?? null))
      : Promise.all(onStaffOf.map(w => resolveBasicCoachTeamIdForWorkspace({
          id: w.id as string,
          repTeamId: w.rep_team_id as string,
          primaryOwnerUserId: (w.primary_owner_user_id as string | null) ?? null,
          sourceTournamentTeamId: (w.source_tournament_team_id as string | null) ?? null,
          basicCoachTeamId: (w.basic_coach_team_id as string | null) ?? null,
        }))),
  ]);
  if (repError) throw repError;
  const repTeamById = new Map((repTeams ?? []).map(r => [r.id as string, r as { id: string; name: string; org_id: string }]));
  const twinByWorkspace = new Map(onStaffOf.map((w, i) => [w.id as string, twinIds[i]]));

  const orgIds = [...new Set((repTeams ?? []).map(r => r.org_id as string))];
  const { data: orgs, error: orgError } = orgIds.length > 0
    ? await supabaseAdmin.from('organizations').select('id, slug').in('id', orgIds)
    : { data: [], error: null };
  if (orgError) throw orgError;
  const slugByOrg = new Map((orgs ?? []).map(o => [o.id as string, o.slug as string]));
  const staffByTeam = new Map<string, typeof staff>();
  for (const member of staff) staffByTeam.set(member.teamId, [...(staffByTeam.get(member.teamId) ?? []), member]);

  const portalsWith = (names: ReadonlyMap<string, string | null>): LivePortal[] => live.map(w => {
    const repTeam = repTeamById.get(w.rep_team_id as string);
    return {
      workspaceId: w.id as string,
      repTeamId: w.rep_team_id as string,
      orgSlug: repTeam ? slugByOrg.get(repTeam.org_id) ?? null : null,
      name: repTeam?.name ?? null,
      twinId: twinByWorkspace.get(w.id as string) ?? (w.basic_coach_team_id as string | null) ?? null,
      standalone: isStandalone(w),
      staff: (staffByTeam.get(w.rep_team_id as string) ?? []).map(m => ({
        membershipId: m.id,
        userId: m.userId,
        name: names.get(m.userId) ?? null,
        coachRole: m.coachRole,
        capabilities: m.capabilities,
        staffKind: m.staffKind,
      })),
    };
  });

  const teams = buildRegistrableTeams({ userId, freeTeams, portals: portalsWith(new Map()) });
  if (opts.forCheck) return teams;
  // Who is locked out, and which card names a head coach, is the RULE's answer (never re-derived here).
  // Names are fetched for those people only: everyone who can register a locked card, and the head
  // coaches of an open one (Stage 1b — Review and the Step 2 dropdown name them).
  const named = new Map<string, Set<string>>(); // rep team → users to name
  for (const t of teams) {
    if (!t.portal) continue;
    const members = staffByTeam.get(t.portal.repTeamId) ?? [];
    const people = t.locked ? members : members.filter(m => t.headCoaches.some(h => h.id === m.id));
    if (people.length > 0) named.set(t.portal.repTeamId, new Set(people.map(m => m.userId)));
  }
  if (named.size === 0) return teams;
  const names = new Map<string, string | null>();
  await Promise.all([...named].map(async ([teamId, userIds]) => {
    const orgId = repTeamById.get(teamId)?.org_id;
    if (!orgId) return;
    const identities = await resolveCoachUserIdentities(orgId, [...userIds]);
    // The NAME only, never the email: a card can reach a helper on the team, who has no business
    // learning the head coach's address from it (/review 2026-10-14). No name → the card says the role.
    for (const id of userIds) names.set(id, identities.get(id)?.displayName ?? null);
  }));
  return buildRegistrableTeams({ userId, freeTeams, portals: portalsWith(names) });
}

/**
 * The head coach `/api/register` records (Stage 1b, C1): their name and email, read from the staff list
 * at Submit — never from the browser. `membershipId` comes from the server's own card (the D1 check's
 * read, picked by `pickEntryHeadCoach`); it is read again here so a head coach who stepped down a moment
 * ago is not recorded. Null when that membership is no longer an active head coach. `email` is null
 * only when the account could not be read (the identity read is best-effort), which the route refuses
 * rather than send the organizer's emails to the wrong person.
 */
export async function getEntryHeadCoachIdentity(
  membershipId: string,
): Promise<{ name: string | null; email: string | null } | null> {
  const membership = await getTeamStaffMembershipById(membershipId);
  if (membership?.status !== 'active' || membership.coachRole !== 'head_coach') return null;
  const identity = (await resolveCoachUserIdentities(membership.orgId, [membership.userId])).get(membership.userId);
  return { name: identity?.displayName ?? null, email: identity?.email?.toLowerCase() ?? null };
}

/**
 * The server half of D1: the team this person may attach an entry to, or null. Asked before an entry
 * is created (`/api/register`) and before an existing one is linked (the join page), so the server
 * refuses exactly what the form greys out. Never adds anyone to the twin — a staff member's entry is
 * reached through the portal (the Premium Tournaments page and record read the twin's links, and
 * admit staff by their coaching assignment: Part D, `lib/coach-registration-access.ts`).
 */
export async function findRegistrableTeamForUser(
  userId: string,
  basicCoachTeamId: string | null | undefined,
): Promise<RegistrableTeam | null> {
  if (!basicCoachTeamId) return null;
  return findRegistrableTeam(await getRegistrableTeamsForUser(userId, { forCheck: true }), basicCoachTeamId);
}
