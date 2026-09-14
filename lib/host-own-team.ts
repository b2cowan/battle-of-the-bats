import { supabaseAdmin } from './supabase-admin';
import { getTeamWorkspaceForOrg, isTeamWorkspaceOrg } from './team-workspace-entitlements';
import { resolveBasicCoachTeamIdForWorkspace } from './basic-coach-teams';
import { linkRepTeamToRegistration } from './rep-team-tournament-links';
import { duplicateTournamentTeamMessage, findDuplicateTournamentTeam } from './team-registration-duplicates';
import type { Organization } from './types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "ADD MY TEAM" — the hosting coach's own team, in the tournament they run from their portal.
 * (COACH_HOST_OWN_TEAM_ENTRY_PLAN.md Part A — owner accepted 2026-09-13; D1 Paid, D2 delegates.)
 *
 * A coaches portal that hosts a tournament is the one organizer on the platform who IS a team, and
 * until this it was the only one with no door: the club-side "Link to rep team" control is gated
 * off for a workspace org (deliberately — a portal has exactly one team, a picker is the wrong
 * shape), and both coach-side doors (register on the public page, accept the notify email) assume
 * the coach is a guest of someone else's tournament.
 *
 * What this writes, in order: the `teams` registration row — AS THE HEAD COACH (the workspace's
 * primary owner), whoever clicked, because the public page's coach recognition keys on that email
 * and a delegate with Run tournaments is registering the head coach's team, not their own — then
 * BOTH bridges: the free-team one (`basic_coach_team_registrations`, which the coach-side record,
 * roster submission and history all read) and the rep-team one (`rep_team_tournament_registrations`,
 * which public-page recognition reads for staff whose email is not on the registration). Written
 * directly, not through the claim path: the claim's email-equality check is for a coach PROVING
 * ownership, and here the server already holds the whole chain (org → workspace → rep team → shadow).
 *
 * Tenant rule: the org is the workspace org, the rep team is that workspace's, the registration is in
 * a tournament the caller already passed `requireTournamentInOrg` for — every side of every bridge
 * is the same org, so cross-tenant linking is structurally impossible here, and the rep-team link's
 * denormalized `org_id` is simply the org.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type HostOwnTeamState = {
  teamName: string;
  repTeamId: string;
  /** The registration already in this tournament for the host's team, if any. */
  registrationId: string | null;
};

export class HostOwnTeamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HostOwnTeamError';
    this.status = status;
  }
}

type ResolvedHost = {
  workspaceId: string;
  repTeamId: string;
  teamName: string;
  basicCoachTeamId: string | null;
  headCoach: { userId: string | null; name: string | null; email: string | null };
};

async function resolveHost(org: Organization): Promise<ResolvedHost | null> {
  if (!isTeamWorkspaceOrg(org)) return null;
  const workspace = await getTeamWorkspaceForOrg(org.id);
  if (!workspace) return null;

  const [{ data: repTeam, error: repTeamError }, basicCoachTeamId, headCoach] = await Promise.all([
    supabaseAdmin.from('rep_teams').select('id, name').eq('id', workspace.repTeamId).maybeSingle<{ id: string; name: string }>(),
    resolveBasicCoachTeamIdForWorkspace(workspace),
    resolveHeadCoach(org.id, workspace.primaryOwnerUserId),
  ]);
  if (repTeamError) throw repTeamError;
  if (!repTeam) return null;

  return { workspaceId: workspace.id, repTeamId: repTeam.id, teamName: repTeam.name, basicCoachTeamId, headCoach };
}

/** The workspace's primary owner: display name from the org membership (the staff sheet's source), email from auth. */
async function resolveHeadCoach(orgId: string, userId: string | null): Promise<ResolvedHost['headCoach']> {
  if (!userId) return { userId: null, name: null, email: null };
  const [{ data: member }, { data: authUser }] = await Promise.all([
    supabaseAdmin.from('organization_members').select('display_name').eq('organization_id', orgId).eq('user_id', userId).maybeSingle<{ display_name: string | null }>(),
    supabaseAdmin.auth.admin.getUserById(userId),
  ]);
  const md = (authUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const metaName = pick(md.full_name) || pick(md.display_name) || `${pick(md.first_name)} ${pick(md.last_name)}`.trim();
  return {
    userId,
    name: member?.display_name?.trim() || metaName || null,
    email: authUser?.user?.email?.trim().toLowerCase() || null,
  };
}

/** Registration ids in this tournament that either bridge reaches from the host's team. */
async function findHostRegistrationInTournament(host: ResolvedHost, tournamentId: string): Promise<string | null> {
  const [basicLinks, repLinks] = await Promise.all([
    host.basicCoachTeamId
      ? supabaseAdmin.from('basic_coach_team_registrations').select('tournament_team_id').eq('basic_coach_team_id', host.basicCoachTeamId)
      : Promise.resolve({ data: [] as Array<{ tournament_team_id: string }>, error: null }),
    supabaseAdmin.from('rep_team_tournament_registrations').select('tournament_team_id').eq('rep_team_id', host.repTeamId),
  ]);
  if (basicLinks.error) throw basicLinks.error;
  if (repLinks.error) throw repLinks.error;
  const ids = [...new Set([...(basicLinks.data ?? []), ...(repLinks.data ?? [])].map(r => r.tournament_team_id as string))];
  if (ids.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId)
    .in('id', ids)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * What the Teams page needs to draw the door: the host's team name and whether it is already in
 * this tournament. `null` when the org is not a coaches portal (the door does not exist there).
 */
export async function getHostOwnTeamState(org: Organization, tournamentId: string): Promise<HostOwnTeamState | null> {
  const host = await resolveHost(org);
  if (!host) return null;
  const registrationId = await findHostRegistrationInTournament(host, tournamentId);
  return { teamName: host.teamName, repTeamId: host.repTeamId, registrationId };
}

export async function addHostOwnTeamToTournament(params: {
  org: Organization;
  tournamentId: string;
  divisionId: string;
  paymentStatus: 'paid' | 'pending';
  actorUserId: string;
}): Promise<{ registrationId: string; teamName: string }> {
  const host = await resolveHost(params.org);
  if (!host) throw new HostOwnTeamError(403, "This tournament isn't run from a coaches portal, so there is no \"my team\" to add.");
  if (!host.basicCoachTeamId) throw new HostOwnTeamError(409, 'Your portal has no team owner to register under yet. Ask FieldLogicHQ support.');
  if (!host.headCoach.email) throw new HostOwnTeamError(409, 'The head coach account has no email to register under.');

  const already = await findHostRegistrationInTournament(host, params.tournamentId);
  if (already) throw new HostOwnTeamError(409, `${host.teamName} is already in this tournament.`);

  const { data: division, error: divisionError } = await supabaseAdmin
    .from('divisions')
    .select('id, tournament_id')
    .eq('id', params.divisionId)
    .maybeSingle<{ id: string; tournament_id: string }>();
  if (divisionError) throw divisionError;
  if (!division || division.tournament_id !== params.tournamentId) {
    throw new HostOwnTeamError(400, 'Division does not belong to this tournament.');
  }

  // Same duplicate rule Add Team applies (a name twice in one division is a mistake, not a team).
  const duplicate = await findDuplicateTournamentTeam({
    tournamentId: params.tournamentId,
    divisionId: params.divisionId,
    teamName: host.teamName,
  });
  if (duplicate) throw new HostOwnTeamError(409, duplicateTournamentTeamMessage(host.teamName));

  const registrationId = crypto.randomUUID();
  const { error: insertError } = await supabaseAdmin.from('teams').insert({
    id: registrationId,
    tournament_id: params.tournamentId,
    division_id: params.divisionId,
    name: host.teamName,
    coach: host.headCoach.name,
    email: host.headCoach.email,
    status: 'accepted',
    payment_status: params.paymentStatus,
    registered_at: new Date().toISOString(),
  });
  if (insertError) throw insertError;

  // Both bridges — and the three writes stand or fall together. A registration with no bridge is
  // an orphan the host can neither reach from the portal nor re-add (the duplicate-name rule would
  // refuse it), so a failed bridge write takes the registration back out and reports one clean
  // "nothing was saved" (adversarial review, 2026-09-13).
  try {
    const { error: bridgeError } = await supabaseAdmin.from('basic_coach_team_registrations').insert({
      basic_coach_team_id: host.basicCoachTeamId,
      tournament_team_id: registrationId,
      linked_by_user_id: params.actorUserId,
      link_source: 'explicit',
    });
    if (bridgeError) throw bridgeError;

    await linkRepTeamToRegistration({
      registrationId,
      repTeamId: host.repTeamId,
      orgId: params.org.id,
      userId: params.actorUserId,
    });
  } catch (err) {
    console.error('[addHostOwnTeamToTournament] bridge write failed; removing the registration again:', err);
    // Both bridge tables cascade from teams(id), so one delete unwinds whatever landed.
    await supabaseAdmin.from('teams').delete().eq('id', registrationId);
    throw new HostOwnTeamError(500, 'Your team could not be connected to this tournament, so nothing was saved. Try again.');
  }

  return { registrationId, teamName: host.teamName };
}
