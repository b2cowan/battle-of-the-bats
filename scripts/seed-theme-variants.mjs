/**
 * Seed branded / light-mode / card-style tournament variants into dev-test-org so
 * the Phase E QA matrix can be walked by toggling the URL slug. Each variant clones
 * `dev-tournament-2026` (full pool schedule + bracket) and overrides theme columns.
 *
 * Advanced branding is plan-gated (tournament_plus+), so this bumps dev-test-org's
 * plan if needed. SIDE EFFECT: the free-plan acquisition banner / PoweredBy badge
 * won't show on dev-test-org while it's on a paid plan — revert plan_id to
 * 'tournament' to test those.
 *
 * Variants:
 *   branded-light → Crimson preset · LIGHT mode · glass cards · UPCOMING (countdown hero)
 *   branded-dark  → Battle Purple preset · DARK mode · outlined cards · LIVE game day
 *
 * Idempotent: re-running wipes + recreates each variant.
 * Run: node --env-file=.env.local scripts/seed-theme-variants.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'dev-test-org';
const SOURCE_SLUG = 'dev-tournament-2026';
const PLAN_RANK = { tournament: 0, tournament_plus: 1, league: 2, club: 3 };

const VARIANTS = [
  {
    slug: 'branded-light', name: 'Crimson Cup (Branded · Light)', live: false,
    theme: { theme_preset: 'crimson', theme_primary: null, theme_accent: null, color_mode: 'light', theme_card_style: 'glass' },
  },
  {
    slug: 'branded-dark', name: 'Purple Classic (Branded · Dark)', live: true,
    theme: { theme_preset: 'bats', theme_primary: null, theme_accent: null, color_mode: 'dark', theme_card_style: 'outlined' },
  },
];

const DAY = 86_400_000;
const isoDate = (d) => d.toISOString().split('T')[0];
const todayISO = isoDate(new Date());
const shiftDate = (s, delta) => (s ? isoDate(new Date(Date.parse(s) + delta * DAY)) : null);

async function chk(label, { error }) {
  if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); }
}

// ── org + plan ────────────────────────────────────────────────────────────────
const { data: orgs } = await db.from('organizations').select('id, plan_id').eq('slug', ORG_SLUG);
const org = orgs?.[0];
if (!org) { console.error('org dev-test-org not found'); process.exit(1); }
console.log(`Org plan: ${org.plan_id}`);
if ((PLAN_RANK[org.plan_id] ?? 0) < PLAN_RANK.tournament_plus) {
  await chk('bump plan', await db.from('organizations').update({ plan_id: 'tournament_plus' }).eq('id', org.id));
  console.log(`⚠  Bumped dev-test-org plan: ${org.plan_id} → tournament_plus (advanced branding now active). Free-plan banner will not show until reverted.`);
}
const orgId = org.id;

// ── source ────────────────────────────────────────────────────────────────────
const { data: srcTours } = await db.from('tournaments').select('*').eq('org_id', orgId).eq('slug', SOURCE_SLUG);
const srcT = srcTours?.[0];
if (!srcT) { console.error(`source tournament ${SOURCE_SLUG} not found`); process.exit(1); }
const { data: srcDivs } = await db.from('divisions').select('*').eq('tournament_id', srcT.id);
const { data: srcPools } = await db.from('pools').select('*').in('division_id', srcDivs.map(d => d.id));
const { data: srcTeams } = await db.from('teams').select('*').eq('tournament_id', srcT.id);
const { data: srcGames } = await db.from('games').select('*').eq('tournament_id', srcT.id);
const { data: srcDiamonds } = await db.from('diamonds').select('*').eq('tournament_id', srcT.id);
const srcDiamondIds = (srcDiamonds ?? []).map(d => d.id);
const { data: srcFacilities } = srcDiamondIds.length
  ? await db.from('venue_facilities').select('*').in('venue_id', srcDiamondIds)
  : { data: [] };
const divNameById = Object.fromEntries(srcDivs.map(d => [d.id, d.name]));

function liveScore(g, isDay1) {
  const divName = divNameById[g.division_id] ?? '';
  if (!isDay1 || g.is_playoff || divName !== 'U11') return null;
  if (g.status === 'completed') return null;
  if (g.game_time === '12:30:00') return { status: 'submitted', away_score: 2, home_score: 4 };
  if (g.game_time === '14:15:00') return { status: 'submitted', away_score: 1, home_score: 1 };
  return null;
}

async function seedVariant(v) {
  // wipe prior
  const { data: existing } = await db.from('tournaments').select('id').eq('org_id', orgId).eq('slug', v.slug);
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
  }

  const delta = v.live ? Math.round((Date.parse(todayISO) - Date.parse(srcT.start_date)) / DAY) : 0;
  const newTid = randomUUID();
  const newT = { ...srcT, ...v.theme,
    id: newTid, slug: v.slug, name: v.name,
    status: v.live ? 'active' : srcT.status, is_active: false,
    start_date: v.live ? todayISO : srcT.start_date,
    end_date: v.live ? shiftDate(srcT.end_date, delta) : srcT.end_date,
  };
  delete newT.created_at; delete newT.results_notified_at; delete newT.results_notification_sent_count;
  await chk('insert tournament', await db.from('tournaments').insert(newT));

  const divMap = {};
  for (const d of srcDivs) { const nid = randomUUID(); divMap[d.id] = nid; const row = { ...d, id: nid, tournament_id: newTid }; delete row.created_at; await chk('division', await db.from('divisions').insert(row)); }
  const poolMap = {};
  for (const p of srcPools) { const nid = randomUUID(); poolMap[p.id] = nid; const row = { ...p, id: nid, division_id: divMap[p.division_id] }; delete row.created_at; await chk('pool', await db.from('pools').insert(row)); }
  const teamMap = {};
  for (const t of srcTeams) { const nid = randomUUID(); teamMap[t.id] = nid; const row = { ...t, id: nid, tournament_id: newTid, division_id: divMap[t.division_id], pool_id: t.pool_id ? poolMap[t.pool_id] ?? null : null }; await chk('team', await db.from('teams').insert(row)); }
  const diamondMap = {};
  for (const d of srcDiamonds ?? []) { const nid = randomUUID(); diamondMap[d.id] = nid; const row = { ...d, id: nid, tournament_id: newTid }; delete row.created_at; await chk('venue', await db.from('diamonds').insert(row)); }
  const facilityMap = {};
  for (const f of srcFacilities ?? []) { if (!diamondMap[f.venue_id]) continue; const nid = randomUUID(); facilityMap[f.id] = nid; const row = { ...f, id: nid, tournament_id: newTid, venue_id: diamondMap[f.venue_id] }; delete row.created_at; await chk('facility', await db.from('venue_facilities').insert(row)); }

  const now = new Date().toISOString();
  let liveCount = 0;
  for (const g of srcGames) {
    const newDate = v.live ? shiftDate(g.game_date, delta) : g.game_date;
    const row = { ...g, id: randomUUID(), tournament_id: newTid,
      division_id: divMap[g.division_id],
      home_team_id: g.home_team_id ? teamMap[g.home_team_id] ?? null : null,
      away_team_id: g.away_team_id ? teamMap[g.away_team_id] ?? null : null,
      game_date: newDate,
      diamond_id: g.diamond_id ? diamondMap[g.diamond_id] ?? null : null,
      venue_facility_id: g.venue_facility_id ? facilityMap[g.venue_facility_id] ?? null : null,
      schedule_facility_lane_id: null, home_slot_id: null, away_slot_id: null,
      score_submitted_by_user_id: null, score_submitted_by_email: null,
    };
    const live = v.live ? liveScore(g, newDate === todayISO) : null;
    if (live) { Object.assign(row, live, { score_submitted_at: now, score_submission_source: 'admin_results' }); liveCount++; }
    await chk('game', await db.from('games').insert(row));
  }
  console.log(`✅ ${v.name}  →  /${ORG_SLUG}/${v.slug}/schedule   [${v.theme.theme_preset} · ${v.theme.color_mode} · ${v.theme.theme_card_style}${v.live ? ` · LIVE (${liveCount})` : ' · upcoming'}]`);
}

for (const v of VARIANTS) await seedVariant(v);
console.log('\nDone. Toggle between: dev-tournament-2026 (default·dark·upcoming), live-demo (default·dark·live), branded-light, branded-dark.');
