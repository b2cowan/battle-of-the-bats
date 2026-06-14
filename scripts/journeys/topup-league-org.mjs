/**
 * Journey-audit staging top-up for J3/J4/J7 (dev-league-org house league).
 * The dev-seed route inserts league_registrations with INVALID statuses
 * ('accepted'/'waitlist' vs CHECK pending_review|active|waitlisted|declined|withdrawn)
 * and INVALID sources ('admin'/'public' vs CHECK public_form|admin_manual),
 * and ignores the insert error - so the org has zero registrations. This script
 * stages a realistic season directly with valid rows. Idempotent.
 *
 * Run: node --env-file=.env.local scripts/journeys/topup-league-org.mjs
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const chk = (label, { error }) => { if (error) { console.error(`FAIL ${label}:`, error.message); process.exit(1); } };

const { data: org } = await db.from('organizations').select('id').eq('slug', 'dev-league-org').single();
if (!org) { console.error('dev-league-org missing - run run-dev-seeds.mjs first'); process.exit(1); }

// -- Season 2026 (in-season ops fixture) --------------------------------------
const { data: s26 } = await db.from('league_seasons').select('id').eq('org_id', org.id).eq('slug', 'dev-league-2026').single();
if (!s26) { console.error('dev-league-2026 missing'); process.exit(1); }

chk('season26 settings', await db.from('league_seasons').update({
  description: 'Recreational U10 softball - Tuesday & Thursday evenings at Lions Park. All skill levels welcome.',
  registration_open_at: '2026-04-01T12:00:00Z',
  registration_close_at: '2026-05-15T23:59:00Z',
  waiver_text: 'I acknowledge that softball involves risk of injury and consent to my child participating in Dev League programming. Photos may be taken at league events for league communications.',
}).eq('id', s26.id));

const { data: divs } = await db.from('league_divisions').select('id, name').eq('season_id', s26.id).order('sort_order');
const [divA, divB] = divs;
chk('division capacities', await db.from('league_divisions').update({ capacity: 12 }).eq('season_id', s26.id).is('capacity', null));

const { data: teams } = await db.from('league_teams').select('id, name, division_id').eq('season_id', s26.id).order('sort_order');
const teamsA = teams.filter(t => t.division_id === divA.id);
const teamsB = teams.filter(t => t.division_id === divB.id);
chk('team coaches', await db.from('league_teams').update({ coach_name: 'Pat Volunteer' }).eq('season_id', s26.id).is('coach_name', null));

// -- Registrations (valid statuses) -------------------------------------------
chk('wipe old regs', await db.from('league_registrations').delete().eq('season_id', s26.id).like('guardian_email', '%@dev.local'));

const reg = (first, last, div, status, opts = {}) => ({
  season_id: s26.id,
  division_id: div.id,
  player_first_name: first,
  player_last_name: last,
  player_date_of_birth: opts.dob ?? '2016-05-14',
  player_jersey_pref: opts.jersey ?? null,
  player_position_pref: opts.pos ?? null,
  guardian_first_name: opts.gFirst ?? 'Parent',
  guardian_last_name: last,
  guardian_email: `${first.toLowerCase()}.${last.toLowerCase()}@dev.local`,
  guardian_phone: opts.phone ?? '905-555-0142',
  status,
  waitlist_position: opts.wl ?? null,
  team_id: opts.team ?? null,
  registration_fee_paid: opts.paid ?? false,
  admin_notes: opts.notes ?? null,
  source: opts.source ?? 'public_form',
  registered_at: opts.at ?? '2026-04-12T18:30:00Z',
  updated_at: new Date('2026-06-01T12:00:00Z').toISOString(),
});

chk('registrations', await db.from('league_registrations').insert([
  // Division A - 8 active (assigned across the 3 teams), 2 pending, 2 waitlisted
  reg('Avery', 'Macdonald', divA, 'active', { team: teamsA[0].id, paid: true, jersey: '7', pos: 'Pitcher' }),
  reg('Liam', 'Chen', divA, 'active', { team: teamsA[0].id, paid: true }),
  reg('Sofia', 'Rossi', divA, 'active', { team: teamsA[0].id, paid: false, notes: 'Fee promised by e-transfer this week' }),
  reg('Noah', 'Patel', divA, 'active', { team: teamsA[1].id, paid: true, pos: 'Catcher' }),
  reg('Emma', 'Tremblay', divA, 'active', { team: teamsA[1].id, paid: true }),
  reg('Jack', 'Osei', divA, 'active', { team: teamsA[1].id, paid: true, jersey: '12' }),
  reg('Olivia', 'Kowalski', divA, 'active', { team: teamsA[2].id, paid: true }),
  reg('Lucas', 'Nguyen', divA, 'active', { team: teamsA[2].id, paid: false }),
  reg('Maya', 'Singh', divA, 'pending_review', { at: '2026-05-10T21:05:00Z' }),
  reg('Ethan', 'Brown', divA, 'pending_review', { at: '2026-05-11T08:40:00Z', source: 'admin_manual', notes: 'Phoned in - needs division confirmation' }),
  reg('Zoe', 'Leblanc', divA, 'waitlisted', { wl: 1, at: '2026-05-12T19:00:00Z' }),
  reg('Owen', 'Garcia', divA, 'waitlisted', { wl: 2, at: '2026-05-13T10:15:00Z' }),
  // Division B - 4 active, 1 declined, 1 withdrawn
  reg('Isla', 'Fontaine', divB, 'active', { team: teamsB[0].id, paid: true }),
  reg('Mason', 'Wright', divB, 'active', { team: teamsB[1].id, paid: true }),
  reg('Charlotte', 'Dubois', divB, 'active', { team: teamsB[2].id, paid: true }),
  reg('Henry', 'Kim', divB, 'active', { team: teamsB[0].id, paid: false }),
  reg('Ella', 'Murphy', divB, 'declined', { notes: 'Outside catchment - referred to Halton league' }),
  reg('James', 'Walker', divB, 'withdrawn', { notes: 'Family moved mid-May; fee refunded by cheque' }),
]));

// -- Scores on early games so standings compute --------------------------------
const { data: games } = await db.from('league_games').select('id, division_id, scheduled_at').eq('season_id', s26.id).order('scheduled_at');
const firstA = games.filter(g => g.division_id === divA.id)[0];
const firstB = games.filter(g => g.division_id === divB.id)[0];
chk('score A', await db.from('league_games').update({ status: 'completed', home_score: 9, away_score: 4 }).eq('id', firstA.id));
chk('score B', await db.from('league_games').update({ status: 'completed', home_score: 5, away_score: 5 }).eq('id', firstB.id));

// -- Practices ------------------------------------------------------------------
chk('wipe practices', await db.from('league_practices').delete().eq('season_id', s26.id));
chk('practices', await db.from('league_practices').insert([
  { org_id: org.id, season_id: s26.id, division_id: divA.id, team_id: teamsA[0].id, scheduled_at: '2026-06-16T22:00:00Z', ends_at: '2026-06-16T23:30:00Z', location: 'Lions Park - Diamond 3', status: 'scheduled' },
  { org_id: org.id, season_id: s26.id, division_id: divB.id, team_id: teamsB[0].id, scheduled_at: '2026-06-18T22:00:00Z', ends_at: '2026-06-18T23:30:00Z', location: 'Lions Park - Diamond 3', status: 'scheduled', notes: 'Bring helmets - batting practice' },
]));

// -- Season 2027 (registration-open fixture for J7) -----------------------------
let { data: s27 } = await db.from('league_seasons').select('id').eq('org_id', org.id).eq('slug', 'dev-league-2027').maybeSingle();
if (!s27) {
  const { data, error } = await db.from('league_seasons').insert({
    org_id: org.id,
    name: 'Dev House League 2027',
    slug: 'dev-league-2027',
    sport: 'softball',
    division: 'U10',
    status: 'registration_open',
    description: 'Registration is open for the 2027 season! Tuesday & Thursday evenings, June through August.',
    registration_fee: 165,
    auto_generate_fees: false,
    auto_approve_under_capacity: true,
    auto_promote_waitlist: true,
    registration_open_at: '2026-06-01T12:00:00Z',
    registration_close_at: '2026-08-01T23:59:00Z',
    season_start_date: '2027-06-01',
    season_end_date: '2027-08-31',
    waiver_text: 'I acknowledge that softball involves risk of injury and consent to my child participating in Dev League programming.',
  }).select('id').single();
  chk('season27', { error });
  s27 = data;
  chk('divs27', await db.from('league_divisions').insert([
    { season_id: s27.id, name: 'U10 Division A', capacity: 12, sort_order: 0 },
    { season_id: s27.id, name: 'U10 Division B', capacity: 12, sort_order: 1 },
  ]));
}
const { data: divs27 } = await db.from('league_divisions').select('id').eq('season_id', s27.id).order('sort_order');
chk('wipe regs27', await db.from('league_registrations').delete().eq('season_id', s27.id).like('guardian_email', '%@dev.local'));
chk('regs27', await db.from('league_registrations').insert([
  { season_id: s27.id, division_id: divs27[0].id, player_first_name: 'Avery', player_last_name: 'Macdonald', guardian_first_name: 'Parent', guardian_last_name: 'Macdonald', guardian_email: 'avery.macdonald@dev.local', status: 'active', registration_fee_paid: true, source: 'public_form', registered_at: '2026-06-02T14:00:00Z', updated_at: new Date().toISOString() },
  { season_id: s27.id, division_id: divs27[0].id, player_first_name: 'Liam', player_last_name: 'Chen', guardian_first_name: 'Parent', guardian_last_name: 'Chen', guardian_email: 'liam.chen@dev.local', status: 'active', registration_fee_paid: false, source: 'public_form', registered_at: '2026-06-03T09:30:00Z', updated_at: new Date().toISOString() },
]));

console.log('OK dev-league-org staged: 2026 in-season (18 regs, 2 scored games, 2 practices) + 2027 registration_open (2 regs)');
