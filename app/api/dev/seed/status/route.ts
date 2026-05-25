import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolUserAuth } from '@/lib/platform-auth';

export async function GET() {
  const auth = await requireDevToolUserAuth();
  if (auth.response) return auth.response;

  // Pre-fetch team_workspace org IDs so we can scope the rep_teams count to
  // only show teams seeded via the Rep Team card (not those inside Coach Portal workspaces).
  const { data: wsOrgRows } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('account_kind', 'team_workspace');
  const wsOrgIds = (wsOrgRows ?? []).map(o => o.id);

  const repTeamsBase = supabaseAdmin.from('rep_teams').select('*', { count: 'exact', head: true });
  const repTeamsQuery = wsOrgIds.length > 0
    ? repTeamsBase.not('org_id', 'in', `(${wsOrgIds.join(',')})`)
    : repTeamsBase;

  const [
    { count: orgs },
    { data: orgRows },
    { count: platformUsers },
    { count: tournaments },
    { count: leagueSeasons },
    { count: repTeams },
    { count: teamWorkspaces },
    { count: teamClaims },
    { count: orgUsers },
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('organizations')
      .select('id, slug, name, plan_id, internal_notes, account_kind')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('platform_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true }),
    repTeamsQuery,
    supabaseAdmin.from('team_workspaces').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('team_workspace_claims').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('organization_members').select('*', { count: 'exact', head: true })
      .neq('role', 'owner'),
  ]);

  return NextResponse.json({
    orgs:           orgs ?? 0,
    platformUsers:  platformUsers ?? 0,
    tournaments:    tournaments ?? 0,
    leagueSeasons:  leagueSeasons ?? 0,
    repTeams:       repTeams ?? 0,
    teamWorkspaces: teamWorkspaces ?? 0,
    teamClaims:     teamClaims ?? 0,
    orgUsers:       orgUsers ?? 0,
    orgList: (orgRows ?? []).map(o => ({
      id:           o.id,
      slug:         o.slug,
      name:         o.name,
      plan_id:      (o.plan_id ?? 'tournament') as string,
      protected:    String(o.internal_notes ?? '').includes('[UAT_PROTECTED]'),
      account_kind: ((o as Record<string, unknown>).account_kind as string | null) ?? 'org',
    })),
  });
}
