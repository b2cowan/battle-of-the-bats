/**
 * Seed the UAT FREE-COACH fixture on the DEV database: a real free Coaches Portal account.
 *
 * WHY THIS EXISTS. Every other coach fixture is a Premium portal (club-linked `UAT Test Team`, or the
 * standalone clone from seed-uat-standalone-coach.mjs). The FREE coach — no organization, no paid
 * workspace — reads a different shell (`CoachPortalShell` + `CoachFreeBottomNav`, `/coaches/...`),
 * with its own sidebar and phone More sheet, and had no fixture to walk, measure or design-check.
 *
 * WHAT IT MAKES (the same rows the free sign-up journey writes — /start/team → createBasicCoachTeam
 * in lib/basic-coach-teams.ts, then setBasicCoachTeamFeature for each tool):
 *   · one auth user  UAT_FREE_COACH_EMAIL / UAT_FREE_COACH_PASSWORD (email confirmed, named)
 *   · one `basic_coach_teams` row  "UAT Free Team", source 'coach_created', team_workspace_id NULL
 *   · one `basic_coach_team_users` owner membership (status 'active')
 *   · `activated_features` = ['roster','schedule']  (so the More sheet carries Roster + Schedule tiles)
 *   NO organization, NO org membership, NO team_workspaces row: that is what makes it FREE.
 *
 *   node scripts/seed-free-coach-fixture.mjs            # create or repair (idempotent)
 *
 * Idempotent: re-running finds the user by email, the team by the user's own membership, and only
 * writes what is missing or different. Never deletes anything.
 *
 * Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UAT_FREE_COACH_EMAIL,
 * UAT_FREE_COACH_PASSWORD. House convention: emails are `*.local`, password is the shared
 * `UATPassword2026!` (UAT_SETUP.md).
 *
 * ⚠ DEV ONLY. Hard-wired to the dev project ref; it refuses to run against any other host and says
 * which host it is about to write to before it writes.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(here, '..', '.env.local'), quiet: true });

const DEV_PROJECT_REF = 'npgnrxaitgbtbtvvykto';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.UAT_FREE_COACH_EMAIL ?? '').trim().toLowerCase();
const password = process.env.UAT_FREE_COACH_PASSWORD;

if (!url || !key || !email || !password) {
  console.error('✗ Missing env. Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UAT_FREE_COACH_EMAIL, UAT_FREE_COACH_PASSWORD.');
  process.exit(1);
}
const host = new URL(url).host;
console.log(`target Supabase host: ${host}`);
if (host !== `${DEV_PROJECT_REF}.supabase.co`) {
  console.error(`✗ Refusing to run: ${host} is not the DEV project (${DEV_PROJECT_REF}.supabase.co).`);
  process.exit(1);
}

const db = createClient(url, key);
const ok = (m) => console.log(`  ✓ ${m}`);
const die = (m, err) => { console.error(`✗ ${m}${err ? `: ${err.message ?? err}` : ''}`); process.exit(1); };

const TEAM_NAME = 'UAT Free Team';
const COACH = ['Frankie', 'Okafor'];
const FEATURES = ['roster', 'schedule'];

// ── the auth user ────────────────────────────────────────────────────────────
async function findUser() {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die('list users', error);
    const hit = data.users.find(u => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}
const meta = { first_name: COACH[0], last_name: COACH[1], full_name: COACH.join(' '), display_name: COACH.join(' ') };
let user = await findUser();
if (!user) {
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error) die(`create ${email}`, error);
  user = data.user;
  ok(`created auth user ${email}`);
} else {
  const { error } = await db.auth.admin.updateUserById(user.id, { password, email_confirm: true, user_metadata: { ...user.user_metadata, ...meta } });
  if (error) die('update user', error);
  ok(`auth user ${email} exists (password + name re-asserted)`);
}

// ── the free team (found by THIS user's own membership, never by name) ───────
const { data: memberships, error: mErr } = await db.from('basic_coach_team_users')
  .select('id, basic_coach_team_id, status').eq('user_id', user.id);
if (mErr) die('read memberships', mErr);

let teamId = memberships?.find(m => m.status === 'active')?.basic_coach_team_id ?? null;
if (!teamId) {
  const now = new Date().toISOString();
  const { data: team, error } = await db.from('basic_coach_teams').insert({
    name: TEAM_NAME, normalized_name: TEAM_NAME.toLowerCase(), primary_coach_name: COACH.join(' '),
    primary_coach_email: email, sport: 'Baseball', age_group: 'U13', source: 'coach_created',
    activated_features: FEATURES, created_at: now, updated_at: now,
  }).select('id').single();
  if (error) die('create team', error);
  teamId = team.id;
  const { error: uErr } = await db.from('basic_coach_team_users')
    .insert({ basic_coach_team_id: teamId, user_id: user.id, role: 'owner', status: 'active' });
  if (uErr) die('create membership', uErr);
  ok(`created free team "${TEAM_NAME}" (${teamId}) with an owner membership`);
} else {
  ok(`free team already present (${teamId})`);
}

// ── the tools turned on (mig 211 function, as the product does it) ───────────
for (const feature of FEATURES) {
  const { error } = await db.rpc('set_basic_coach_team_feature', { p_team_id: teamId, p_feature: feature, p_active: true });
  if (error) die(`activate ${feature}`, error);
}
const { data: row, error: rErr } = await db.from('basic_coach_teams')
  .select('name, activated_features, team_workspace_id, source').eq('id', teamId).single();
if (rErr) die('read back team', rErr);
ok(`tools on: ${JSON.stringify(row.activated_features)} · workspace link: ${row.team_workspace_id ?? 'none (free)'} · source: ${row.source}`);

console.log(`\n✓ Done. Sign in at /auth/login as ${email}; the free Coaches Portal opens at /coaches.`);
