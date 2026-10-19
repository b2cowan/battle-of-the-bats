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
 *   · `activated_features` = every tool (roster, schedule, fees, announcements) — the More sheet and the
 *     Overview's tiles at their fullest, as a coach who uses them sees them
 *   NO organization, NO org membership, NO team_workspaces row: that is what makes it FREE.
 *
 * AND A TEAM WORTH MEASURING (layout sweep B4, owner 2026-10-19). An empty team sweeps only its empty
 * states — coverage that isn't. So: 12 players (five with a family email), a schedule of practices,
 * games and a photo day on FIXED dates in spring 2027 plus one past game, three fees, one sent
 * announcement, and two bell notices. The dates are fixed and far ahead on purpose: the Overview picks
 * its "next event" on the SERVER from today's real date (a browser clock cannot pin it), and a date in
 * a finding's name would re-key the layout baseline on every re-seed. ⚠ They run out after 2027-04-24: move the
 * whole schedule a season on before then (the Overview's "next event" goes empty, and the sweep's free Schedule and
 * Overview findings re-key). The notices are filed under the
 * UAT tournament org (UAT_PLUS_ORG_SLUG) — a free coach's notices come from a host club, and
 * `notifications.org_id` is NOT NULL — and are tagged `metadata.seed` so a re-run finds its own.
 * Writing them never sends anything: the announcement row is the send LOG, not the send.
 *
 *   node scripts/seed-free-coach-fixture.mjs            # create or repair (idempotent)
 *
 * Idempotent: re-running finds the user by email, the team by the user's own membership, and only
 * writes what is missing or different. Never deletes anything — and never resets a password that still works, because a
 * reset signs the account out everywhere (the layout sweep's saved sign-in with it).
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
const FEATURES = ['roster', 'schedule', 'fees', 'announcements'];

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
  // ⚠ SETTING THE PASSWORD ENDS EVERY SESSION THE ACCOUNT HOLDS — the layout sweep's saved sign-in included (measured
  // 2026-10-19: a re-run of this script turned the free coach's saved session from 200 to 401 on staging). So it is set
  // only when it no longer signs in, checked on a throwaway client whose own session is ended locally after.
  const probe = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? key, { auth: { persistSession: false } });
  const { error: signInErr } = await probe.auth.signInWithPassword({ email, password });
  // Only a WRONG password earns a reset — a rate limit or a network error must not sign the account out everywhere.
  if (signInErr && signInErr.code !== 'invalid_credentials') die('check the free coach can sign in (password left alone)', signInErr);
  if (!signInErr) await probe.auth.signOut({ scope: 'local' });
  const { error } = await db.auth.admin.updateUserById(user.id, {
    ...(signInErr ? { password } : {}), email_confirm: true, user_metadata: { ...user.user_metadata, ...meta },
  });
  if (error) die('update user', error);
  ok(`auth user ${email} exists (${signInErr ? 'password reset' : 'password already works — left alone, sessions kept'}; name re-asserted)`);
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

// ── the team's rows — each written only when missing, matched on what a coach would see ──────
const by = { created_by_user_id: user.id };
async function readAll(table, cols) {
  const { data, error } = await db.from(table).select(cols).eq('basic_coach_team_id', teamId);
  if (error) die(`read ${table}`, error);
  return data ?? [];
}
async function insertMissing(table, rows, keyOf, have) {
  const seen = new Set(have.map(keyOf));
  const missing = rows.filter(r => !seen.has(keyOf(r)));
  if (missing.length) {
    const { error } = await db.from(table).insert(missing);
    if (error) die(`insert ${table}`, error);
  }
  ok(`${table}: ${missing.length} added, ${rows.length - missing.length} already present`);
}

// [first, last, jersey, guardian first, guardian last] — a guardian means a family email.
const PLAYERS = [
  ['Maya', 'Chen', '2', 'Lin', 'Chen'], ['Theo', 'Novak', '4', null, null], ['Amara', 'Boateng', '7', 'Kofi', 'Boateng'],
  ['Liam', 'Fraser', '9', null, null], ['Sofia', 'Marchetti', '11', 'Gina', 'Marchetti'], ['Eli', 'Tremblay', '12', null, null],
  ['Noor', 'Haddad', '14', null, null], ['Jonah', 'Whitecloud', '17', 'Rae', 'Whitecloud'], ['Ava', 'Sandhu', '21', null, null],
  ['Kai', 'Morrison', '23', null, null], ['Lucas', 'Pereira', '27', 'Ana', 'Pereira'], ['Zoe', 'Lindqvist', '31', null, null],
];
const playerRows = PLAYERS.map(([first, last, jersey, gFirst, gLast], i) => ({
  basic_coach_team_id: teamId, name: `${first} ${last}`, first_name: first, last_name: last, jersey_number: jersey,
  guardian_first_name: gFirst, guardian_last_name: gLast, guardian_name: gFirst ? `${gFirst} ${gLast}` : null,
  contact_email: gFirst ? `${gFirst}.${gLast}@uat-free-coach.local`.toLowerCase() : null,
  display_order: i, ...by,
}));
await insertMissing('basic_coach_team_players', playerRows, r => r.name, await readAll('basic_coach_team_players', 'name'));
const players = await readAll('basic_coach_team_players', 'id, name');
const playerId = (name) => players.find(p => p.name === name)?.id ?? die(`player ${name} missing after insert`);

// Spring 2027 (EDT, -04:00) plus one past game, so the schedule has a past and a next.
const ev = (event_type, title, start, end, extra = {}) => ({
  basic_coach_team_id: teamId, event_type, title, starts_at: start, ends_at: end, status: 'scheduled', ...by, ...extra,
});
const eventRows = [
  ev('game', 'vs Riverside Rockets', '2026-09-19T10:00:00-04:00', '2026-09-19T12:00:00-04:00', { opponent: 'Riverside Rockets', location: 'Kinsmen Park, Diamond 2' }),
  ev('practice', 'Practice', '2027-04-06T18:00:00-04:00', '2027-04-06T19:30:00-04:00', { location: 'Centennial Park', notes: 'Bring water and a glove.' }),
  ev('event', 'Team photo day', '2027-04-10T09:00:00-04:00', '2027-04-10T10:00:00-04:00', { location: 'Centennial Park' }),
  ev('practice', 'Practice', '2027-04-13T18:00:00-04:00', '2027-04-13T19:30:00-04:00', { location: 'Centennial Park' }),
  ev('game', 'vs Northside Thunder', '2027-04-17T10:00:00-04:00', '2027-04-17T12:00:00-04:00', { opponent: 'Northside Thunder', location: 'Kinsmen Park, Diamond 4' }),
  ev('game', 'vs Lakeside Lightning', '2027-04-24T13:00:00-04:00', '2027-04-24T15:00:00-04:00', { opponent: 'Lakeside Lightning', location: 'Lakeside Fields' }),
];
await insertMissing('basic_coach_team_events', eventRows, r => `${r.title}|${new Date(r.starts_at).toISOString()}`,
  await readAll('basic_coach_team_events', 'title, starts_at'));

const feeRows = [
  { label: 'Spring tournament fee', amount: '45.00', player: 'Maya Chen', paid: true },
  { label: 'Spring tournament fee', amount: '45.00', player: 'Theo Novak', paid: false },
  { label: 'Jersey deposit', amount: '20.00', player: 'Amara Boateng', paid: false },
].map((f, i) => ({
  basic_coach_team_id: teamId, player_id: playerId(f.player), label: f.label, amount: f.amount,
  status: f.paid ? 'paid' : 'unpaid', marked_paid_at: f.paid ? '2026-10-01T12:00:00-04:00' : null, display_order: i, ...by,
}));
await insertMissing('basic_coach_team_fees', feeRows, r => `${r.player_id}|${r.label}`,
  await readAll('basic_coach_team_fees', 'player_id, label'));

const families = playerRows.filter(p => p.contact_email).length;
await insertMissing('basic_coach_team_announcements', [{
  basic_coach_team_id: teamId, subject: 'Spring season starts April 6',
  body: 'Our first practice is Tuesday, April 6 at 6:00 p.m. at Centennial Park. Bring water and a glove. Team photos are Saturday, April 10.',
  recipient_count: families, sent_count: families, failed_count: 0, status: 'sent', sent_at: '2026-10-05T19:00:00-04:00', ...by,
}], r => r.subject, await readAll('basic_coach_team_announcements', 'subject'));

// ── two bell notices from the host club (one unread) — "know" kinds only, never the one "act" kind ──
const SEED_TAG = 'free-coach-fixture';
const tournSlug = process.env.UAT_PLUS_ORG_SLUG || 'uat-plus-org';
const { data: hostOrg, error: hErr } = await db.from('organizations').select('id, name').eq('slug', tournSlug).maybeSingle();
if (hErr || !hostOrg) die(`host org "${tournSlug}" (the bell notices are filed under it)`, hErr ?? new Error('not found'));
// The host's own tournament by name, as the admin sweep finds it — the words are the product's (TEAM_COACH_WORDS).
const { data: tourn, error: tErr } = await db.from('tournaments').select('name').eq('org_id', hostOrg.id)
  .ilike('name', '%Championship%').limit(1).maybeSingle();
if (tErr || !tourn) die(`a Championship tournament on "${tournSlug}"`, tErr ?? new Error('not found'));
const notice = (event_type, title, body, read) => ({
  org_id: hostOrg.id, user_id: user.id, event_type, title, body, link: `/coaches/team/${teamId}/tournaments`,
  read_at: read ? new Date().toISOString() : null, metadata: { seed: SEED_TAG },
});
const { data: haveNotices, error: nErr } = await db.from('notifications').select('event_type')
  .eq('user_id', user.id).contains('metadata', { seed: SEED_TAG });
if (nErr) die('read notices', nErr);
await insertMissing('notifications', [
  notice('team_coach_accepted', `${hostOrg.name} accepted ${TEAM_NAME}`, tourn.name, false),
  notice('team_coach_schedule_published', `The schedule for ${tourn.name} is out`, `${hostOrg.name} · ${TEAM_NAME}`, true),
], r => r.event_type, haveNotices ?? []);

console.log(`\n✓ Done. Sign in at /auth/login as ${email}; the free Coaches Portal opens at /coaches.`);
