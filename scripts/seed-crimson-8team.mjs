/**
 * Add a full, 8-team-capacity division ("U15") to the Crimson Cup dev tournament
 * so the double-elimination / placement bracket can be built and viewed.
 *
 * Idempotent: reuses the U15 division if it exists and tops it up to 8 accepted teams.
 * Run: node --env-file=.env.local scripts/seed-crimson-8team.mjs
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DIVISION_NAME = 'U15';
const CAPACITY = 8;
const TEAM_NAMES = ['Thunderbolts', 'Riverhawks', 'Iron Owls', 'Crimson Foxes', 'Night Wolves', 'Storm Surge', 'Steel Bears', 'Comet Kings'];

async function chk(label, { error }) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── locate Crimson Cup ───────────────────────────────────────────────────────
const { data: tours, error: tErr } = await db
  .from('tournaments').select('id, name, slug, org_id').ilike('name', '%crimson%');
await chk('find tournament', { error: tErr });
const tournament = tours?.[0];
if (!tournament) { console.error('Crimson Cup not found'); process.exit(1); }
console.log(`Tournament: ${tournament.name} [${tournament.slug}] id=${tournament.id}`);

// ── division (reuse or create) ───────────────────────────────────────────────
const { data: divs } = await db.from('divisions').select('*').eq('tournament_id', tournament.id);
let division = divs?.find(d => d.name === DIVISION_NAME);

if (!division) {
  const nextOrder = (divs ?? []).reduce((m, d) => Math.max(m, d.display_order ?? 0), 0) + 1;
  const { data: created, error } = await db.from('divisions').insert({
    tournament_id: tournament.id,
    name: DIVISION_NAME,
    display_order: nextOrder,
    capacity: CAPACITY,
    pool_count: 0,
    requires_pool_selection: false,
    is_closed: false,
    schedule_visibility: 'unpublished',
    playoff_config: { type: 'single', crossover: 'reseed', hasThirdPlace: false, teamsQualifying: 8, tieBreakers: ['h2h', 'rd', 'rf', 'ra'] },
  }).select().single();
  await chk('create division', { error });
  division = created;
  console.log(`Created division "${DIVISION_NAME}" id=${division.id} capacity=${CAPACITY}`);
} else {
  if (division.capacity !== CAPACITY) {
    const { error } = await db.from('divisions').update({ capacity: CAPACITY }).eq('id', division.id);
    await chk('set capacity', { error });
  }
  console.log(`Reusing division "${DIVISION_NAME}" id=${division.id} (capacity set to ${CAPACITY})`);
}

// ── ensure 8 accepted teams ──────────────────────────────────────────────────
const { data: existingTeams } = await db.from('teams').select('id, name, status').eq('division_id', division.id);
const haveNames = new Set((existingTeams ?? []).map(t => t.name));
const accepted = (existingTeams ?? []).filter(t => t.status === 'accepted').length;
console.log(`Existing teams: ${(existingTeams ?? []).length} (${accepted} accepted)`);

const toCreate = TEAM_NAMES.filter(n => !haveNames.has(n)).slice(0, Math.max(0, CAPACITY - (existingTeams ?? []).length));
if (toCreate.length) {
  const now = new Date().toISOString();
  const rows = toCreate.map((name, i) => ({
    tournament_id: tournament.id,
    division_id: division.id,
    name,
    coach: `Coach ${name.split(' ').slice(-1)[0]}`,
    email: `coach.${name.toLowerCase().replace(/[^a-z]+/g, '')}@example.com`,
    status: 'accepted',
    payment_status: 'paid',
    registered_at: new Date(Date.parse(now) - (TEAM_NAMES.length - i) * 60_000).toISOString(),
  }));
  const { error } = await db.from('teams').insert(rows);
  await chk('insert teams', { error });
  console.log(`Inserted ${rows.length} accepted teams: ${toCreate.join(', ')}`);
} else {
  console.log('No new teams needed.');
}

// ── report ───────────────────────────────────────────────────────────────────
const { count: total } = await db.from('teams').select('id', { count: 'exact', head: true }).eq('division_id', division.id);
const { count: acc } = await db.from('teams').select('id', { count: 'exact', head: true }).eq('division_id', division.id).eq('status', 'accepted');
console.log(`\n✅ Division "${DIVISION_NAME}" — capacity ${CAPACITY}, ${acc}/${total} teams accepted ${acc >= CAPACITY ? '(FULL)' : ''}`);
console.log(`   Public: /${tournament.slug ? 'dev-test-org/' + tournament.slug : ''}  ·  build the bracket in Admin → Schedule → Playoffs`);
