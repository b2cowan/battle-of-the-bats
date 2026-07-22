import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * lib/rep-team-tournament-links.ts — the `rep_team_tournament_registrations` bridge
 * (mig 196, WI-2C Layer 2). Explicit links from a tournament registration (`teams` row)
 * to a rep team, so a public tournament page can recognize a paid-portal coach whose
 * registration email doesn't match their account.
 *
 * Data ops only — every WRITE caller (the admin link endpoint) MUST first prove:
 *   • the registration belongs to a tournament in the caller's org (scope guard), and
 *   • `rep_teams.org_id === ctx.org.id` (cross-tenant linking is structurally forbidden).
 * These functions do not re-check auth; they assume the caller gated it.
 */

export type RepTeamRegistrationLink = {
  registrationId: string;
  repTeamId: string;
  repTeamName: string;
};

/** All rep-team links for a tournament's registrations, hydrated with the rep team name —
 *  powers the admin Registrations page's "linked" chips. */
export async function getRepTeamLinksForTournament(
  tournamentId: string,
): Promise<RepTeamRegistrationLink[]> {
  const { data: regs, error: regErr } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('tournament_id', tournamentId);
  if (regErr) throw regErr;

  const registrationIds = (regs ?? []).map(r => r.id as string);
  if (registrationIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('rep_team_tournament_registrations')
    .select('tournament_team_id, rep_team_id, rep_teams!inner(name)')
    .in('tournament_team_id', registrationIds);
  if (error) throw error;

  // PostgREST types an embedded to-one relationship as an array; normalize either shape.
  return ((data ?? []) as unknown as Array<{
    tournament_team_id: string;
    rep_team_id: string;
    rep_teams: { name: string | null } | Array<{ name: string | null }> | null;
  }>).map(row => {
    const rep = Array.isArray(row.rep_teams) ? row.rep_teams[0] : row.rep_teams;
    return {
      registrationId: row.tournament_team_id,
      repTeamId: row.rep_team_id,
      repTeamName: rep?.name ?? '',
    };
  });
}

/** Registration→rep-team links for a tournament, org-scoped on the link table's OWN `org_id`
 *  (never trust `rep_teams.org_id` alone). The resolver (WI-2C.4) intersects these rep team
 *  ids with the viewer's coaching assignments to award a precise coach hat. */
export async function getLinkedRepTeamsForTournament(params: {
  tournamentId: string;
  orgId: string;
}): Promise<Array<{ registrationId: string; repTeamId: string }>> {
  const { data: regs, error: regErr } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('tournament_id', params.tournamentId);
  if (regErr) throw regErr;

  const registrationIds = (regs ?? []).map(r => r.id as string);
  if (registrationIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('rep_team_tournament_registrations')
    .select('tournament_team_id, rep_team_id')
    .eq('org_id', params.orgId)
    .in('tournament_team_id', registrationIds);
  if (error) throw error;

  return ((data ?? []) as Array<{ tournament_team_id: string; rep_team_id: string }>).map(row => ({
    registrationId: row.tournament_team_id,
    repTeamId: row.rep_team_id,
  }));
}

/** Link a registration to a rep team (or relink to a different one — `tournament_team_id`
 *  is UNIQUE, so this upserts). `link_source='explicit'` (an admin used the control).
 *  Caller MUST have asserted registration-in-org AND `repTeam.org_id === orgId`. */
export async function linkRepTeamToRegistration(params: {
  registrationId: string;
  repTeamId: string;
  orgId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_tournament_registrations')
    .upsert(
      {
        tournament_team_id: params.registrationId,
        rep_team_id: params.repTeamId,
        org_id: params.orgId,
        linked_by_user_id: params.userId,
        link_source: 'explicit',
      },
      { onConflict: 'tournament_team_id' },
    );
  if (error) throw error;
}

/** Remove a registration's rep-team link (public-page recognition falls back to email-match). */
export async function unlinkRepTeamFromRegistration(registrationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('rep_team_tournament_registrations')
    .delete()
    .eq('tournament_team_id', registrationId);
  if (error) throw error;
}

/** Whether a rep team belongs to the given org — the cross-tenant guard the link endpoint
 *  runs before writing (a registration can only ever link to a rep team in its own org). */
export async function repTeamBelongsToOrg(repTeamId: string, orgId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('id')
    .eq('id', repTeamId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Whether a tournament registration (`teams` row) belongs to the given tournament — the
 *  scope guard the link endpoint runs so a caller can't link a registration from another
 *  (even same-org) tournament they passed the tournament scope check for. */
export async function registrationBelongsToTournament(
  registrationId: string,
  tournamentId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id')
    .eq('id', registrationId)
    .eq('tournament_id', tournamentId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
