import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEV_ORG_SLUG = 'dev-test-org';
const YEAR = 2026;
const SLUG = 'dev-tournament-2026';

export async function POST() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', DEV_ORG_SLUG)
    .maybeSingle();

  if (!org) return NextResponse.json({ error: 'Seed an org first.' }, { status: 400 });

  const log: string[] = [];

  // Tournament
  let { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .eq('slug', SLUG)
    .eq('organization_id', org.id)
    .maybeSingle();

  if (!tournament) {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .insert({
        organization_id: org.id,
        name: 'Dev Tournament 2026',
        slug: SLUG,
        year: YEAR,
        status: 'active',
        is_active: true,
        start_date: `${YEAR}-07-15`,
        end_date:   `${YEAR}-07-17`,
        contact_email: 'owner@dev.local',
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    tournament = data;
    log.push('Created tournament: Dev Tournament 2026');
  } else {
    log.push('Tournament already exists — skipping');
    return NextResponse.json({ ok: true, log });
  }

  // Age groups
  const ageGroupDefs = [
    { name: 'U11', min_age: 9,  max_age: 11 },
    { name: 'U13', min_age: 11, max_age: 13 },
  ];

  const { data: ageGroups } = await supabaseAdmin
    .from('age_groups')
    .insert(ageGroupDefs.map((ag, i) => ({
      tournament_id: tournament!.id,
      name: ag.name,
      min_age: ag.min_age,
      max_age: ag.max_age,
      display_order: i,
      is_closed: false,
      requires_pool_selection: false,
    })))
    .select('id, name');

  log.push(`Created age groups: ${ageGroups?.map(a => a.name).join(', ')}`);

  // Teams — 4 per age group
  const teamNames = ['Eagles', 'Hawks', 'Lions', 'Bears'];
  const now = new Date().toISOString();

  for (const ag of (ageGroups ?? [])) {
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .insert(teamNames.map(name => ({
        tournament_id: tournament!.id,
        age_group_id: ag.id,
        name: `${name} ${ag.name}`,
        coach: `Coach Dev`,
        email: `coach@dev.local`,
        players: [],
        status: 'accepted',
        payment_status: 'paid',
        registered_at: now,
      })))
      .select('id, name');

    log.push(`Created ${teams?.length} teams for ${ag.name}`);

    // Round-robin games (each team plays each other once)
    if (!teams) continue;
    const gameDates = [`${YEAR}-07-15`, `${YEAR}-07-16`, `${YEAR}-07-17`];
    const games: any[] = [];
    let dateIdx = 0;

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        games.push({
          tournament_id:  tournament!.id,
          age_group_id:   ag.id,
          home_team_id:   teams[i].id,
          away_team_id:   teams[j].id,
          game_date:      gameDates[dateIdx % gameDates.length],
          game_time:      `${9 + (dateIdx % 6) * 1}:00`,
          status:         'scheduled',
          is_playoff:     false,
        });
        dateIdx++;
      }
    }

    await supabaseAdmin.from('games').insert(games);
    log.push(`Created ${games.length} games for ${ag.name}`);
  }

  return NextResponse.json({ ok: true, log });
}
