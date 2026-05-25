import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';

// Fallback chain — first match wins; ordered by most-featured plan first
const DEV_ORG_SLUGS = ['dev-club-org', 'dev-league-org', 'dev-tplus-org', 'dev-tournament-org', 'dev-test-org'];
const SEASON_SLUG  = 'dev-league-2026';

type SeedGame = {
  season_id: string;
  division_id: string;
  home_team_id: string;
  away_team_id: string;
  scheduled_at: string;
  status: string;
};

export async function POST(request: Request) {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({})) as { orgId?: string };

  let org: { id: string; slug: string } | undefined;

  if (body.orgId) {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .eq('id', body.orgId)
      .maybeSingle();
    org = data ?? undefined;
  }

  if (!org) {
    const { data: orgRows } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .in('slug', DEV_ORG_SLUGS);
    org = DEV_ORG_SLUGS.map(s => orgRows?.find(o => o.slug === s)).find(Boolean);
  }

  if (!org) return NextResponse.json({ error: 'Seed an org first.' }, { status: 400 });

  const log: string[] = [];
  log.push(`Seeding into org: ${org.slug}`);

  // Season
  let { data: season } = await supabaseAdmin
    .from('league_seasons')
    .select('id')
    .eq('slug', SEASON_SLUG)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!season) {
    const { data, error } = await supabaseAdmin
      .from('league_seasons')
      .insert({
        org_id: org.id,
        name: 'Dev House League 2026',
        slug: SEASON_SLUG,
        sport: 'softball',
        division: 'U10',
        status: 'active',
        registration_fee: 150,
        auto_generate_fees: false,
        auto_approve_under_capacity: true,
        auto_promote_waitlist: true,
        season_start_date: '2026-06-01',
        season_end_date:   '2026-08-31',
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    season = data;
    log.push('Created season: Dev House League 2026');
  } else {
    log.push('Season already exists — skipping');
    return NextResponse.json({ ok: true, log });
  }

  // Divisions
  const { data: divisions } = await supabaseAdmin
    .from('league_divisions')
    .insert([
      { season_id: season.id, name: 'Division A', sort_order: 0 },
      { season_id: season.id, name: 'Division B', sort_order: 1 },
    ])
    .select('id, name');

  log.push(`Created divisions: ${divisions?.map(d => d.name).join(', ')}`);

  // Teams — 3 per division
  const teamNames = [['Cardinals', 'Jays', 'Orioles'], ['Tigers', 'Cubs', 'Braves']];

  for (let i = 0; i < (divisions ?? []).length; i++) {
    const div = divisions![i];
    const { data: teams } = await supabaseAdmin
      .from('league_teams')
      .insert(teamNames[i].map((name, j) => ({
        season_id:   season!.id,
        division_id: div.id,
        name,
        color: ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899'][i * 3 + j],
        sort_order: j,
      })))
      .select('id, name');

    log.push(`Created ${teams?.length} teams in ${div.name}`);

    // Round-robin games within each division
    if (!teams) continue;
    const games: SeedGame[] = [];
    let dayOffset = 0;

    for (let a = 0; a < teams.length; a++) {
      for (let b = a + 1; b < teams.length; b++) {
        const d = new Date('2026-06-07');
        d.setDate(d.getDate() + dayOffset * 7);
        games.push({
          season_id:    season!.id,
          division_id:  div.id,
          home_team_id: teams[a].id,
          away_team_id: teams[b].id,
          scheduled_at: `${d.toISOString().slice(0, 10)}T10:00:00Z`,
          status:       'scheduled',
        });
        dayOffset++;
      }
    }

    await supabaseAdmin.from('league_games').insert(games);
    log.push(`Created ${games.length} games in ${div.name}`);
  }

  // Registrations
  const firstDivId = divisions?.[0]?.id;
  if (firstDivId) {
    await supabaseAdmin.from('league_registrations').insert([
      {
        season_id: season.id,
        division_id: firstDivId,
        player_first_name: 'Alex', player_last_name: 'Dev',
        guardian_first_name: 'Pat', guardian_last_name: 'Dev',
        guardian_email: 'parent1@dev.local',
        status: 'accepted',
        registration_fee_paid: true,
        source: 'admin',
        registered_at: new Date().toISOString(),
      },
      {
        season_id: season.id,
        division_id: firstDivId,
        player_first_name: 'Sam', player_last_name: 'Test',
        guardian_first_name: 'Lee', guardian_last_name: 'Test',
        guardian_email: 'parent2@dev.local',
        status: 'waitlist',
        waitlist_position: 1,
        registration_fee_paid: false,
        source: 'public',
        registered_at: new Date().toISOString(),
      },
    ]);
    log.push('Created 2 sample registrations');
  }

  return NextResponse.json({ ok: true, log });
}
