/**
 * Seed a FREE-tier tournament org with a REAL owner login, ready for manually
 * building a playoff bracket.
 *
 * Creates (idempotent):
 *   • auth user   free-owner@dev.local  / devpass123   (a real org member, so the
 *     schedule page's direct browser-client writes — Add Game / inline edit /
 *     delete — actually work; platform-admins who aren't members get silent
 *     RLS no-ops).
 *   • organization  "Free Test Org"  slug=free-test-org  plan_id=tournament (FREE).
 *   • tournament    "Free Cup"  slug=free-cup  (status=active), 1 division (U11),
 *     6 accepted teams, and a COMPLETED round robin so standings exist and
 *     "Start from standings (1 v 8, 2 v 7 …)" produces a real seeding.
 *   • playoffs left EMPTY → log in and build the bracket by hand.
 *
 * Re-running wipes + recreates the tournament (org + user are reused).
 *
 * Run: node --env-file=.env.local scripts/seed-free-tier-org.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ORG_SLUG = 'free-test-org';
const ORG_NAME = 'Free Test Org';
const OWNER_EMAIL = 'free-owner@dev.local';
const PASSWORD = 'devpass123';
const TOURN_SLUG = 'free-cup';
const TOURN_NAME = 'Free Cup';
const DIVISION = 'U11';
const TEAMS = ['Hawks', 'Wolves', 'Lions', 'Bears', 'Sharks', 'Eagles']; // index 0 = strongest

const DAY = 86_400_000;
const iso = (d) => d.toISOString().split('T')[0];
const today = new Date();
const startDate = iso(new Date(today - 7 * DAY));
const endDate = iso(new Date(today.getTime() + 7 * DAY));

function die(label, error) { if (error) { console.error(`❌ ${label}:`, error.message); process.exit(1); } }

// ── 1. auth user (owner) ──────────────────────────────────────────────────────
const { data: userList } = await db.auth.admin.listUsers();
let owner = userList?.users.find(u => u.email === OWNER_EMAIL);
if (!owner) {
  const { data, error } = await db.auth.admin.createUser({ email: OWNER_EMAIL, password: PASSWORD, email_confirm: true });
  die('createUser', error); owner = data.user;
  console.log(`created auth user ${OWNER_EMAIL}`);
} else {
  console.log(`auth user exists ${OWNER_EMAIL}`);
}

// ── 2. organization (FREE tier) ───────────────────────────────────────────────
let org = (await db.from('organizations').select('*').eq('slug', ORG_SLUG).maybeSingle()).data;
if (!org) {
  const row = {
    id: randomUUID(), name: ORG_NAME, slug: ORG_SLUG,
    plan_id: 'tournament', subscription_status: 'active', tournament_limit: 1,
    is_public: true, theme_preset: 'platform',
  };
  die('insert org', (await db.from('organizations').insert(row)).error);
  org = row;
  console.log(`created org ${ORG_SLUG} (plan_id=tournament, FREE)`);
} else {
  // Keep it on the free tier even if a prior run set something else.
  if (org.plan_id !== 'tournament') {
    die('reset plan', (await db.from('organizations').update({ plan_id: 'tournament' }).eq('id', org.id)).error);
  }
  console.log(`org exists ${ORG_SLUG} (plan_id=tournament)`);
}

// ── 3. owner membership ───────────────────────────────────────────────────────
const member = (await db.from('organization_members').select('id').eq('organization_id', org.id).eq('user_id', owner.id).maybeSingle()).data;
if (!member) {
  die('insert member', (await db.from('organization_members').insert({
    organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active', accepted_at: new Date().toISOString(),
  })).error);
  console.log(`linked ${OWNER_EMAIL} as owner`);
} else {
  console.log('membership exists');
}

// ── 4. wipe prior tournament (idempotent) ─────────────────────────────────────
const prior = (await db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', TOURN_SLUG)).data;
if (prior?.length) {
  const oldId = prior[0].id;
  const oldDivs = (await db.from('divisions').select('id').eq('tournament_id', oldId)).data ?? [];
  await db.from('games').delete().eq('tournament_id', oldId);
  await db.from('teams').delete().eq('tournament_id', oldId);
  if (oldDivs.length) await db.from('pools').delete().in('division_id', oldDivs.map(d => d.id));
  await db.from('divisions').delete().eq('tournament_id', oldId);
  await db.from('tournaments').delete().eq('id', oldId);
  console.log('wiped prior Free Cup tournament');
}

// ── 5. tournament ─────────────────────────────────────────────────────────────
const tid = randomUUID();
die('insert tournament', (await db.from('tournaments').insert({
  id: tid, org_id: org.id, slug: TOURN_SLUG, name: TOURN_NAME, year: 2026,
  status: 'active', is_active: true, start_date: startDate, end_date: endDate, settings: {},
})).error);

// ── 6. division ───────────────────────────────────────────────────────────────
const did = randomUUID();
die('insert division', (await db.from('divisions').insert({
  id: did, tournament_id: tid, name: DIVISION, settings: {},
})).error);

// ── 7. teams (accepted) ───────────────────────────────────────────────────────
const teamIds = [];
for (let i = 0; i < TEAMS.length; i++) {
  const id = randomUUID(); teamIds.push(id);
  die('insert team', (await db.from('teams').insert({
    id, tournament_id: tid, division_id: did, name: `${TEAMS[i]} ${DIVISION}`,
    coach: `Coach ${TEAMS[i]}`, email: `coach-${TEAMS[i].toLowerCase()}@dev.local`,
    status: 'accepted', payment_status: 'paid', registered_at: new Date().toISOString(),
  })).error);
}

// ── 8. completed round robin → distinct standings (lower index = stronger) ─────
// Stronger team always wins, so wins = (#teams - 1 - rank) → seeds 1..6 are distinct.
let gameNo = 0;
for (let i = 0; i < teamIds.length; i++) {
  for (let j = i + 1; j < teamIds.length; j++) {
    const homeIsStronger = (gameNo % 2 === 0);
    const stronger = teamIds[i], weaker = teamIds[j];
    const home = homeIsStronger ? stronger : weaker;
    const away = homeIsStronger ? weaker : stronger;
    const strongerScore = 7 - (j - i); // closer ranks → closer scores
    const homeScore = homeIsStronger ? strongerScore : 2;
    const awayScore = homeIsStronger ? 2 : strongerScore;
    const gameDate = iso(new Date(Date.parse(startDate) + (gameNo % 3) * DAY));
    die('insert game', (await db.from('games').insert({
      id: randomUUID(), tournament_id: tid, division_id: did,
      home_team_id: home, away_team_id: away,
      game_date: gameDate, game_time: ['09:00:00', '11:00:00', '13:00:00'][gameNo % 3],
      location: 'Community Park', status: 'completed',
      home_score: homeScore, away_score: awayScore, is_playoff: false,
      score_submission_source: 'admin_results', score_submitted_at: new Date().toISOString(),
    })).error);
    gameNo++;
  }
}

console.log(`\n✅ Seeded FREE-tier "${TOURN_NAME}"`);
console.log(`   ${TEAMS.length} teams · ${gameNo} completed round-robin games · playoffs EMPTY`);
console.log(`   Plan: tournament (free floor) — manual bracket build is free; auto-schedule stays Plus.`);
console.log(`\n   Login:    ${OWNER_EMAIL} / ${PASSWORD}`);
console.log(`   Admin:    /${ORG_SLUG}/admin/tournaments/schedule  → Playoffs → Bracket → "Build Bracket"`);
console.log(`   Standings order (seeds 1→6): ${TEAMS.map((t, i) => `${i + 1}=${t}`).join(', ')}`);
