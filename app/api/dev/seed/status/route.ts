import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEV_ORG_SLUG = 'dev-test-org';

export async function GET() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [
    { count: orgs },
    { data: orgRow },
    { count: platformUsers },
    { count: tournaments },
    { count: leagueSeasons },
    { count: repTeams },
    { count: orgUsers },
  ] = await Promise.all([
    supabaseAdmin.from('organizations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('organizations').select('id, slug').eq('slug', DEV_ORG_SLUG).maybeSingle(),
    supabaseAdmin.from('platform_users').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('tournaments').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('league_seasons').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('rep_teams').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('organization_members').select('*', { count: 'exact', head: true })
      .neq('role', 'owner'),
  ]);

  return NextResponse.json({
    orgs:          orgs ?? 0,
    orgId:         (orgRow as any)?.id ?? null,
    orgSlug:       (orgRow as any)?.slug ?? null,
    platformUsers: platformUsers ?? 0,
    tournaments:   tournaments ?? 0,
    leagueSeasons: leagueSeasons ?? 0,
    repTeams:      repTeams ?? 0,
    orgUsers:      orgUsers ?? 0,
  });
}
