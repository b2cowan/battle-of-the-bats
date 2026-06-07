/**
 * Seed a COMPLETED demo tournament into dev-test-org by cloning the existing
 * `dev-tournament-2026`, shifting all dates into the recent past, scoring every
 * round-robin game to a final, and resolving the U11 single-elim bracket to a
 * champion. Lets us test the Dashboard "Completed/wrap-up" view and the public
 * complete-state pages (final standings, champion spotlight, resolved bracket,
 * team final records).
 *
 * Idempotent: re-running wipes and recreates the `completed-demo` tournament.
 *
 * Run: node --env-file=.env.local scripts/seed-completed-tournament.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SOURCE_SLUG = 'dev-tournament-2026';
const NEW_SLUG = 'completed-demo';
const NEW_NAME = 'Completed Demo — Final Results';

const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().split('T')[0];
const todayISO = isoDate(new Date());
const nowISO = new Date().toISOString();
const shiftDate = (s, delta) => (s ? isoDate(new Date(Date.parse(s) + delta * DAY)) : null);

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
const { data: srcDiamonds } = await db.from('diamonds').select('*').eq('tournament_id', srcT.id);
const srcDiamondIds = (srcDiamonds ?? []).map(d => d.id);
const { data: srcFacilities } = srcDiamondIds.length
  ? await db.from('venue_facilities').select('*').in('venue_id', srcDiamondIds)
  : { data: [] };
console.log(`Source: ${srcDivs.length} divisions, ${srcPools.length} pools, ${srcTeams.length} teams, ${srcGames.length} games`);

// ── wipe any prior completed-demo (idempotent) ───────────────────────────────
const { data: existing } = await db.from('tournaments').select('id').eq('org_id', orgId).eq('slug', NEW_SLUG);
if (existing?.length) {
  const oldId = existing[0].id;
  const { data: oldDivs } = await db.from('divisions').select('id').eq('tournament_id', oldId);
  const { data: oldDiamonds } = await db.from('diamonds').select('id').eq('tournament_id', oldId);
  await db.from('games').delete().eq('tournament_id', oldId);
  if (oldDiamonds?.length) await db.from('venue_facilities').delete().in('venue_id', oldDiamonds.map(d => d.id));
  await db.from('diamonds').delete().eq('tournament_id', oldId);
  await db.from('teams').delete().eq('tournament_id', oldId);
  if (oldDivs?.length) await db.from('pools').delete().in('division_id', oldDivs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', oldId);
  await db.from('tournaments').delete().eq('id', oldId);
  console.log('Wiped prior completed-demo tournament.');
}

// ── date shift: event ended 2 days ago (source end → today-2) ────────────────
const newStartISO = isoDate(new Date(Date.parse(todayISO) - 4 * DAY)); // today-4
const deltaDays = Math.round((Date.parse(newStartISO) - Date.parse(srcT.start_date)) / DAY);
const newEndISO = shiftDate(srcT.end_date, deltaDays);
console.log(`Shifting dates by ${deltaDays} days → ${newStartISO} … ${newEndISO} (completed, in the past)`);

// ── tournament (completed) ────────────────────────────────────────────────────
const newTid = randomUUID();
const newT = { ...srcT,
  id: newTid, slug: NEW_SLUG, name: NEW_NAME,
  status: 'completed', is_active: false,
  start_date: newStartISO, end_date: newEndISO,
};
delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
await chk('insert tournament', await db.from('tournaments').insert(newT));

// ── divisions (force published_teams so completed results are publicly visible) ─
const divMap = {};
for (const d of srcDivs) {
  const nid = randomUUID(); divMap[d.id] = nid;
  const row = { ...d, id: nid, tournament_id: newTid, schedule_visibility: 'published_teams' };
  delete row.created_at;
  await chk('insert division', await db.from('divisions').insert(row));
}

// ── pools ─────────────────────────────────────────────────────────────────────
const poolMap = {};
for (const p of srcPools) {
  const nid = randomUUID(); poolMap[p.id] = nid;
  const row = { ...p, id: nid, division_id: divMap[p.division_id] }; delete row.created_at;
  await chk('insert pool', await db.from('pools').insert(row));
}

// ── teams (track per-division order → "strength") ─────────────────────────────
const teamMap = {};
const divTeamOrder = {}; // newDivId → [newTeamId, …] in source order
for (const t of srcTeams) {
  const nid = randomUUID(); teamMap[t.id] = nid;
  const newDiv = divMap[t.division_id];
  (divTeamOrder[newDiv] ??= []).push(nid);
  const row = { ...t, id: nid, tournament_id: newTid, division_id: newDiv, pool_id: t.pool_id ? poolMap[t.pool_id] ?? null : null };
  await chk('insert team', await db.from('teams').insert(row));
}
// strength[newTeamId]: first team in a division is strongest
const strength = {};
for (const ids of Object.values(divTeamOrder)) ids.forEach((id, i) => { strength[id] = ids.length - i; });

// ── venues + facilities ───────────────────────────────────────────────────────
const diamondMap = {};
for (const d of srcDiamonds ?? []) {
  const nid = randomUUID(); diamondMap[d.id] = nid;
  const row = { ...d, id: nid, tournament_id: newTid }; delete row.created_at;
  await chk('insert venue', await db.from('diamonds').insert(row));
}
const facilityMap = {};
for (const f of srcFacilities ?? []) {
  if (!diamondMap[f.venue_id]) continue;
  const nid = randomUUID(); facilityMap[f.id] = nid;
  const row = { ...f, id: nid, tournament_id: newTid, venue_id: diamondMap[f.venue_id] }; delete row.created_at;
  await chk('insert facility', await db.from('venue_facilities').insert(row));
}

// ── build new game rows (remap FKs), split RR vs playoff ──────────────────────
const FINAL = { status: 'completed', score_submission_source: 'admin_results', score_submitted_at: nowISO };
function baseRow(g) {
  return { ...g,
    id: randomUUID(), tournament_id: newTid,
    division_id: divMap[g.division_id],
    home_team_id: g.home_team_id ? teamMap[g.home_team_id] ?? null : null,
    away_team_id: g.away_team_id ? teamMap[g.away_team_id] ?? null : null,
    game_date: shiftDate(g.game_date, deltaDays),
    diamond_id: g.diamond_id ? diamondMap[g.diamond_id] ?? null : null,
    venue_facility_id: g.venue_facility_id ? facilityMap[g.venue_facility_id] ?? null : null,
    schedule_facility_lane_id: null,
    home_slot_id: null, away_slot_id: null,
    score_submitted_by_user_id: null, score_submitted_by_email: null,
  };
}

// deterministic final score: stronger side wins by a strength-scaled margin
function scoreFor(sH, sA) {
  if (sH === sA) return { home_score: 4, away_score: 4 };
  const diff = Math.min(Math.abs(sH - sA), 5);
  const win = 4 + diff;                       // 5..9
  const lose = Math.max(1, 4 - Math.floor(diff / 2)); // 1..3
  return sH > sA ? { home_score: win, away_score: lose } : { home_score: lose, away_score: win };
}

const rrRows = [];
const playoffSrc = [];
for (const g of srcGames) {
  if (g.is_playoff) { playoffSrc.push(g); continue; }
  const row = baseRow(g);
  if (row.home_team_id && row.away_team_id) {
    Object.assign(row, scoreFor(strength[row.home_team_id], strength[row.away_team_id]), FINAL);
  }
  rrRows.push(row);
}

// ── standings per division (from scored RR rows) ──────────────────────────────
function standings(divId) {
  const rec = {};
  for (const id of divTeamOrder[divId] ?? []) rec[id] = { id, w: 0, l: 0, t: 0, rf: 0, ra: 0 };
  for (const g of rrRows) {
    if (g.division_id !== divId || g.home_score == null) continue;
    const h = rec[g.home_team_id], a = rec[g.away_team_id];
    if (!h || !a) continue;
    h.rf += g.home_score; h.ra += g.away_score; a.rf += g.away_score; a.ra += g.home_score;
    if (g.home_score > g.away_score) { h.w++; a.l++; }
    else if (g.home_score < g.away_score) { a.w++; h.l++; }
    else { h.t++; a.t++; }
  }
  return Object.values(rec).sort((x, y) => {
    const px = x.w * 2 + x.t, py = y.w * 2 + y.t;
    if (py !== px) return py - px;
    const dx = x.rf - x.ra, dy = y.rf - y.ra;
    if (dy !== dx) return dy - dx;
    return y.rf - x.rf;
  }).map(r => r.id);
}

// ── resolve playoff bracket(s) ────────────────────────────────────────────────
// Process in date/time order so SF winners are known before the final.
playoffSrc.sort((a, b) => (a.game_date + a.game_time).localeCompare(b.game_date + b.game_time));
const seedsByDiv = {};        // newDivId → [seed1Id, seed2Id, …]
const winners = {};           // bracket_code → winning newTeamId
const playoffRows = [];
let champion = null, championDiv = null;

for (const g of playoffSrc) {
  const newDiv = divMap[g.division_id];
  const seeds = (seedsByDiv[newDiv] ??= standings(newDiv));
  const seedRank = Object.fromEntries(seeds.map((id, i) => [id, i])); // 0 = #1

  const resolveSide = (placeholder) => {
    if (!placeholder) return null;
    const s = placeholder.match(/Seed #(\d+)/i);
    if (s) return seeds[Number(s[1]) - 1] ?? null;
    const w = placeholder.match(/Winner\s+(\S+)/i);
    if (w) return winners[w[1]] ?? null;
    return null;
  };

  const row = baseRow(g);
  const home = resolveSide(g.home_placeholder);
  const away = resolveSide(g.away_placeholder);
  row.home_team_id = home; row.away_team_id = away;
  row.home_placeholder = null; row.away_placeholder = null;

  if (home && away) {
    // higher seed (lower rank index) wins
    const homeWins = (seedRank[home] ?? 99) < (seedRank[away] ?? 99);
    Object.assign(row, homeWins ? { home_score: 6, away_score: 3 } : { home_score: 3, away_score: 6 }, FINAL);
    const winId = homeWins ? home : away;
    if (g.bracket_code) winners[g.bracket_code] = winId;
    champion = winId; championDiv = newDiv;   // last final processed = champion
  }
  playoffRows.push(row);
}

// ── insert all games ──────────────────────────────────────────────────────────
let rrFinal = 0, poFinal = 0;
for (const row of rrRows) { if (row.home_score != null) rrFinal++; await chk('insert RR game', await db.from('games').insert(row)); }
for (const row of playoffRows) { if (row.home_score != null) poFinal++; await chk('insert playoff game', await db.from('games').insert(row)); }

const champName = champion ? (srcTeams.find(t => teamMap[t.id] === champion)?.name ?? '?') : 'n/a';
console.log(`\n✅ Seeded "${NEW_NAME}" (status=completed)`);
console.log(`   ${srcDivs.length} divisions · ${srcTeams.length} teams · ${rrRows.length + playoffRows.length} games`);
console.log(`   Window: ${newStartISO} → ${newEndISO} (ended ${Math.round((Date.parse(todayISO) - Date.parse(newEndISO)) / DAY)} days ago)`);
console.log(`   Finals: ${rrFinal} round-robin scored, ${poFinal}/${playoffRows.length} playoff games resolved`);
console.log(`   🏆 Champion: ${champName}`);
console.log(`\n   Admin dashboard: /${ORG_SLUG}/admin/tournaments/dashboard (switch to "${NEW_NAME}")`);
console.log(`   Public:          /${ORG_SLUG}/${NEW_SLUG}/standings · /schedule · /${NEW_SLUG}`);
