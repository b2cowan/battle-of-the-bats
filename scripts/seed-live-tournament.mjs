/**
 * Seed a live, game-day demo tournament into dev-test-org by cloning the existing
 * `dev-tournament-2026` (full pool schedule + single-elim bracket), shifting all
 * dates so day 1 = today, and posting scores (one final + two LIVE) so the
 * My-Team dock, broadcast cards, odometer, and standings all have something to show.
 *
 * Idempotent: re-running wipes and recreates the `live-demo` tournament.
 *
 * Run: node --env-file=.env.local scripts/seed-live-tournament.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SOURCE_SLUG = 'dev-tournament-2026';
const NEW_SLUG = 'live-demo';
const NEW_NAME = 'Live Demo — Game Day';

const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().split('T')[0];
const todayISO = isoDate(new Date());

function shiftDate(dateStr, deltaDays) {
  if (!dateStr) return null;
  return isoDate(new Date(Date.parse(dateStr) + deltaDays * DAY));
}

async function chk(label, { error }) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── locate org + source ──────────────────────────────────────────────────────
const { data: orgs } = await db.from('organizations').select('id').eq('slug', ORG_SLUG);
const orgId = orgs?.[0]?.id;
if (!orgId) { console.error('org dev-test-org not found'); process.exit(1); }

const { data: srcTours } = await db.from('tournaments').select('*').eq('org_id', orgId).eq('slug', SOURCE_SLUG);
const srcT = srcTours?.[0];
if (!srcT) { console.error('source tournament not found'); process.exit(1); }

const { data: srcDivs }  = await db.from('divisions').select('*').eq('tournament_id', srcT.id);
const { data: srcPools } = await db.from('pools').select('*').in('division_id', srcDivs.map(d => d.id));
const { data: srcTeams } = await db.from('teams').select('*').eq('tournament_id', srcT.id);
const { data: srcGames } = await db.from('games').select('*').eq('tournament_id', srcT.id);
console.log(`Source: ${srcDivs.length} divisions, ${srcPools.length} pools, ${srcTeams.length} teams, ${srcGames.length} games`);

// ── wipe any prior live-demo (idempotent) ────────────────────────────────────
const { data: existing } = await db.from('tournaments').select('id').eq('org_id', orgId).eq('slug', NEW_SLUG);
if (existing?.length) {
  const oldId = existing[0].id;
  const { data: oldDivs } = await db.from('divisions').select('id').eq('tournament_id', oldId);
  await db.from('games').delete().eq('tournament_id', oldId);
  await db.from('teams').delete().eq('tournament_id', oldId);
  if (oldDivs?.length) await db.from('pools').delete().in('division_id', oldDivs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', oldId);
  await db.from('tournaments').delete().eq('id', oldId);
  console.log('Wiped prior live-demo tournament.');
}

// ── date shift: source start → today (day 1) ─────────────────────────────────
const deltaDays = Math.round((Date.parse(todayISO) - Date.parse(srcT.start_date)) / DAY);
console.log(`Shifting dates by ${deltaDays} days → day 1 = ${todayISO}`);

// ── tournament ───────────────────────────────────────────────────────────────
const newTid = randomUUID();
const newT = { ...srcT,
  id: newTid, slug: NEW_SLUG, name: NEW_NAME,
  status: 'active', is_active: false,   // is_active stays false so dev-tournament-2026 keeps the org's active flag
  start_date: todayISO, end_date: shiftDate(srcT.end_date, deltaDays),
};
delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
await chk('insert tournament', await db.from('tournaments').insert(newT));

// ── divisions ─────────────────────────────────────────────────────────────────
const divMap = {};
for (const d of srcDivs) {
  const nid = randomUUID(); divMap[d.id] = nid;
  const row = { ...d, id: nid, tournament_id: newTid }; delete row.created_at;
  await chk('insert division', await db.from('divisions').insert(row));
}

// ── pools ─────────────────────────────────────────────────────────────────────
const poolMap = {};
for (const p of srcPools) {
  const nid = randomUUID(); poolMap[p.id] = nid;
  const row = { ...p, id: nid, division_id: divMap[p.division_id] }; delete row.created_at;
  await chk('insert pool', await db.from('pools').insert(row));
}

// ── teams ─────────────────────────────────────────────────────────────────────
const teamMap = {};
for (const t of srcTeams) {
  const nid = randomUUID(); teamMap[t.id] = nid;
  const row = { ...t, id: nid, tournament_id: newTid, division_id: divMap[t.division_id], pool_id: t.pool_id ? poolMap[t.pool_id] ?? null : null };
  await chk('insert team', await db.from('teams').insert(row));
}
const divNameById = Object.fromEntries(srcDivs.map(d => [d.id, d.name]));

// ── scoring rules for day-1 (today) U11 games ────────────────────────────────
const now = new Date().toISOString();
function liveScore(srcGame, isDay1) {
  const divName = divNameById[srcGame.division_id] ?? '';
  if (!isDay1 || srcGame.is_playoff || divName !== 'U11') return null;
  if (srcGame.status === 'completed') return null;          // keep source final + its scores
  if (srcGame.game_time === '12:30:00') return { status: 'submitted', away_score: 2, home_score: 4 };  // LIVE
  if (srcGame.game_time === '14:15:00') return { status: 'submitted', away_score: 1, home_score: 1 };  // LIVE (tied)
  return null;                                              // stays scheduled
}

// ── games ─────────────────────────────────────────────────────────────────────
let liveCount = 0, finalCount = 0;
for (const g of srcGames) {
  const newDate = shiftDate(g.game_date, deltaDays);
  const isDay1 = newDate === todayISO;
  const row = { ...g,
    id: randomUUID(), tournament_id: newTid,
    division_id: divMap[g.division_id],
    home_team_id: g.home_team_id ? teamMap[g.home_team_id] ?? null : null,
    away_team_id: g.away_team_id ? teamMap[g.away_team_id] ?? null : null,
    game_date: newDate,
    // Drop venue/slot FKs (point at source-scoped rows); keep the display text.
    diamond_id: null, venue_facility_id: null, schedule_facility_lane_id: null,
    home_slot_id: null, away_slot_id: null,
    score_submitted_by_user_id: null, score_submitted_by_email: null,
  };
  const live = liveScore(g, isDay1);
  if (live) {
    Object.assign(row, live, { score_submitted_at: now, score_submission_source: 'admin_results' });
    liveCount++;
  }
  if (row.status === 'completed' && row.home_score != null) finalCount++;
  await chk('insert game', await db.from('games').insert(row));
}

console.log(`\n✅ Seeded "${NEW_NAME}"`);
console.log(`   ${srcDivs.length} divisions · ${srcTeams.length} teams · ${srcGames.length} games`);
console.log(`   Window: ${todayISO} → ${newT.end_date} (status=active, day 1 = today)`);
console.log(`   Day-1 scores: ${finalCount} final, ${liveCount} LIVE (submitted today)`);
console.log(`\n   Public URL:  /${ORG_SLUG}/${NEW_SLUG}/schedule`);
console.log(`   Tip: follow a U11 team (e.g. Halton Hawks U11 or Lions U11) to light up the dock.`);
