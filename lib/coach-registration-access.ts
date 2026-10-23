import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getCoachingAssignmentsForUser } from './db';
import { canOpenTournaments, type CoachCapabilities } from './coach-capabilities';
import { findLinkedBasicTeamForRegistration } from './basic-coach-teams';
import { canEditEventHeadCoach, type EventHeadCoachAccess } from './coach-event-head-coach';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE RECORD FOLLOWS THE LIST — who may open a tournament registration from the PAID portal.
 * (COACH_HOST_OWN_TEAM_ENTRY_PLAN.md Part D, W1 + W2 — owner ruled D5 in, 2026-09-13.)
 *
 * The coach Tournaments page lists every registration its rep team reaches by EITHER bridge —
 * the free-team shadow (`team_workspaces.basic_coach_team_id` → `basic_coach_team_registrations`)
 * and the club's admin link (`rep_team_tournament_registrations`) — and shows it to every staff
 * member whose coaching assignment passes the door (`canOpenTournaments`). The record page and the
 * two APIs behind it authorized on a DIFFERENT fact: active MEMBERSHIP of the free team, which is
 * written only for the one coach who registered or claimed. So a club-linked entry 404'd for
 * everyone (W1), and on a Premium team every assistant and the manager 404'd on an entry they
 * could see in the list (W2). Same root cause: the record read the wrong right.
 *
 * This is the right the list reads, made callable: "this registration belongs to a rep team the
 * user holds a configuring assignment on". Free-team membership stays the first answer (the free
 * portal, and a Premium coach who is also the shadow's owner); this is the second.
 *
 * ⚠ Deferred on purpose (plan §3.D): roster submission still reads the FREE team's master roster.
 * For a Premium team that is the shadow's roster, which may be empty — a data question (whose
 * roster does a Premium team submit?), not an access one, and it gets its own line.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type RegistrationRepTeamAccess = {
  repTeamId: string;
  orgId: string;
  /** The rep team's free-team shadow, when it has one (null for a club-linked team with no workspace). */
  basicCoachTeamId: string | null;
};

type RepTeamLink = { repTeamId: string; basicCoachTeamId: string | null };

/** Every rep team this registration belongs to, by either bridge (normally zero or one). */
async function findRepTeamsForRegistration(registrationId: string): Promise<RepTeamLink[]> {
  const [{ data: repLinks, error: repError }, { data: basicLink, error: basicError }] = await Promise.all([
    supabaseAdmin
      .from('rep_team_tournament_registrations')
      .select('rep_team_id')
      .eq('tournament_team_id', registrationId),
    supabaseAdmin
      .from('basic_coach_team_registrations')
      .select('basic_coach_team_id')
      .eq('tournament_team_id', registrationId)
      .maybeSingle<{ basic_coach_team_id: string }>(),
  ]);
  if (repError) throw repError;
  if (basicError) throw basicError;

  const found = new Map<string, RepTeamLink>();
  for (const row of repLinks ?? []) {
    found.set(row.rep_team_id as string, { repTeamId: row.rep_team_id as string, basicCoachTeamId: null });
  }

  if (basicLink?.basic_coach_team_id) {
    const { data: workspaces, error: wsError } = await supabaseAdmin
      .from('team_workspaces')
      .select('rep_team_id, basic_coach_team_id')
      .eq('basic_coach_team_id', basicLink.basic_coach_team_id);
    if (wsError) throw wsError;
    for (const ws of workspaces ?? []) {
      found.set(ws.rep_team_id as string, { repTeamId: ws.rep_team_id as string, basicCoachTeamId: ws.basic_coach_team_id as string });
    }
  }

  // A rep-linked team that ALSO has a workspace: carry its shadow so callers get the same answer
  // either way in.
  const missingShadow = [...found.values()].filter(l => !l.basicCoachTeamId).map(l => l.repTeamId);
  if (missingShadow.length > 0) {
    const { data: workspaces, error } = await supabaseAdmin
      .from('team_workspaces')
      .select('rep_team_id, basic_coach_team_id')
      .in('rep_team_id', missingShadow);
    if (error) throw error;
    for (const ws of workspaces ?? []) {
      const link = found.get(ws.rep_team_id as string);
      if (link && ws.basic_coach_team_id) link.basicCoachTeamId = ws.basic_coach_team_id as string;
    }
  }

  return [...found.values()];
}

/** Does this registration belong to this rep team, by either bridge? (The Premium page's door check.) */
export async function registrationBelongsToRepTeam(registrationId: string, repTeamId: string): Promise<boolean> {
  const links = await findRepTeamsForRegistration(registrationId);
  return links.some(l => l.repTeamId === repTeamId);
}

type RegistrationAssignment = RegistrationRepTeamAccess & { capabilities: CoachCapabilities };

/** Every coaching assignment the user holds on a rep team this registration belongs to (normally zero or one). */
async function findAssignmentsForRegistration(userId: string, registrationId: string): Promise<RegistrationAssignment[]> {
  const links = await findRepTeamsForRegistration(registrationId);
  if (links.length === 0) return [];

  const { data: repTeams, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id, org_id')
    .in('id', links.map(l => l.repTeamId));
  if (error) throw error;

  const found: RegistrationAssignment[] = [];
  for (const repTeam of repTeams ?? []) {
    const orgId = repTeam.org_id as string;
    const assignments = await getCoachingAssignmentsForUser(orgId, userId);
    const assignment = assignments.find(a => a.teamId === repTeam.id);
    if (!assignment) continue;
    const link = links.find(l => l.repTeamId === repTeam.id);
    found.push({
      repTeamId: repTeam.id as string,
      orgId,
      basicCoachTeamId: link?.basicCoachTeamId ?? null,
      capabilities: assignment.capabilities,
    });
  }
  return found;
}

/**
 * The paid-portal right to open a registration: a rep team the registration belongs to, on which
 * the user holds a coaching assignment that passes the Tournaments door. Null when none does.
 */
export async function findRepTeamAccessForRegistration(
  userId: string,
  registrationId: string,
): Promise<RegistrationRepTeamAccess | null> {
  const open = (await findAssignmentsForRegistration(userId, registrationId)).find(a => canOpenTournaments(a.capabilities));
  return open ? { repTeamId: open.repTeamId, orgId: open.orgId, basicCoachTeamId: open.basicCoachTeamId } : null;
}

/**
 * The one resolver behind "who may change this event's head coach" (lib/coach-event-head-coach.ts) —
 * read by the record (form or line) AND the PATCH route (refuse), so they cannot disagree.
 *
 * An ASSIGNMENT decides first: a Premium team's staff member may also be a member of the team's
 * free-team shadow, and membership alone would hand an assistant the head coach's rights. Only a
 * user with no assignment on the entry's team falls back to free-team membership (a free team's
 * owner). Null: neither — the caller's own access gate has already refused them.
 */
export async function resolveEventHeadCoachAccess(userId: string, registrationId: string): Promise<EventHeadCoachAccess> {
  const assignments = await findAssignmentsForRegistration(userId, registrationId);
  if (assignments.length > 0) {
    const best = assignments.find(a => canEditEventHeadCoach({ via: 'assignment', capabilities: a.capabilities })) ?? assignments[0];
    return { via: 'assignment', capabilities: best.capabilities };
  }
  return (await findLinkedBasicTeamForRegistration(userId, registrationId)) ? { via: 'membership' } : null;
}

/**
 * The browser-tab title for a tournament entry (Club Tier Stage 7d, T1): "Invitational 2026 · 15U AAA" —
 * the tournament, then the team — read the same in both portals. Call it only AFTER the caller's own
 * access gate (a pending or rejected entry's name is not public).
 */
export async function tournamentEntryTabTitle(registrationId: string): Promise<string | null> {
  const names = await tournamentEntryNames(registrationId);
  return names ? [names.tournamentName, names.teamName].filter(Boolean).join(' · ') : null;
}

/** The entry's team name and its tournament's name — the paid page's title and the tab title. */
export async function tournamentEntryNames(registrationId: string): Promise<{ teamName: string; tournamentName: string | null } | null> {
  const { data: team } = await supabaseAdmin
    .from('teams')
    .select('name, tournaments(name)')
    .eq('id', registrationId)
    .maybeSingle<{ name: string; tournaments: { name: string } | null }>();
  if (!team) return null;
  return { teamName: team.name, tournamentName: team.tournaments?.name ?? null };
}
