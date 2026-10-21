import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/** Stage 7a/7b definition: a registration linked to a rep team owned by its host club. */
export async function isOurTournamentTeam(orgId: string, registrationId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('rep_team_tournament_registrations')
    .select('rep_team_id, rep_teams(org_id)')
    .eq('org_id', orgId).eq('tournament_team_id', registrationId);
  if (error) throw error;
  return (data ?? []).some(link => {
    const team = link.rep_teams as unknown as { org_id: string } | null;
    return team?.org_id === orgId;
  });
}
