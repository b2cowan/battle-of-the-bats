/**
 * Seed a deterministic fixture for FP-2 Phase E browser tests 1 + 2:
 *
 *   TEST 1 — Standings consistency (J6-032): a single-group division with TWO
 *   teams tied on points, decided by HEAD-TO-HEAD, where run-differential points
 *   the OTHER way. This is exactly the case the old code got wrong (the Teams
 *   cards / team profile ranked by run-diff while the table ranked by H2H). After
 *   the fix every surface must agree.
 *
 *     Aces   2-1, 4 pts, RD −4   ← beat Bolts head-to-head (3–2)
 *     Bolts  2-1, 4 pts, RD +15
 *     Comets 1-2, 2 pts, RD −9   ← beat Dragons head-to-head (3–2)
 *     Dragons1-2, 2 pts, RD −2
 *
 *   Canonical order (H2H first): Aces, Bolts, Comets, Dragons.
 *   Naive order (points→run-diff): Bolts, Aces, Dragons, Comets  ← the OLD bug.
 *   PASS = card rank == profile rank == standings-table rank == canonical order.
 *
 *   TEST 2 — Game-day announcement banner (J6-033): the tournament is UNDERWAY
 *   today and carries a PINNED announcement, so a banner shows atop the schedule.
 *
 * Idempotent: re-running wipes + recreates the `fan-qa-standings` tournament.
 * Run: node --env-file=.env.local scripts/seed-fan-qa-standings.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SOURCE_SLUG = 'dev-tournament-2026';
const SLUG = 'fan-qa-standings';
const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().split('T')[0];
const todayISO = isoDate(new Date());

async function chk(label, { error }) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── locate org + a source tournament to borrow column shapes from ─────────────
const { data: orgs } = await db.from('organizations').select('id').eq('slug', ORG_SLUG);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.error(`org ${ORG_SLUG} not found`); process.exit(1); }

const { data: srcTours } = await db.from('tournaments').select('*').eq('org_id', orgId).eq('slug', SOURCE_SLUG);
const srcT = srcTours?.[0];
if (!srcT) { console.error(`source tournament ${SOURCE_SLUG} not found`); process.exit(1); }

const { data: srcDivs } = await db.from('divisions').select('*').eq('tournament_id', srcT.id);
const { data: srcTeams } = await db.from('teams').select('*').eq('tournament_id', srcT.id);
const { data: srcGames } = await db.from('games').select('*').eq('tournament_id', srcT.id).limit(1);
if (!srcDivs?.length || (srcTeams?.length ?? 0) < 4 || !srcGames?.length) {
  console.error('source tournament lacks a division / 4 teams / a game template'); process.exit(1);
}
const divTemplate = srcDivs[0];
const teamTemplate = srcTeams.slice(0, 4);
const gameTemplate = srcGames[0];

// ── wipe any existing fan-qa-standings ────────────────────────────────────────
const { data: existing } = await db.from('tournaments').select('id').eq('org_id', orgId).eq('slug', SLUG);
if (existing?.length) {
  const oldId = existing[0].id;
  const { data: oldDivs } = await db.from('divisions').select('id').eq('tournament_id', oldId);
  await db.from('games').delete().eq('tournament_id', oldId);
  await db.from('announcements').delete().eq('tournament_id', oldId);
  await db.from('teams').delete().eq('tournament_id', oldId);
  if (oldDivs?.length) await db.from('pools').delete().in('division_id', oldDivs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', oldId);
  await db.from('tournaments').delete().eq('id', oldId);
}

// ── tournament: underway today, finalization off, default (H2H-first) tie-breakers ──
const newTid = randomUUID();
const newT = {
  ...srcT,
  id: newTid,
  slug: SLUG,
  name: 'Fan QA — Standings & Announcement',
  status: 'active',
  is_active: false,
  // ±1 day so the event is unambiguously "in progress" in the org timezone today
  // (the announcement banner is game-day-gated), regardless of the UTC/Eastern boundary.
  start_date: isoDate(new Date(Date.now() - DAY)),
  end_date: isoDate(new Date(Date.now() + DAY)),
  require_score_finalization: false,
  // Force the canonical default order (head-to-head first) and remove any run-diff
  // cap so the displayed RD matches the numbers in this script's comments.
  settings: { ...(srcT.settings ?? {}), tie_breakers: ['h2h', 'rd', 'rf', 'ra'], max_run_diff_per_game: null },
};
delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
await chk('insert tournament', await db.from('tournaments').insert(newT));

// ── one single-group division (no pools), publicly published with real names ──
const newDivId = randomUUID();
const newDiv = {
  ...divTemplate,
  id: newDivId,
  tournament_id: newTid,
  name: 'U12 Showcase',
  schedule_visibility: 'published', // two-state (mig 129): real names public
  playoff_config: null, // defer to the tournament's tie-breaker settings
};
delete newDiv.created_at;
await chk('insert division', await db.from('divisions').insert(newDiv));

// ── four teams in one group ───────────────────────────────────────────────────
const NAMES = ['Aces', 'Bolts', 'Comets', 'Dragons'];
const teamId = {};
for (let i = 0; i < 4; i++) {
  const id = randomUUID();
  teamId[NAMES[i]] = id;
  const row = {
    ...teamTemplate[i],
    id,
    tournament_id: newTid,
    division_id: newDivId,
    pool_id: null,
    name: NAMES[i],
    status: 'accepted',
    seed: i + 1,
  };
  delete row.created_at;
  await chk(`insert team ${NAMES[i]}`, await db.from('teams').insert(row));
}

// ── six completed round-robin games (home, away, homeScore, awayScore) ────────
// Aces & Bolts tie at 4 pts (Aces win H2H, Bolts win on RD); Comets & Dragons tie
// at 2 pts (Comets win H2H, Dragons win on RD).
const GAMES = [
  { home: 'Aces',   away: 'Bolts',   hs: 3, as: 2, time: '09:00:00' }, // Aces beat Bolts (H2H)
  { home: 'Aces',   away: 'Comets',  hs: 1, as: 0, time: '10:30:00' },
  { home: 'Dragons',away: 'Aces',    hs: 6, as: 0, time: '12:00:00' },
  { home: 'Bolts',  away: 'Comets',  hs: 9, as: 0, time: '13:30:00' },
  { home: 'Bolts',  away: 'Dragons', hs: 7, as: 0, time: '15:00:00' },
  { home: 'Comets', away: 'Dragons', hs: 3, as: 2, time: '16:30:00' }, // Comets beat Dragons (H2H)
];
const nowISO = new Date().toISOString();
for (const g of GAMES) {
  const row = {
    ...gameTemplate,
    id: randomUUID(),
    tournament_id: newTid,
    division_id: newDivId,
    home_team_id: teamId[g.home],
    away_team_id: teamId[g.away],
    home_placeholder: null,
    away_placeholder: null,
    game_date: todayISO,
    game_time: g.time,
    home_score: g.hs,
    away_score: g.as,
    status: 'completed',
    is_playoff: false,
    bracket_code: null,
    score_submission_source: 'admin_results',
    score_submitted_at: nowISO,
    score_submitted_by_user_id: null,
    score_submitted_by_email: null,
    diamond_id: null,
    venue_facility_id: null,
    schedule_facility_lane_id: null,
    home_slot_id: null,
    away_slot_id: null,
  };
  delete row.created_at;
  await chk(`insert game ${g.home} v ${g.away}`, await db.from('games').insert(row));
}

// ── pinned announcement (drives the schedule banner — TEST 2) ─────────────────
await chk('insert announcement', await db.from('announcements').insert({
  tournament_id: newTid,
  title: '⛈ Rain delay — Diamond 3',
  body: 'Diamond 3 games are pushed 30 minutes while the grounds crew clears standing water. Diamonds 1 and 2 are on schedule. Watch here for updates.',
  published_at: nowISO,
  pinned: true,
  channel_site: true,
  division_ids: null,
}));

console.log(`\n✅ Seeded ${SLUG} on ${ORG_SLUG} (underway today, no migrations).`);
console.log(`\n   TEST 1 — Standings consistency (division "U12 Showcase"):`);
console.log(`     Canonical order MUST be: 1 Aces · 2 Bolts · 3 Comets · 4 Dragons`);
console.log(`     (Aces tie Bolts on 4 pts but won head-to-head 3–2, despite Bolts' far better run-diff.)`);
console.log(`     Check the same order on:  /${ORG_SLUG}/${SLUG}/standings  ·  /${ORG_SLUG}/${SLUG}/teams  ·  each team's profile`);
console.log(`\n   TEST 2 — Announcement banner:`);
console.log(`     A pinned "Rain delay" banner should appear atop  /${ORG_SLUG}/${SLUG}/schedule`);
console.log('');
