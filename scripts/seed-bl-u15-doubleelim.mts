/**
 * Seed a PRE-PLAY double-elimination bracket onto branded-light's U15 division so
 * the draw-day reveal animation can be seen on a big (8-team) double-elim tree.
 *
 * - 8 accepted U15 teams are assigned seeds #1..#8 and resolved into round 1 as
 *   REAL teams (broadcast-ready names from the start, like a playoff-only event).
 * - Every bracket game is status='scheduled' with NO scores → the reveal's
 *   "seeded + pre-play" gate fires.
 * - Pool/round-robin games are left untouched; only U15 is_playoff games are
 *   replaced, so re-running is idempotent.
 *
 * Run: node --experimental-strip-types --env-file=.env.local scripts/seed-bl-u15-doubleelim.mts
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { generateBracket } from '../lib/playoff-bracket.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const TOUR_SLUG = 'branded-light';
const DIVISION_NAME = 'U15';
// Seed order #1..#8 (best → worst). generateBracket pairs 1v8, 2v7, etc.
const SEED_ORDER = ['Thunderbolts', 'Riverhawks', 'Iron Owls', 'Crimson Foxes', 'Night Wolves', 'Storm Surge', 'Steel Bears', 'Comet Kings'];

function fail(label: string, error: { message: string } | null) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── locate org → tournament → division → teams ───────────────────────────────
const { data: orgs } = await db.from('organizations').select('id').eq('slug', ORG_SLUG);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.error(`org ${ORG_SLUG} not found`); process.exit(1); }

const { data: tours } = await db.from('tournaments').select('id,name,slug,start_date,end_date').eq('org_id', orgId).eq('slug', TOUR_SLUG);
const tour = tours?.[0];
if (!tour) { console.error(`tournament ${TOUR_SLUG} not found`); process.exit(1); }

const { data: divs } = await db.from('divisions').select('id,name,playoff_config').eq('tournament_id', tour.id);
const division = (divs ?? []).find(d => d.name === DIVISION_NAME);
if (!division) { console.error(`division ${DIVISION_NAME} not found`); process.exit(1); }

const { data: allTeams } = await db.from('teams').select('id,name,status').eq('division_id', division.id).eq('status', 'accepted');
const byName = new Map((allTeams ?? []).map(t => [t.name, t]));

// Ordered seed list — fall back to any accepted team not explicitly listed.
const seededTeams = SEED_ORDER.map(n => byName.get(n)).filter(Boolean) as { id: string; name: string }[];
const extras = (allTeams ?? []).filter(t => !SEED_ORDER.includes(t.name));
for (const t of extras) seededTeams.push(t);
if (seededTeams.length < 8) { console.error(`need 8 accepted U15 teams, found ${seededTeams.length}`); process.exit(1); }
const seeds = seededTeams.slice(0, 8);
console.log(`Tournament: ${tour.name} [${tour.slug}]  ·  Division: ${DIVISION_NAME}`);
console.log(`Seeds: ${seeds.map((t, i) => `#${i + 1} ${t.name}`).join(', ')}`);

// ── stamp teams.seed = 1..8 (drives the admin "By Seed #" option) ────────────
for (let i = 0; i < seeds.length; i++) {
  fail('set seed', (await db.from('teams').update({ seed: i + 1 }).eq('id', seeds[i].id)).error);
}

// ── wipe prior U15 playoff games (idempotent; leaves pool games intact) ───────
const del = await db.from('games').delete().eq('division_id', division.id).eq('is_playoff', true);
fail('delete prior playoff games', del.error);

// ── generate the double-elim structure + map to game rows ────────────────────
const resolveSeed = (ref: string): string | null => {
  const m = ref.match(/^Seed #(\d+)$/);
  return m ? (seeds[Number(m[1]) - 1]?.id ?? null) : null;
};

const matchups = generateBracket(8, { format: 'double', grandFinalReset: true });
const bracketId = randomUUID();
const gameDate = tour.end_date || tour.start_date || new Date().toISOString().split('T')[0];
// Spread times a little by round-section so the meta strip looks natural.
const timeFor = (code: string): string => {
  if (/^WB1/i.test(code)) return '09:00:00';
  if (/^WB2/i.test(code)) return '11:00:00';
  if (/^WB/i.test(code))  return '13:00:00';
  if (/^LB/i.test(code))  return '12:00:00';
  if (/^GF2/i.test(code)) return '17:00:00';
  return '15:00:00'; // GF
};

const rows = matchups.map(m => ({
  id: randomUUID(),
  tournament_id: tour.id,
  division_id: division.id,
  home_team_id: resolveSeed(m.home),
  away_team_id: resolveSeed(m.away),
  game_date: gameDate,
  game_time: timeFor(m.code),
  location: 'TBD',
  status: 'scheduled',
  is_playoff: true,
  bracket_id: bracketId,
  bracket_code: m.code,
  home_placeholder: m.home,
  away_placeholder: m.away,
}));

fail('insert bracket games', (await db.from('games').insert(rows)).error);

// ── mark the division format as double elimination (badge correctness) ───────
const pc = { ...(division.playoff_config ?? {}), type: 'double', format: 'double', grandFinalReset: true, teamsQualifying: 8 };
fail('update division format', (await db.from('divisions').update({ playoff_config: pc }).eq('id', division.id)).error);

// ── report ───────────────────────────────────────────────────────────────────
const wb = rows.filter(r => /^WB/i.test(r.bracket_code)).length;
const lb = rows.filter(r => /^LB/i.test(r.bracket_code)).length;
const gf = rows.filter(r => /^GF/i.test(r.bracket_code)).length;
console.log(`\n✅ Seeded ${rows.length} pre-play double-elim games (WB ${wb} · LB ${lb} · GF ${gf}) on bracket ${bracketId.slice(0, 8)}`);
console.log(`   All status=scheduled, no scores → draw-day reveal will fire.`);
console.log(`\n   View: /${ORG_SLUG}/${TOUR_SLUG}/schedule  → switch to the Playoffs stage, U15 division`);
console.log(`   (Reveal plays once per browser session per tournament — clear sessionStorage key`);
console.log(`    "bracket-reveal-${tour.id}" or use a fresh/incognito tab to replay.)`);
