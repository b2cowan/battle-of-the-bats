/**
 * Seed a 2-pool division ("U18") on branded-light with COMPLETED round-robin pool
 * play, so the organizer can open the Playoff Wizard, choose "Each pool runs its
 * own bracket" (crossover = none) + Double Elimination, and generate a per-pool
 * double-elim bracket against real, settled standings.
 *
 * - 2 pools ("Pool A", "Pool B"), 4 accepted teams each (8 total).
 * - Full round robin per pool (6 games each = 12), all COMPLETED with clean,
 *   tie-free scores so each pool ranks unambiguously 1 > 2 > 3 > 4.
 * - playoff_config.crossover = 'none' so the wizard defaults to split mode.
 * - No playoff games are created — that's what the wizard is for.
 *
 * NOTE: because pool play is already complete, after generating the bracket the
 * round-1 "Nth Pool X" slots only resolve to real teams when advancePlayoffs next
 * fires. The simplest trigger is to re-save any one completed pool game in the
 * admin schedule (open it, Save) — that re-runs seed resolution and fills round 1.
 *
 * Idempotent: re-running wipes and recreates the U18 division.
 * Run: node --experimental-strip-types --env-file=.env.local scripts/seed-bl-u18-splitpool.mts
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const TOUR_SLUG = 'branded-light';
const DIV_NAME = 'U18';
const POOLS = [
  { name: 'Pool A', teams: ['Falcons', 'Hawks', 'Eagles', 'Ospreys'] },        // ranked best→worst
  { name: 'Pool B', teams: ['Sharks', 'Marlins', 'Stingrays', 'Barracudas'] },
];

function fail(label: string, error: { message: string } | null) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── locate org + tournament ──────────────────────────────────────────────────
const { data: orgs } = await db.from('organizations').select('id').eq('slug', ORG_SLUG);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.error(`org ${ORG_SLUG} not found`); process.exit(1); }

const { data: tours } = await db.from('tournaments').select('id,name,slug,start_date,end_date').eq('org_id', orgId).eq('slug', TOUR_SLUG);
const tour = tours?.[0];
if (!tour) { console.error(`tournament ${TOUR_SLUG} not found`); process.exit(1); }

// ── wipe prior U18 (idempotent) ──────────────────────────────────────────────
const { data: oldDivs } = await db.from('divisions').select('id').eq('tournament_id', tour.id).eq('name', DIV_NAME);
for (const d of oldDivs ?? []) {
  await db.from('games').delete().eq('division_id', d.id);
  await db.from('teams').delete().eq('division_id', d.id);
  await db.from('pools').delete().eq('division_id', d.id);
  await db.from('divisions').delete().eq('id', d.id);
  console.log(`Wiped prior ${DIV_NAME} division ${d.id}`);
}

// ── division (crossover = none → split-pool default) ─────────────────────────
const { data: sibDivs } = await db.from('divisions').select('display_order').eq('tournament_id', tour.id);
const nextOrder = (sibDivs ?? []).reduce((m, d) => Math.max(m, d.display_order ?? 0), 0) + 1;
const divId = randomUUID();
fail('create division', (await db.from('divisions').insert({
  id: divId,
  tournament_id: tour.id,
  name: DIV_NAME,
  display_order: nextOrder,
  capacity: 8,
  pool_count: 2,
  requires_pool_selection: true,
  is_closed: false,
  schedule_visibility: 'published_teams',
  playoff_config: { type: 'single', format: 'single', crossover: 'none', teamsQualifying: 4, hasThirdPlace: false, tieBreakers: ['h2h', 'rd', 'rf', 'ra'] },
}).select().single()).error);

// ── pools + teams ─────────────────────────────────────────────────────────────
const now = new Date().toISOString();
const poolTeams: { poolName: string; teamIds: string[] }[] = [];
for (let pi = 0; pi < POOLS.length; pi++) {
  const pool = POOLS[pi];
  const poolId = randomUUID();
  fail('create pool', (await db.from('pools').insert({ id: poolId, division_id: divId, name: pool.name, display_order: pi, settings: {} })).error);

  const teamRows = pool.teams.map((name, i) => ({
    id: randomUUID(),
    tournament_id: tour.id,
    division_id: divId,
    pool_id: poolId,
    name,
    coach: `Coach ${name}`,
    email: `coach.${name.toLowerCase()}@example.com`,
    status: 'accepted',
    payment_status: 'paid',
    registered_at: new Date(Date.parse(now) - (8 - (pi * 4 + i)) * 60_000).toISOString(),
  }));
  fail('insert teams', (await db.from('teams').insert(teamRows)).error);
  poolTeams.push({ poolName: pool.name, teamIds: teamRows.map(t => t.id) });
}

// ── completed round-robin pool play (clean, tie-free standings) ───────────────
// For every pair (i<j) in a pool, the better-ranked team (lower index) wins, so
// each pool ranks unambiguously 1 > 2 > 3 > 4 by wins.
const gameDate = tour.start_date || now.split('T')[0];
const TIMES = ['09:00:00', '10:45:00', '12:30:00', '14:15:00', '16:00:00', '17:45:00'];
const gameRows: Record<string, unknown>[] = [];
for (const { teamIds } of poolTeams) {
  let slot = 0;
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      // better team (i) wins; spread the margin a little for natural-looking RD
      const homeScore = 5 + (j - i);   // 6..8
      const awayScore = 1 + i;          // 1..3, always < homeScore
      gameRows.push({
        id: randomUUID(),
        tournament_id: tour.id,
        division_id: divId,
        home_team_id: teamIds[i],
        away_team_id: teamIds[j],
        game_date: gameDate,
        game_time: TIMES[slot % TIMES.length],
        location: 'Field 1',
        status: 'completed',
        is_playoff: false,
        home_score: homeScore,
        away_score: awayScore,
        score_submitted_at: now,
        score_submission_source: 'admin_results',
      });
      slot++;
    }
  }
}
fail('insert pool games', (await db.from('games').insert(gameRows)).error);

console.log(`\n✅ Seeded "${DIV_NAME}" — 2 pools × 4 teams, ${gameRows.length} completed pool games (clean standings).`);
console.log(`   Pool A: ${POOLS[0].teams.join(' > ')}`);
console.log(`   Pool B: ${POOLS[1].teams.join(' > ')}`);
console.log(`\n   Admin: open ${DIV_NAME} → Schedule → Playoff Bracket Builder`);
console.log(`     → "Each pool runs its own bracket" is the default (crossover=none)`);
console.log(`     → pick Double Elimination → Generate`);
console.log(`   After generating, re-save ANY completed pool game (open it, Save) to fill round-1 seeds.`);
console.log(`   Public: /${ORG_SLUG}/${TOUR_SLUG}/schedule → Playoffs stage → ${DIV_NAME}`);
