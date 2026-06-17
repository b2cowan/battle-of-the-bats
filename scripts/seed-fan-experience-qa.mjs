/**
 * Seed deterministic fixtures for testing the Public Fan Experience work
 * (one-truth-for-"live", register lockdown, follow dock, share/OG honesty).
 *
 * The new "live" definition is TIME-WINDOW based, so the live games must be
 * anchored to the CURRENT moment — fixed-time seeds only read live by luck.
 * This script clones `dev-tournament-2026` into two events under dev-test-org:
 *
 *   1. `fan-qa`       — UNDERWAY today, score-finalization ON. Day-1 games are
 *                       placed relative to NOW so you always have:
 *                         • a LIVE game WITH a score (started ~25m ago)
 *                         • a LIVE game with NO score yet (started ~8m ago → 0–0)
 *                         • an UNOFFICIAL game (started ~5h ago, score in, window
 *                           passed, finalization required)
 *                         • an UPCOMING game (starts in ~3h)
 *                         • the source's completed games stay FINAL
 *                       Registration is CLOSED here (event underway).
 *
 *   2. `fan-qa-open`  — starts in 14 days, all games scheduled, divisions open +
 *                       uncapped → Registration is OPEN here.
 *
 * For the finale / "registration closed on a completed event" cases, also run
 * `scripts/seed-completed-tournament.mjs` (creates `completed-demo`).
 *
 * Idempotent: re-running wipes and recreates both events.
 *
 * Run: node --env-file=.env.local scripts/seed-fan-experience-qa.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SOURCE_SLUG = 'dev-tournament-2026';
const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().split('T')[0];
const todayISO = isoDate(new Date());

/** Wall-clock { date, time } of an instant in the org timezone (America/Toronto),
 *  matching how the app resolves a game's start when deciding if it's live. */
function torontoWallClock(instant) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(instant);
  const get = (t) => parts.find(p => p.type === t)?.value ?? '';
  let hour = get('hour'); if (hour === '24') hour = '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${hour}:${get('minute')}:${get('second')}` };
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
if (!srcT) { console.error(`source tournament ${SOURCE_SLUG} not found`); process.exit(1); }

const { data: srcDivs }  = await db.from('divisions').select('*').eq('tournament_id', srcT.id);
const { data: srcPools } = await db.from('pools').select('*').in('division_id', srcDivs.map(d => d.id));
const { data: srcTeams } = await db.from('teams').select('*').eq('tournament_id', srcT.id);
const { data: srcGames } = await db.from('games').select('*').eq('tournament_id', srcT.id);
const { data: srcDiamonds } = await db.from('diamonds').select('*').eq('tournament_id', srcT.id);
const srcDiamondIds = (srcDiamonds ?? []).map(d => d.id);
const { data: srcFacilities } = srcDiamondIds.length
  ? await db.from('venue_facilities').select('*').in('venue_id', srcDiamondIds)
  : { data: [] };
const divNameById = Object.fromEntries(srcDivs.map(d => [d.id, d.name]));

async function wipe(slug) {
  const { data: existing } = await db.from('tournaments').select('id').eq('org_id', orgId).eq('slug', slug);
  if (!existing?.length) return;
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
}

async function clone({ slug, name, startISO, requireFinalization, gameTransform, divisionTransform }) {
  await wipe(slug);
  const deltaDays = Math.round((Date.parse(startISO) - Date.parse(srcT.start_date)) / DAY);
  const newTid = randomUUID();
  const newT = {
    ...srcT, id: newTid, slug, name,
    status: 'active', is_active: false,
    start_date: startISO, end_date: (srcT.end_date ? isoDate(new Date(Date.parse(srcT.end_date) + deltaDays * DAY)) : startISO),
    require_score_finalization: requireFinalization,
  };
  delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
  await chk(`insert tournament ${slug}`, await db.from('tournaments').insert(newT));

  const divMap = {};
  for (const d of srcDivs) {
    const nid = randomUUID(); divMap[d.id] = nid;
    const row = { ...d, id: nid, tournament_id: newTid }; delete row.created_at;
    if (divisionTransform) divisionTransform(row);
    await chk('insert division', await db.from('divisions').insert(row));
  }
  const poolMap = {};
  for (const p of srcPools) {
    const nid = randomUUID(); poolMap[p.id] = nid;
    const row = { ...p, id: nid, division_id: divMap[p.division_id] }; delete row.created_at;
    await chk('insert pool', await db.from('pools').insert(row));
  }
  const teamMap = {};
  for (const t of srcTeams) {
    const nid = randomUUID(); teamMap[t.id] = nid;
    const row = { ...t, id: nid, tournament_id: newTid, division_id: divMap[t.division_id], pool_id: t.pool_id ? poolMap[t.pool_id] ?? null : null };
    await chk('insert team', await db.from('teams').insert(row));
  }
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

  const state = { slot: 0, labels: [] };
  for (const g of srcGames) {
    const newDate = (g.game_date ? isoDate(new Date(Date.parse(g.game_date) + deltaDays * DAY)) : null);
    const isDay1 = newDate === startISO;
    const row = {
      ...g, id: randomUUID(), tournament_id: newTid,
      division_id: divMap[g.division_id],
      home_team_id: g.home_team_id ? teamMap[g.home_team_id] ?? null : null,
      away_team_id: g.away_team_id ? teamMap[g.away_team_id] ?? null : null,
      game_date: newDate,
      diamond_id: g.diamond_id ? diamondMap[g.diamond_id] ?? null : null,
      venue_facility_id: g.venue_facility_id ? facilityMap[g.venue_facility_id] ?? null : null,
      schedule_facility_lane_id: null, home_slot_id: null, away_slot_id: null,
      score_submitted_by_user_id: null, score_submitted_by_email: null,
    };
    const nameFor = (id, placeholder) => (id ? (srcTeams.find(t => teamMap[t.id] === id)?.name ?? placeholder) : placeholder) ?? 'TBD';
    if (gameTransform) gameTransform(row, g, isDay1, state, nameFor);
    await chk('insert game', await db.from('games').insert(row));
  }
  return { newTid, labels: state.labels };
}

// ── fan-qa: underway today, finalization ON, games anchored to NOW ───────────
function setGameAt(row, offsetMin, status, scores) {
  const wc = torontoWallClock(new Date(Date.now() + offsetMin * 60_000));
  row.game_date = wc.date; row.game_time = wc.time; row.status = status;
  if (scores) {
    row.away_score = scores[0]; row.home_score = scores[1];
    row.score_submitted_at = new Date().toISOString(); row.score_submission_source = 'admin_results';
  } else { row.away_score = null; row.home_score = null; }
}

const liveResult = await clone({
  slug: 'fan-qa', name: 'Fan Experience QA — Live',
  startISO: todayISO, requireFinalization: true,
  gameTransform(row, src, isDay1, state, nameFor) {
    if (row.status === 'completed') return;            // keep source finals as FINAL
    if (src.is_playoff) { row.status = 'scheduled'; return; }
    if (!isDay1) { row.status = 'scheduled'; row.away_score = null; row.home_score = null; return; }
    const matchup = `${nameFor(row.away_team_id, src.away_team_id ? null : 'TBD')} vs ${nameFor(row.home_team_id, null)}`;
    const slot = state.slot++;
    if (slot === 0)      { setGameAt(row, -25, 'submitted', [2, 3]); state.labels.push(`LIVE + score : ${matchup}`); }
    else if (slot === 1) { setGameAt(row, -8,  'scheduled', null);   state.labels.push(`LIVE no-score: ${matchup}`); }
    else if (slot === 2) { setGameAt(row, -300, 'submitted', [1, 5]); state.labels.push(`UNOFFICIAL   : ${matchup}`); }
    else if (slot === 3) { setGameAt(row, 180, 'scheduled', null);   state.labels.push(`UPCOMING     : ${matchup}`); }
    else { row.status = 'scheduled'; row.away_score = null; row.home_score = null; }
  },
});

// ── fan-qa-open: future start, open registration ─────────────────────────────
await clone({
  slug: 'fan-qa-open', name: 'Fan Experience QA — Registration Open',
  startISO: isoDate(new Date(Date.now() + 14 * DAY)), requireFinalization: false,
  divisionTransform(row) { row.is_closed = false; row.capacity = null; },
  gameTransform(row) { row.status = 'scheduled'; row.away_score = null; row.home_score = null; },
});

console.log(`\n✅ Seeded Fan Experience QA fixtures (org ${ORG_SLUG})`);
console.log(`\n   fan-qa (UNDERWAY today, finalization ON) — registration CLOSED`);
for (const l of liveResult.labels) console.log(`     • ${l}`);
console.log(`     Public: /${ORG_SLUG}/fan-qa/schedule`);
console.log(`     Tip: follow the "LIVE + score" team above to light the dock.`);
console.log(`\n   fan-qa-open (starts in 14 days) — registration OPEN`);
console.log(`     Public: /${ORG_SLUG}/fan-qa-open/register`);
console.log(`\n   For finale + "registration closed on completed": run seed-completed-tournament.mjs → /${ORG_SLUG}/completed-demo\n`);
