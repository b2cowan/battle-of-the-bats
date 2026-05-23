import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolUserAuth } from '@/lib/platform-auth';

export async function GET() {
  const auth = await requireDevToolUserAuth();
  if (auth.response) return auth.response;

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
      .select('id, slug, name, plan_id, internal_notes')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('platform_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('rep_teams').select('*', { count: 'exact', head: true }),
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
      id:        o.id,
      slug:      o.slug,
      name:      o.name,
      plan_id:   (o.plan_id ?? 'tournament') as string,
      protected: String(o.internal_notes ?? '').includes('[UAT_PROTECTED]'),
    })),
  });
}
