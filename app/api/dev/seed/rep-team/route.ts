import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';

// Fallback chain — first match wins; ordered by most-featured plan first
const DEV_ORG_SLUGS = ['dev-club-org', 'dev-league-org', 'dev-tplus-org', 'dev-tournament-org', 'dev-test-org'];
const TEAM_SLUG    = 'dev-rep-u15';

export async function POST(request: Request) {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({})) as { orgId?: string };

  let org: { id: string; slug: string } | undefined;

  // Use caller-provided orgId if given
  if (body.orgId) {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id, slug')
      .eq('id', body.orgId)
      .maybeSingle();
    org = data ?? undefined;
  }

  // Fallback: pick highest-plan dev org
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

  // Rep team
  let { data: team } = await supabaseAdmin
    .from('rep_teams')
    .select('id')
    .eq('slug', TEAM_SLUG)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!team) {
    const { data, error } = await supabaseAdmin
      .from('rep_teams')
      .insert({
        org_id:      org.id,
        name:        'Dev Rep U15',
        slug:        TEAM_SLUG,
        sport:       'softball',
        division:   'U15',
        description: 'Dev seed rep team',
        color:       '#4fa3e0',
        is_archived: false,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    team = data;
    log.push('Created rep team: Dev Rep U15');
  } else {
    log.push('Rep team already exists — skipping');
    return NextResponse.json({ ok: true, log });
  }

  // Program year
  const { data: year, error: yearErr } = await supabaseAdmin
    .from('rep_program_years')
    .insert({
      team_id:   team.id,
      org_id:    org.id,
      name:      '2026 Season',
      year:      2026,
      status:    'active',
      tryout_open: false,
    })
    .select('id')
    .single();

  if (yearErr) return NextResponse.json({ error: yearErr.message }, { status: 500 });
  log.push('Created program year: 2026 Season');

  // Roster players
  const players = [
    { first: 'Jordan', last: 'Dev',   num: '7'  },
    { first: 'Taylor', last: 'Test',  num: '12' },
    { first: 'Morgan', last: 'Seed',  num: '24' },
  ];

  await supabaseAdmin.from('rep_roster_players').insert(
    players.map(p => ({
      program_year_id:    year.id,
      team_id:            team!.id,
      org_id:             org.id,
      player_first_name:  p.first,
      player_last_name:   p.last,
      player_number:      p.num,
      guardian_first_name: 'Parent',
      guardian_last_name:  p.last,
      guardian_email:     `parent.${p.last.toLowerCase()}@dev.local`,
      status:             'active',
      source:             'admin',
    }))
  );
  log.push(`Created ${players.length} roster players`);

  // Coach — link coach@dev.local if they exist
  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const coachAuth = userList?.users.find(u => u.email === 'coach@dev.local');
  if (coachAuth) {
    await supabaseAdmin.from('rep_team_coaches').insert({
      program_year_id: year.id,
      team_id:         team.id,
      org_id:          org.id,
      user_id:         coachAuth.id,
      coach_role:      'head_coach',
    });
    log.push('Linked coach@dev.local as head coach');
  } else {
    log.push('coach@dev.local not found — seed User Set to add a coach');
  }

  // Events
  const now = new Date();
  const future = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  await supabaseAdmin.from('rep_team_events').insert([
    {
      program_year_id: year.id,
      team_id:         team.id,
      org_id:          org.id,
      event_type:      'practice',
      name:            'Dev Practice',
      starts_at:       future(3),
      ends_at:         future(3),
      location:        'Dev Field 1',
      is_recurring:    false,
    },
    {
      program_year_id: year.id,
      team_id:         team.id,
      org_id:          org.id,
      event_type:      'league_game',
      name:            'Dev Game vs Opponents',
      starts_at:       future(7),
      location:        'Dev Diamond 2',
      opponent:        'Opponents FC',
      home_away:       'home',
      is_recurring:    false,
    },
  ]);
  log.push('Created 2 events (1 practice, 1 game)');

  return NextResponse.json({ ok: true, log });
}
