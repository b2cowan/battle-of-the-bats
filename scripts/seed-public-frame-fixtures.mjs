/**
 * Public tournament pages, Stage 1 — the four kinds of organizer the new frame must carry (hub "Four organizers, one
 * frame", plan docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md §4; build prompt
 * PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md, Part 1 step 8). DEV ONLY, re-runnable; later stages' walks reuse it.
 *
 * Riverdale (riverdale-minor-ball / summer-classic) already exists and is the dark organizer colour. This adds:
 *   • Lakeshore Lightning Softball (Club) — a club's tournament in a PALE colour (#F2C94C), no theme of its own
 *   • Metro Sports Events (Tournament Plus) — a paid standalone with ITS OWN colour (#E0457B) and a logo
 *   • Northfield Sports Events (Tournament, free) — a free event: the neutral band, no mark (finished, last week)
 *   • Hamilton-Wentworth Girls Fastpitch (Club) — the LONG name, for the 360px phone (starts this weekend)
 * Stage 2 (the Overview, PUBLIC_TOURNAMENT_STAGE2_BUILD_PROMPT.md Part 1 step 5) adds its two missing moments:
 *   • Cedar Valley Minor Ball (Club) — BEFORE the event: three weeks out, every division open, nothing played
 *   • Pinecrest Fastball Events (Tournament Plus) — CROWNED on its last day: every game played, the final decided and the
 *     champion stamped, while today is still inside its dates (the band says Finished, not Live now)
 * Game day is Lakeshore (and Metro); .probe/stage1walk/walk.mjs moves Lakeshore through live / soon / new.
 * Each event clones dev-test-org's "Live Demo — Game Day" (divisions, pools, teams, venues, games), dated around today,
 * every division published. Organizations only — no sign-ins, so nothing here resets a password or signs anyone out.
 *
 * Re-running rebuilds the four (each org carries a marker in internal_notes; an org without it is never touched).
 * Refuses to run against production.
 *
 * Run: node --env-file=.env.local scripts/seed-public-frame-fixtures.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_ || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local');
  process.exit(1);
}
if (URL_.includes('qcttcboqysynwcdyghil')) { console.error('✗ Refusing to run: that is the PRODUCTION project.'); process.exit(1); }

const db = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const MARKER = 'seed-public-frame-fixtures.mjs (Public tournament pages Stage 1)';
const SOURCE_ORG = 'dev-test-org';
const SOURCE_SLUG = 'live-demo';

const DAY = 86_400_000;
const iso = (d) => d.toISOString().split('T')[0];
const today = new Date(`${iso(new Date())}T12:00:00Z`);
const todayISO = iso(today);
const addDays = (s, n) => iso(new Date(Date.parse(`${s}T12:00:00Z`) + n * DAY));
// This week's Friday (the club's "This weekend" rule counts Friday to Sunday).
const friday = addDays(todayISO, (5 - today.getUTCDay() + 7) % 7 || 7);

const FIXTURES = [
  {
    org: { slug: 'stage1-lakeshore-lightning', name: 'Lakeshore Lightning Softball', plan_id: 'club', theme_preset: null, theme_primary: '#F2C94C' },
    t: { slug: 'fall-classic', name: 'Lakeshore Lightning Fall Classic', start: addDays(todayISO, -1), status: 'active' },
    shows: 'club-run, pale colour → yellow band, near-black text, initials "LL", Live now',
  },
  {
    org: { slug: 'stage1-metro-sports', name: 'Metro Sports Events', plan_id: 'tournament_plus', theme_preset: 'platform', theme_primary: null },
    t: { slug: 'spring-showcase', name: 'Metro Spring Showcase', start: addDays(todayISO, -1), status: 'active', theme_primary: '#E0457B', logo: true },
    shows: 'paid standalone, its own colour + logo → pink band (darkened to carry white text), the logo, Live now',
  },
  {
    org: { slug: 'stage1-northfield', name: 'Northfield Sports Events', plan_id: 'tournament', theme_preset: 'platform', theme_primary: null },
    t: { slug: 'fall-ball', name: 'Northfield Fall Ball', start: addDays(todayISO, -9), status: 'completed', theme_primary: '#E0457B' },
    shows: 'free event (a stale colour saved, ignored) → neutral near-black band, no mark, the free badge, Finished',
  },
  {
    org: { slug: 'stage1-hamilton-wentworth', name: 'Hamilton-Wentworth Girls Fastpitch', plan_id: 'club', theme_preset: null, theme_primary: '#2C6A2A' },
    t: { slug: 'spring-invitational', name: 'Greater Hamilton-Wentworth Girls Fastpitch Spring Invitational', start: friday, status: 'active' },
    shows: 'the long name at 360px → two lines then "…", green band, This weekend',
  },
  {
    org: { slug: 'stage2-cedar-valley', name: 'Cedar Valley Minor Ball', plan_id: 'club', theme_preset: null, theme_primary: '#7A2E8C' },
    t: { slug: 'winter-warmup', name: 'Cedar Valley Winter Warm-up', start: addDays(todayISO, 21), status: 'active' },
    prep: 'before',
    shows: 'Stage 2 · BEFORE: three weeks out, every division open → Registration open, the Register card (Part 3)',
  },
  {
    org: { slug: 'stage2-pinecrest', name: 'Pinecrest Fastball Events', plan_id: 'tournament_plus', theme_preset: 'platform', theme_primary: null },
    t: { slug: 'harvest-cup', name: 'Pinecrest Harvest Cup', start: addDays(todayISO, -2), status: 'active', theme_primary: '#1E6B5C' },
    prep: 'crowned',
    shows: 'Stage 2 · CROWNED: its last day is today, the final played and the champion stamped → Finished, champions first',
  },
];

/** Stage 2's moments, applied to a built event (its games are the source's, already shifted to its dates). */
async function prep(kind, tid) {
  if (kind === 'before') {
    // Nothing has been played three weeks out, and every division takes teams.
    die('reset games', (await db.from('games').update({ status: 'scheduled', home_score: null, away_score: null }).eq('tournament_id', tid)).error);
    die('open divisions', (await db.from('divisions').update({ is_closed: false }).eq('tournament_id', tid)).error);
    return;
  }
  // Crowned: every pool game played, the semifinals won by the home side, their winners in the final, the final decided,
  // then the one-time stamp (lib/champions-notify.ts claims it the same way when a real final is scored).
  const games = await rows('games', db.from('games').select('id, is_playoff, bracket_code, status, home_team_id, away_team_id').eq('tournament_id', tid));
  for (const g of games.filter(x => !x.is_playoff && x.status === 'scheduled')) {
    die('pool game', (await db.from('games').update({ status: 'completed', home_score: 4, away_score: 2 }).eq('id', g.id)).error);
  }
  const semis = games.filter(x => x.is_playoff && /^SF/.test(x.bracket_code ?? ''));
  for (const g of semis) die('semifinal', (await db.from('games').update({ status: 'completed', home_score: 6, away_score: 3 }).eq('id', g.id)).error);
  const fin = games.find(x => x.is_playoff && x.bracket_code === 'FIN');
  if (!fin || semis.length < 2) { console.error('✗ The source bracket is not two semifinals and a final; re-seed it.'); process.exit(1); }
  die('final', (await db.from('games').update({
    status: 'completed', home_team_id: semis[0].home_team_id, away_team_id: semis[1].home_team_id, home_score: 7, away_score: 5,
  }).eq('id', fin.id)).error);
  die('crown', (await db.from('tournaments').update({ champions_crowned_at: new Date().toISOString() }).eq('id', tid)).error);
}

function die(label, error) { if (error) { console.error(`✗ ${label}:`, error.message); process.exit(1); } }
async function rows(label, q) { const { data, error } = await q; die(label, error); return data ?? []; }

// ── The source event ────────────────────────────────────────────────────────────────────────────────────────────
const [srcOrg] = await rows('source org', db.from('organizations').select('id').eq('slug', SOURCE_ORG));
if (!srcOrg) { console.error(`✗ ${SOURCE_ORG} not found — run the dev seeds first.`); process.exit(1); }
const [srcT] = await rows('source event', db.from('tournaments').select('*').eq('org_id', srcOrg.id).eq('slug', SOURCE_SLUG));
if (!srcT) { console.error(`✗ ${SOURCE_ORG}/${SOURCE_SLUG} not found — run scripts/seed-live-tournament.mjs first.`); process.exit(1); }
const srcDivs = await rows('divisions', db.from('divisions').select('*').eq('tournament_id', srcT.id));
const srcPools = srcDivs.length ? await rows('pools', db.from('pools').select('*').in('division_id', srcDivs.map(d => d.id))) : [];
const srcTeams = await rows('teams', db.from('teams').select('*').eq('tournament_id', srcT.id));
const srcGames = await rows('games', db.from('games').select('*').eq('tournament_id', srcT.id));
const srcVenues = await rows('venues', db.from('diamonds').select('*').eq('tournament_id', srcT.id));
const srcFacilities = srcVenues.length ? await rows('facilities', db.from('venue_facilities').select('*').in('venue_id', srcVenues.map(v => v.id))) : [];
// A logo already in dev storage (the branded-dark variant's), so the paid standalone has a real image.
const logos = await rows('logo', db.from('tournaments').select('logo_url').not('logo_url', 'is', null).limit(20));
const LOGO = (logos.find(l => l.logo_url.startsWith(URL_)) ?? logos[0])?.logo_url ?? null;

async function wipe(slug) {
  const [org] = await rows('find org', db.from('organizations').select('id, internal_notes').eq('slug', slug));
  if (!org) return;
  if (!String(org.internal_notes ?? '').includes(MARKER)) {
    console.error(`✗ Refusing to delete ${slug}: it was not made by this script.`);
    process.exit(1);
  }
  for (const t of await rows('events', db.from('tournaments').select('id').eq('org_id', org.id))) {
    const divs = await rows('divs', db.from('divisions').select('id').eq('tournament_id', t.id));
    const venues = await rows('venues', db.from('diamonds').select('id').eq('tournament_id', t.id));
    die('games', (await db.from('games').delete().eq('tournament_id', t.id)).error);
    if (venues.length) die('facilities', (await db.from('venue_facilities').delete().in('venue_id', venues.map(v => v.id))).error);
    die('venues', (await db.from('diamonds').delete().eq('tournament_id', t.id)).error);
    die('teams', (await db.from('teams').delete().eq('tournament_id', t.id)).error);
    if (divs.length) die('pools', (await db.from('pools').delete().in('division_id', divs.map(d => d.id))).error);
    die('divisions', (await db.from('divisions').delete().eq('tournament_id', t.id)).error);
    die('event', (await db.from('tournaments').delete().eq('id', t.id)).error);
  }
  die('org', (await db.from('organizations').delete().eq('id', org.id)).error);
}

async function build(f) {
  await wipe(f.org.slug);
  const [org] = await rows('org', db.from('organizations').insert({
    ...f.org, subscription_status: 'active', account_kind: 'organization', is_public: true, is_discoverable: false,
    internal_notes: MARKER, tournament_limit: 9999, team_limit: 15, onboarding_completed_at: new Date().toISOString(),
  }).select('id'));

  const delta = Math.round((Date.parse(`${f.t.start}T12:00:00Z`) - Date.parse(`${srcT.start_date}T12:00:00Z`)) / DAY);
  const tid = randomUUID();
  const row = {
    ...srcT, id: tid, org_id: org.id, slug: f.t.slug, name: f.t.name, status: f.t.status, is_active: false,
    start_date: f.t.start, end_date: addDays(srcT.end_date ?? srcT.start_date, delta),
    theme_preset: null, theme_primary: f.t.theme_primary ?? null, theme_accent: null, color_mode: null,
    logo_url: f.t.logo ? LOGO : null, list_in_directory: false,
  };
  for (const k of ['created_at', 'results_notified_at', 'results_notification_sent_count', 'champions_crowned_at']) delete row[k];
  die('event', (await db.from('tournaments').insert(row)).error);

  const ids = new Map();
  const map = (old) => { if (!old) return null; if (!ids.has(old)) ids.set(old, randomUUID()); return ids.get(old); };
  const strip = (r) => { const c = { ...r }; delete c.created_at; return c; };
  for (const d of srcDivs) die('division', (await db.from('divisions').insert({ ...strip(d), id: map(d.id), tournament_id: tid, schedule_visibility: 'published' })).error);
  for (const p of srcPools) die('pool', (await db.from('pools').insert({ ...strip(p), id: map(p.id), division_id: map(p.division_id) })).error);
  for (const t of srcTeams) die('team', (await db.from('teams').insert({ ...strip(t), id: map(t.id), tournament_id: tid, division_id: map(t.division_id), pool_id: t.pool_id ? map(t.pool_id) : null })).error);
  for (const v of srcVenues) die('venue', (await db.from('diamonds').insert({ ...strip(v), id: map(v.id), tournament_id: tid })).error);
  for (const fc of srcFacilities) die('facility', (await db.from('venue_facilities').insert({ ...strip(fc), id: map(fc.id), tournament_id: tid, venue_id: map(fc.venue_id) })).error);
  for (const g of srcGames) {
    die('game', (await db.from('games').insert({
      ...g, id: randomUUID(), tournament_id: tid, division_id: map(g.division_id),
      home_team_id: g.home_team_id ? ids.get(g.home_team_id) ?? null : null,
      away_team_id: g.away_team_id ? ids.get(g.away_team_id) ?? null : null,
      game_date: g.game_date ? addDays(g.game_date, delta) : null,
      diamond_id: g.diamond_id ? ids.get(g.diamond_id) ?? null : null,
      venue_facility_id: g.venue_facility_id ? ids.get(g.venue_facility_id) ?? null : null,
      schedule_facility_lane_id: null, home_slot_id: null, away_slot_id: null,
      score_submitted_by_user_id: null, score_submitted_by_email: null,
    })).error);
  }
  if (f.prep) await prep(f.prep, tid);
  return `/${f.org.slug}/${f.t.slug}`;
}

console.log(`Source: ${SOURCE_ORG}/${SOURCE_SLUG} (${srcDivs.length} divisions, ${srcTeams.length} teams, ${srcGames.length} games)\n`);
const made = [['riverdale-minor-ball', '/riverdale-minor-ball/summer-classic', 'club-run, dark colour (existing) → the platform blue band']];
for (const f of FIXTURES) made.push([f.org.slug, await build(f), f.shows]);

const base = process.env.FIXTURE_BASE_URL ?? 'http://localhost:3000';
console.log('Made (dev). The new frame is ON by default on dev; each line also has its preview links:\n');
for (const [, path, shows] of made) {
  console.log(`  ${base}${path}`);
  console.log(`     ${shows}`);
  console.log(`     on:  ${base}/api/public-frame?frame=on&to=${encodeURIComponent(path)}`);
  console.log(`     off: ${base}/api/public-frame?frame=off&to=${encodeURIComponent(path)}\n`);
}
