/**
 * Seed a live, game-day demo tournament into dev-test-org by cloning the existing
 * `dev-tournament-2026` (full pool schedule + single-elim bracket) into the
 * `live-demo` slug and shifting all dates so the tournament's FINAL (playoff) day
 * lands on TODAY. The round robin is scored to completion, standings are final,
 * and the playoff bracket is auto-seeded from those standings — but no playoff
 * game has started yet. This is the "round robin done, bracket set, playoffs about
 * to begin" moment, so the public bracket shows the real semifinal matchups (the
 * Final still reads "Winner of …"), standings are fully populated, and every
 * playoff game sits Scheduled with no score.
 *
 * How the state is built (mirrors production exactly):
 *   - Round-robin games → completed with deterministic, transitive scores so each
 *     division has a clean, unambiguous standings order (distinct point totals).
 *   - Playoff seeds are resolved with the SAME engine the app uses
 *     (computeTournamentStandings) and written onto the first-round games, exactly
 *     like resolveAndFillPlayoffSeeds does when the last pool game is scored.
 *   - Later-round games keep their "Winner <code>" placeholders (unresolved until
 *     the semifinals are played).
 *   - In a bracket division, an accepted team that plays ZERO round-robin games
 *     (leftover/unscheduled) is demoted to waitlist in the clone so it can't be
 *     seeded into the bracket ahead of a team that actually played.
 *
 * Idempotent: re-running wipes and recreates the `live-demo` tournament.
 *
 * Run: node --env-file=.env.local scripts/seed-live-tournament.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { computeTournamentStandings } from '../lib/tie-breakers.ts';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SOURCE_SLUG = 'dev-tournament-2026';
const NEW_SLUG = 'live-demo';
const NEW_NAME = 'Live Demo — Game Day';

const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().split('T')[0];
const todayISO = isoDate(new Date());
const nowISO = new Date().toISOString();
const shiftDate = (s, delta) => (s ? isoDate(new Date(Date.parse(s) + delta * DAY)) : null);

// Per-division "strength" so the stronger side always wins → strict transitive
// order → distinct records (3-0 / 2-1 / 1-2 / 0-3) → unambiguous seeding.
// Names below set the seed order in each division's bracket (highest = #1 seed).
const STRENGTH = {
  // U11 (the published division with the playoff bracket)
  'Halton Hawks U11 Jr (Johnstone)': 4,
  'Lions U11': 3,
  'Milton Bats U11 Purple (Jackson)': 2,
  'Bears U11': 1,
  // U13 (round robin only — no bracket)
  'Eagles U13': 4,
  'Hawks U13': 3,
  'Lions U13': 2,
  'Bears U13': 1,
};

// Deterministic final score: stronger side wins by a strength-scaled margin.
function scoreFor(sH, sA) {
  if (sH === sA) return { home_score: 5, away_score: 5 };
  const diff = Math.min(Math.abs(sH - sA), 5);
  const win = 4 + diff;                                 // 5..9
  const lose = Math.max(1, 4 - Math.floor(diff / 2));  // 1..3
  return sH > sA ? { home_score: win, away_score: lose } : { home_score: lose, away_score: win };
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
const { data: srcDiamonds } = await db.from('diamonds').select('*').eq('tournament_id', srcT.id);
const srcDiamondIds = (srcDiamonds ?? []).map(d => d.id);
const { data: srcFacilities } = srcDiamondIds.length
  ? await db.from('venue_facilities').select('*').in('venue_id', srcDiamondIds)
  : { data: [] };
console.log(`Source: ${srcDivs.length} divisions, ${srcPools.length} pools, ${srcTeams.length} teams, ${srcGames.length} games, ${(srcDiamonds ?? []).length} venues, ${(srcFacilities ?? []).length} facilities`);

// ── wipe any prior live-demo (idempotent) ────────────────────────────────────
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
  console.log('Wiped prior live-demo tournament.');
}

// ── date shift: source FINAL day (end) → today ───────────────────────────────
// Playoffs live on the source's last day, so aligning end_date to today puts the
// whole round robin in the past/earlier-today and the bracket games on today.
const deltaDays = Math.round((Date.parse(todayISO) - Date.parse(srcT.end_date)) / DAY);
const newStartISO = shiftDate(srcT.start_date, deltaDays);
console.log(`Shifting dates by ${deltaDays} days → ${newStartISO} … ${todayISO} (final/playoff day = today)`);

// ── tournament ───────────────────────────────────────────────────────────────
const newTid = randomUUID();
const newT = { ...srcT,
  id: newTid, slug: NEW_SLUG, name: NEW_NAME,
  status: 'active', is_active: false,   // is_active stays false so dev-tournament-2026 keeps the org's active flag
  start_date: newStartISO, end_date: todayISO,
  // The QA matrix walks /discover too — the source tournament is draft/unlisted,
  // so force the directory opt-in or every re-seed drops live-demo off Discover.
  list_in_directory: true, directory_province: srcT.directory_province ?? 'ON',
};
delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
await chk('insert tournament', await db.from('tournaments').insert(newT));

// ── divisions (clone, keep source visibility) ─────────────────────────────────
const divMap = {};
const divCfgByNew = {};   // newDivId → playoff_config (camelCase tieBreakers etc.)
const divHasPlayoff = {}; // newDivId → bool (does the source division have bracket games?)
for (const d of srcDivs) {
  const nid = randomUUID(); divMap[d.id] = nid;
  divCfgByNew[nid] = d.playoff_config || undefined;
  divHasPlayoff[nid] = srcGames.some(g => g.division_id === d.id && g.is_playoff);
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
// Teams that appear in at least one round-robin game (so we can spot accepted-but-
// gameless teams sitting in a bracket division).
const playsRR = new Set();
for (const g of srcGames) {
  if (g.is_playoff) continue;
  if (g.home_team_id) playsRR.add(g.home_team_id);
  if (g.away_team_id) playsRR.add(g.away_team_id);
}

const teamMap = {};
const domainTeams = [];   // for computeTournamentStandings
let demotedCount = 0;
for (const t of srcTeams) {
  const nid = randomUUID(); teamMap[t.id] = nid;
  const newDiv = divMap[t.division_id];
  // In a bracket division, an accepted team that never plays can't be meaningfully
  // seeded — demote to waitlist so it stays out of the bracket (and standings).
  let status = t.status;
  if (status === 'accepted' && divHasPlayoff[newDiv] && !playsRR.has(t.id)) {
    status = 'waitlist'; demotedCount++;
  }
  const row = { ...t, id: nid, tournament_id: newTid, division_id: newDiv, status,
    pool_id: t.pool_id ? poolMap[t.pool_id] ?? null : null };
  await chk('insert team', await db.from('teams').insert(row));
  domainTeams.push({ id: nid, name: t.name, divisionId: newDiv, status, poolId: row.pool_id });
}

// ── venues (diamonds) + facilities ────────────────────────────────────────────
// Clone the source tournament's venues so games stay LINKED (production never
// stores free-text venues — they always reference the venues table).
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

const strengthOf = (teamId) => STRENGTH[srcTeams.find(t => teamMap[t.id] === teamId)?.name] ?? 0;

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

// ── round-robin games → completed (scored) ────────────────────────────────────
const FINAL = { status: 'completed', score_submission_source: 'admin_results', score_submitted_at: nowISO };
const rrRows = [];
const domainGames = []; // for computeTournamentStandings
const playoffSrc = [];
for (const g of srcGames) {
  if (g.is_playoff) { playoffSrc.push(g); continue; }
  const row = baseRow(g);
  if (row.home_team_id && row.away_team_id) {
    Object.assign(row, scoreFor(strengthOf(row.home_team_id), strengthOf(row.away_team_id)), FINAL);
    domainGames.push({
      id: row.id, divisionId: row.division_id,
      homeTeamId: row.home_team_id, awayTeamId: row.away_team_id,
      homeScore: row.home_score, awayScore: row.away_score,
      status: 'completed', isPlayoff: false,
    });
  }
  rrRows.push(row);
}

// ── playoff games → seeded but NOT started ────────────────────────────────────
// Resolve "Seed #N" / "Nth Pool X" placeholders against final standings with the
// SAME engine the app uses, and write them onto the first-round games. Keep the
// games Scheduled with no score; "Winner <code>" placeholders stay unresolved.
const seedsByDiv = {};
const resolvePlaceholder = (ph, divId) => {
  if (!ph) return null;
  if (!seedsByDiv[divId]) {
    seedsByDiv[divId] = computeTournamentStandings(divId, domainTeams, domainGames, divCfgByNew[divId], srcT.settings);
  }
  const standings = seedsByDiv[divId];
  if (ph.startsWith('Seed #')) {
    const rank = parseInt(ph.replace('Seed #', ''), 10);
    return standings[rank - 1]?.teamId ?? null;
  }
  const m = ph.match(/(\d+)\w+ Pool (.+)/);
  if (m) {
    const rank = parseInt(m[1], 10);
    const poolName = m[2];
    const pool = srcPools.map(p => ({ name: p.name, id: poolMap[p.id] })).find(p => p.name === poolName);
    const poolStandings = standings.filter(s => s.poolId === pool?.id);
    return poolStandings[rank - 1]?.teamId ?? null;
  }
  return null; // Winner/Loser refs stay unresolved until the feeder is played
};

const playoffRows = [];
let seededSlots = 0;
for (const g of playoffSrc) {
  const row = baseRow(g);                       // status stays 'scheduled', no score
  const newDiv = row.division_id;
  const hId = resolvePlaceholder(row.home_placeholder, newDiv);
  const aId = resolvePlaceholder(row.away_placeholder, newDiv);
  if (hId) { row.home_team_id = hId; seededSlots++; }
  if (aId) { row.away_team_id = aId; seededSlots++; }
  playoffRows.push(row);
}

// ── insert all games ──────────────────────────────────────────────────────────
let rrFinal = 0;
for (const row of rrRows) { if (row.home_score != null) rrFinal++; await chk('insert RR game', await db.from('games').insert(row)); }
for (const row of playoffRows) { await chk('insert playoff game', await db.from('games').insert(row)); }

// ── report ────────────────────────────────────────────────────────────────────
const teamName = (id) => srcTeams.find(t => teamMap[t.id] === id)?.name ?? '—';
console.log(`\n✅ Seeded "${NEW_NAME}" (status=active, live today)`);
console.log(`   ${srcDivs.length} divisions · ${srcTeams.length} teams · ${rrRows.length + playoffRows.length} games`);
console.log(`   Window: ${newStartISO} → ${todayISO} (final/playoff day = today)`);
console.log(`   Round robin: ${rrFinal}/${rrRows.length} games final (complete)`);
console.log(`   Playoffs: ${playoffRows.length} games scheduled, ${seededSlots} seed slots filled, 0 started`);
if (demotedCount) console.log(`   (${demotedCount} accepted-but-gameless team(s) demoted to waitlist so the bracket seeds cleanly)`);
for (const [divId, standings] of Object.entries(seedsByDiv)) {
  const divName = srcDivs.find(d => divMap[d.id] === divId)?.name ?? '?';
  console.log(`\n   ${divName} final standings → seeds:`);
  standings.forEach((s, i) => console.log(`     #${i + 1} ${s.teamName}  (${s.w}-${s.l}${s.t ? '-' + s.t : ''}, ${s.pts} pts, RD ${s.rd >= 0 ? '+' : ''}${s.rd})`));
  console.log(`   ${divName} bracket:`);
  for (const row of playoffRows.filter(p => p.division_id === divId).sort((a, b) => (a.game_date + a.game_time).localeCompare(b.game_date + b.game_time))) {
    const h = row.home_team_id ? teamName(row.home_team_id) : row.home_placeholder;
    const a = row.away_team_id ? teamName(row.away_team_id) : row.away_placeholder;
    console.log(`     ${row.bracket_code}: ${h}  vs  ${a}`);
  }
}
console.log(`\n   Public:  /${ORG_SLUG}/${NEW_SLUG}/standings · /${NEW_SLUG}/schedule · /${NEW_SLUG}/bracket`);
console.log(`   Admin:   /${ORG_SLUG}/admin/tournaments/dashboard (switch to "${NEW_NAME}")`);
