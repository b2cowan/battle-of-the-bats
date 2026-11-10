/**
 * seed-prospect-demo.mjs — build or reset a fictional PROSPECT CLUB on the DEV database (Milton Bats Softball Association;
 * plan docs/projects/active/MILTON_DEMO_WORLD_PLAN.md, Phase A). One command rebuilds the whole house-league world.
 *
 *   npm run demo:milton                       build or refresh (same as the reset: a refresh IS a rebuild)
 *   npm run demo:milton:reset                 the explicit alias
 *   npm run demo:milton -- --demo-day YYYY-MM-DD   move every date (default: today; within -35 to +60 days of today)
 *   npm run demo:milton -- --dry-run          print what it would do; write nothing
 *
 * ⚖ WHAT THE RESET TOUCHES: rows the Milton organization OWNS in the world — the season(s), their divisions, teams,
 * registrations, money lines, games, scores, sent-email history, notices, team-change state, the club schedule, the
 * children and parents, family links and invitations, notifications — and whatever a live walk created in them.
 * ⚖ WHAT IT NEVER TOUCHES: auth users, their passwords, the organization's row (name, plan, theme, logo), its public-site
 * content, its venues, its owner/League admin memberships. An open browser session survives a reset. A password is set
 * ONLY when an account is first created.
 *
 * ⚠ DEV ONLY. Refuses any database that is not the dev project, and any organization whose slug is not `milton-bats`
 * (or that this script did not create). Every delete below is scoped by the Milton organization id, or by ids it owns.
 * ⚠ No email is sent here: the family-email rows a publish writes are marked sent (history); nothing calls the mailer.
 *
 * Run: node --env-file=.env.local scripts/seed-prospect-demo.mjs [--demo-day YYYY-MM-DD] [--dry-run]
 */
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { ensureFixtureUser, findUserByEmail } from './lib/fixture-user.mjs';
import cfg from './prospect-demo.milton.config.mjs';
import {
  addDays, saturdayAfter, onOrAfter, torontoInstant, minutesLater, mulberry32, buildWorld, snakeDraft, tally,
} from './lib/prospect-demo-world.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_REF = 'npgnrxaitgbtbtvvykto';
const PROD_REF = 'qcttcboqysynwcdyghil';
const SLUG = 'milton-bats';

// ── arguments ───────────────────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const dayArg = argv.indexOf('--demo-day');
const todayLocal = (() => { const t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); return t.toISOString().slice(0, 10); })();
const DEMO_DAY = dayArg >= 0 ? argv[dayArg + 1] : todayLocal;
for (const a of argv) if (!['--dry-run', '--reset', '--demo-day', DEMO_DAY].includes(a)) { console.error(`✗ Unknown argument: ${a}`); process.exit(1); }
if (!/^\d{4}-\d{2}-\d{2}$/.test(DEMO_DAY) || Number.isNaN(Date.parse(`${DEMO_DAY}T12:00:00Z`))) { console.error('✗ --demo-day must be YYYY-MM-DD.'); process.exit(1); }

// The app judges "open", "early bird" and "the coming Saturday" by the REAL clock, so a demo day far from today builds a world
// whose sign-up form says "isn't open yet" or whose rainout has no games to catch. Refuse the far cases, warn on the near ones.
const driftDays = Math.round((Date.parse(`${DEMO_DAY}T12:00:00Z`) - Date.parse(`${todayLocal}T12:00:00Z`)) / 86400000);
if (driftDays < -35 || driftDays > 60) {
  console.error(`✗ --demo-day ${DEMO_DAY} is ${driftDays} days from today. The sign-up form and the rainout only work within about -35 to +60 days of the real date. Use a nearer day, or leave it off.`);
  process.exit(1);
}
if (Math.abs(driftDays) > 3) console.warn(`⚠ --demo-day is ${driftDays} days from today: the early-bird price and the coming Saturday's games age with the real clock. Rebuild on the morning of the demo.`);

// ── safety 1: the dev project only, and only the Milton organization ─────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local (npm run demo:milton does).'); process.exit(1); }
let host = '';
try { host = new URL(url).host; } catch { /* handled below */ }
if (url.includes(PROD_REF) || host !== `${DEV_REF}.supabase.co`) {
  console.error(`✗ Refusing to run: ${url.includes(PROD_REF) ? 'that is the PRODUCTION project' : 'the Supabase URL is not the dev project'}. This seed runs on dev only.`);
  process.exit(1);
}
if (cfg.slug !== SLUG) { console.error(`✗ Refusing to run: the config slug is "${cfg.slug}", not "${SLUG}".`); process.exit(1); }

const db = createClient(url, key, { auth: { persistSession: false } });
const die = (label, error) => { if (error) { console.error(`✗ ${label}: ${error.message ?? error}`); process.exit(1); } };
const ok = (m) => console.log(`  ✓ ${m}`);
const head = (m) => console.log(`\n── ${m} ${'─'.repeat(Math.max(0, 74 - m.length))}`);
async function one(label, q) { const { data, error } = await q; die(label, error); return data; }
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const chunk = (arr, n = 100) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
async function insertAll(table, rows, select = 'id') {
  const out = [];
  for (const part of chunk(rows)) out.push(...(await one(`insert ${table}`, db.from(table).insert(part).select(select))));
  return out;
}
async function pmap(items, fn, width = 6) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}

// SQL through the same dev-only runner the other fixtures use (`--dev` is explicit; there is no flag that points elsewhere).
const tmp = mkdtempSync(join(tmpdir(), 'prospect-demo-'));
process.on('exit', () => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ } });
let sqlN = 0;
function sql(text) {
  const file = join(tmp, `q${++sqlN}.sql`);
  writeFileSync(file, text);
  const out = execFileSync(process.execPath, [join(ROOT, 'scripts', 'db-query.mjs'), '--dev', '-f', file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: ROOT }).trim();
  return out ? JSON.parse(out) : [];
}

// ── the world, built purely ──────────────────────────────────────────────────────────────────────────────────────
const SAT0 = saturdayAfter(DEMO_DAY); // the coming Saturday: the first one strictly after the demo day
const world = buildWorld(cfg, DEMO_DAY);
const { regs, previous, prevDivs } = world;
const divCfg = Object.fromEntries(cfg.divisions.map(d => [d.code, d]));

head(`Prospect demo · ${cfg.name} (${SLUG}) · demo day ${DEMO_DAY} · coming Saturday ${SAT0}${DRY ? ' · DRY RUN (nothing is written)' : ''}`);
console.log(`  database: ${host} (dev)`);

// ── a small read of the organization and what it owns (for the dry run and the reset) ───────────────────────────
const existing = await one('find org', db.from('organizations').select('id, internal_notes').eq('slug', SLUG).maybeSingle());
if (existing && !String(existing.internal_notes ?? '').includes('seed-prospect-demo.mjs')) {
  console.error(`✗ Refusing to touch ${SLUG}: that organization was not made by this script (no marker in internal_notes).`);
  process.exit(1);
}
let ORG = existing?.id ?? null;

/** [table, column] pairs the reset deletes by organization id, in an order that respects the foreign keys. */
const RESET_TABLES = [
  ['notifications', 'org_id'],
  ['family_email_sends', 'org_id'], ['family_messages', 'org_id'], ['family_notes', 'org_id'], ['family_payment_handoffs', 'org_id'],
  ['family_coach_asks', 'org_id'], ['family_consents', 'org_id'], ['family_email_optouts', 'org_id'], ['family_invite_stops', 'org_id'],
  ['second_parent_stops', 'org_id'], ['family_invitations', 'org_id'], ['family_recap_views', 'org_id'], ['family_links', 'org_id'],
  ['game_change_notices', 'org_id'], ['league_email_log', 'org_id'], ['org_site_notices', 'org_id'], ['org_audit_log', 'org_id'],
  ['import_batches', 'org_id'],
  // the club schedule takes its slots, programs, uses, sends and hand-backs with it; the seasons take everything else
  ['club_schedules', 'org_id'], ['org_time_blocks', 'org_id'], ['org_time_dates_off', 'org_id'],
  // The season's fee WORDS (budget items named after the season, made by the money writer) and any club budget a walk made:
  // after the seasons, whose fee-word links they would otherwise be held by. Left behind they pile up, one "· 2" per rebuild.
  ['org_budget_lines', 'org_id'], ['budget_items', 'org_id'], ['budget_categories', 'org_id'],
];
/** Tables the reset leaves alone on purpose (the club itself). Everything else with an org_id must come back empty. */
const KEEP = new Set(['organizations', 'organization_members', 'org_public_site_content', 'org_venues', 'org_venue_facilities', 'notification_preferences', 'org_payment_accounts']);

async function ownedCounts() {
  const rows = sql(`select t.table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I where org_id = %L', t.table_name, ${q(ORG)}), false, true, '')))[1]::text::int as n
    from (select distinct c.table_name from information_schema.columns c join information_schema.tables x on x.table_name = c.table_name and x.table_schema = 'public' and x.table_type = 'BASE TABLE'
          where c.table_schema = 'public' and c.column_name = 'org_id') t order by 1`);
  return rows.filter(r => r.n > 0).map(r => [r.table_name, r.n]);
}

if (DRY) {
  head('Dry run');
  console.log(`  organization: ${ORG ? `exists (${ORG})` : 'does not exist yet — would be created, with branding, logo, contact details and venues'}`);
  if (ORG) {
    const held = await ownedCounts();
    console.log('  rows the Milton organization owns now:');
    for (const [t, n] of held) console.log(`    ${t.padEnd(36)} ${String(n).padStart(5)}${KEEP.has(t) ? '   (kept)' : '   (would be deleted and rebuilt)'}`);
  }
  console.log('\n  would build (counts are exact; this is the same builder the real run uses):');
  console.table(tally(world, cfg));
  console.log(`  previous season "${cfg.previous.name}": ${previous.length} registrations (${previous.filter(p => p.returningKey).length} are the same children as this season)`);
  const mine = (s) => regs.filter(r => r.status === s).length;
  console.log(`  ${regs.length} children (${mine('active')} accepted · ${mine('pending')} to review · ${mine('waitlisted')} waitlisted), ${new Set(regs.map(r => r.household)).size} households`);
  console.log(`  money lines: ${regs.filter(r => r.pay).length} receipts + ${previous.length} for the finished season, through club_league_money`);
  console.log('  would NOT touch: auth users, passwords, memberships (except a pending/walk-made +registrar one), org row, theme, logo, public-site content, venues.');
  for (const p of [cfg.people.owner, cfg.people.admin, cfg.people.coach]) console.log(`  account ${p.email}: ${(await findUserByEmail(db, p.email)) ? 'exists (password untouched)' : 'would be created (password set once)'}`);
  console.log('\nDry run done. Nothing was written.');
  process.exit(0);
}

// ── accounts: found, or made once (a password is set ONLY on creation) ───────────────────────────────────────────
head('Accounts');
async function account(email, name) {
  if (!cfg.password && !(await findUserByEmail(db, email))) { console.error(`✗ ${email} has to be created, and MILTON_DEMO_PASSWORD is not set in .env.local. Set it, then run this again.`); process.exit(1); }
  const { user, created } = await ensureFixtureUser(db, { email, password: cfg.password, userMetadata: { full_name: name }, resetPassword: false });
  ok(`${email} — ${created ? 'created (password set)' : 'already there (password untouched)'}`);
  return user;
}
const owner = await account(cfg.people.owner.email, cfg.people.owner.name);
const adminUser = await account(cfg.people.admin.email, cfg.people.admin.name);
const coachUsers = {}; // by key
coachUsers.coach = await account(cfg.people.coach.email, cfg.people.coach.name);
for (const d of cfg.divisions) for (const c of d.coaches ?? []) if (c.email) coachUsers[c.email] = await account(c.email, c.name);
const ADMIN = adminUser.id;
const OWNER = owner.id;

// ── the organization: made once with its look; left alone afterwards ────────────────────────────────────────────
head('Organization');
const nowIso = new Date().toISOString();
if (!ORG) {
  const org = await one('org', db.from('organizations').insert({
    name: cfg.name, slug: SLUG, plan_id: 'club', subscription_status: 'active', account_kind: 'organization',
    is_public: true, is_discoverable: false, tournament_limit: 9999, team_limit: 40, onboarding_completed_at: nowIso,
    theme_preset: cfg.branding.themePreset, theme_primary: cfg.branding.themePrimary, theme_accent: cfg.branding.themeAccent,
    internal_notes: cfg.marker,
  }).select('id').single());
  ORG = org.id;
  ok(`organization created ${ORG}`);
  // The placeholder logo, made the way the Look panel makes a stock one (white mark on a circle of the main colour).
  try {
    const sharp = (await import('sharp')).default;
    const art = readFileSync(join(ROOT, 'public', 'stock-logos', `${cfg.branding.stockLogoId}.svg`), 'utf8');
    const open = /<svg\b[^>]*>/.exec(art);
    const mark = art.slice(open.index + open[0].length, art.lastIndexOf('</svg>'));
    const inset = (64 * (1 - 0.66)) / 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${cfg.branding.themePrimary}"/>`
      + `<g transform="translate(${inset} ${inset}) scale(0.66)" fill="none">${mark}</g></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const { data: buckets } = await db.storage.listBuckets();
    if (!buckets?.some(b => b.name === 'org-logos')) die('logo bucket', (await db.storage.createBucket('org-logos', { public: true })).error);
    const path = `${ORG}/stock-${cfg.branding.stockLogoId}-${cfg.branding.themePrimary.slice(1).toLowerCase()}-${Date.now()}.png`;
    die('logo upload', (await db.storage.from('org-logos').upload(path, png, { contentType: 'image/png', upsert: true })).error);
    const logoUrl = db.storage.from('org-logos').getPublicUrl(path).data.publicUrl;
    die('logo save', (await db.from('organizations').update({ logo_url: logoUrl, logo_aspect: 1 }).eq('id', ORG)).error);
    ok('placeholder logo (stock softball diamond, Milton purple)');
  } catch (err) {
    console.warn(`  ⚠ The placeholder logo was not made (${err instanceof Error ? err.message : err}); the club shows its initials until one is picked in Public site › Look.`);
  }
} else {
  ok(`organization already there ${ORG} (name, plan, theme and logo left alone)`);
}

// Members: only the missing ones are added; an existing row (owner's, the admin's) is never edited.
const members = await one('members', db.from('organization_members').select('user_id, role, status').eq('organization_id', ORG));
const hasMember = (uid) => members.some(m => m.user_id === uid);
if (!hasMember(OWNER)) die('owner member', (await db.from('organization_members').insert({ organization_id: ORG, user_id: OWNER, role: 'owner', status: 'active', display_name: cfg.people.owner.name, title: cfg.people.owner.title, invited_at: nowIso, accepted_at: nowIso })).error);
// A club has ONE owner (the "owner's email" lookups read a single row). Another owner row here means the seat changed by
// hand — say so rather than silently demoting a real account.
const otherOwners = members.filter(m => m.role === 'owner' && m.user_id !== OWNER);
if (otherOwners.length) console.warn(`⚠ ${otherOwners.length} other Owner seat(s) in this club besides ${cfg.people.owner.email}. Owner-email lookups need exactly one; remove the extra seat.`);
if (!hasMember(ADMIN)) die('admin member', (await db.from('organization_members').insert({ organization_id: ORG, user_id: ADMIN, role: cfg.people.admin.role, status: 'active', display_name: cfg.people.admin.name, title: cfg.people.admin.title, invited_at: nowIso, accepted_at: nowIso })).error);
ok('members: owner (Owner) · League admin');

// Public-site content: made once; afterwards only a blank contact email / mailing address is filled so Publish is never blocked.
const site = await one('site', db.from('org_public_site_content').select('id, contact_email, mailing_address').eq('org_id', ORG).maybeSingle());
if (!site) {
  die('site content', (await db.from('org_public_site_content').insert({
    org_id: ORG, tagline: cfg.site.tagline, description: cfg.site.description, contact_email: cfg.site.contactEmail,
    mailing_address: cfg.site.mailingAddress, show_upcoming_tournaments: false, show_archives_link: false,
  })).error);
  ok('public site: tagline, about, contact email, mailing address');
} else if (!site.contact_email || !site.mailing_address) {
  die('site content fill', (await db.from('org_public_site_content').update({
    contact_email: site.contact_email || cfg.site.contactEmail, mailing_address: site.mailing_address || cfg.site.mailingAddress,
  }).eq('id', site.id)).error);
  ok('public site: blank contact email / mailing address filled');
} else ok('public site content already there (left alone)');

// Venues: found by name, or added (their ids stay the same across resets).
const venues = {};
for (const spec of cfg.venues) {
  let row = await one(`venue ${spec.name}`, db.from('org_venues').select('id, name, address').eq('org_id', ORG).eq('name', spec.name).maybeSingle());
  if (!row) row = await one(`add venue ${spec.name}`, db.from('org_venues').insert({ org_id: ORG, name: spec.name, address: spec.address, notes: spec.notes ?? null, is_active: true }).select('id, name, address').single());
  const facs = await one(`facilities ${spec.name}`, db.from('org_venue_facilities').select('id, name').eq('org_venue_id', row.id));
  const fac = Object.fromEntries((facs ?? []).map(f => [f.name, f.id]));
  for (const [i, name] of spec.facilities.entries()) {
    if (fac[name]) continue;
    fac[name] = (await one(`add ${spec.name} ${name}`, db.from('org_venue_facilities').insert({ org_venue_id: row.id, org_id: ORG, name, facility_type: 'diamond', display_order: i }).select('id').single())).id;
  }
  venues[spec.name] = { ...row, fac, houseLeague: spec.houseLeague };
}
ok(`venues: ${cfg.venues.map(v => `${v.name} (${v.facilities.length})`).join(' · ')}`);

// ══ RESET ════════════════════════════════════════════════════════════════════════════════════════════════════════
head('Reset — only rows the Milton organization owns');
const before = await ownedCounts();
// 1. Money first: the seasons' books (their lines have no foreign key to a registration), then the seasons (which cascade
//    divisions, teams, registrations, games, scores, notices, email rows, coaches, ratings, price changes, slot uses).
// 0. A test-card checkout in a walk leaves online payment rows whose lines point at the books below with NO ACTION, so they go
//    first (children before parents). The club's payment ACCOUNT (org_payment_accounts) is kept: it is the owner's Stripe test setup.
for (const table of ['online_payment_clear_decisions', 'online_payment_disputes', 'online_payment_refunds', 'online_payment_items', 'online_refunds_unassigned', 'online_payments']) {
  die(`delete ${table}`, (await db.from(table).delete().eq('org_id', ORG)).error);
}
die('delete season books', (await db.from('accounting_ledgers').delete().eq('org_id', ORG).eq('entity_type', 'league_season')).error);
die('delete seasons', (await db.from('league_seasons').delete().eq('org_id', ORG)).error);
// 2. Everything else the world and a live walk create, by organization id.
for (const [table, col] of RESET_TABLES) die(`delete ${table}`, (await db.from(table).delete().eq(col, ORG)).error);
// 3. Children and parents — but never one a rep roster or tryout (Phase B) still points at.
const keepChildren = new Set((await one('rep children', db.from('rep_roster_players').select('child_id').eq('org_id', ORG).not('child_id', 'is', null))).map(r => r.child_id));
for (const r of await one('tryout children', db.from('rep_tryout_registrations').select('child_id').eq('org_id', ORG).not('child_id', 'is', null))) keepChildren.add(r.child_id);
const children = (await one('children', db.from('org_children').select('id').eq('org_id', ORG))).map(r => r.id).filter(id => !keepChildren.has(id));
for (const part of chunk(children, 200)) die('delete children', (await db.from('org_children').delete().eq('org_id', ORG).in('id', part)).error);
const keepPeople = new Set((await one('rep people', db.from('rep_roster_players').select('person_id').eq('org_id', ORG).not('person_id', 'is', null))).map(r => r.person_id));
for (const r of await one('tryout people', db.from('rep_tryout_registrations').select('person_id').eq('org_id', ORG).not('person_id', 'is', null))) keepPeople.add(r.person_id);
const people = (await one('people', db.from('org_people').select('id').eq('org_id', ORG))).map(r => r.id).filter(id => !keepPeople.has(id));
for (const part of chunk(people, 200)) die('delete people', (await db.from('org_people').delete().eq('org_id', ORG).in('id', part)).error);
// 4. The pending registrar invitation (and the registrar membership Walk 5 makes) — memberships the seed did not make.
//    The auth users stay; only the invited-but-unaccepted rows and the +registrar seat are removed.
const seeded = new Set([OWNER, ADMIN]);
die('delete pending invitations', (await db.from('organization_members').delete().eq('organization_id', ORG).eq('status', 'invited')).error);
const registrar = await findUserByEmail(db, cfg.people.registrar.email);
if (registrar && !seeded.has(registrar.id)) die('delete registrar seat', (await db.from('organization_members').delete().eq('organization_id', ORG).eq('user_id', registrar.id)).error);
const after = await ownedCounts();
const stray = after.filter(([t]) => !KEEP.has(t));
ok(`deleted ${before.filter(([t]) => !KEEP.has(t)).reduce((s, [, n]) => s + n, 0)} rows in ${before.filter(([t]) => !KEEP.has(t)).length} tables; ${stray.length ? `STILL OWNED: ${stray.map(([t, n]) => `${t}=${n}`).join(', ')}` : 'nothing left but the club itself'}`);

// ══ BUILD ════════════════════════════════════════════════════════════════════════════════════════════════════════
head('Season, divisions, teams');
const S = cfg.season;
const season = await one('season', db.from('league_seasons').insert({
  org_id: ORG, name: S.name, slug: S.slug, sport: cfg.sport, status: 'registration_open', description: S.description,
  registration_fee: S.baseFee, auto_approve_under_capacity: true, auto_promote_waitlist: false,
  // The app stores these as the wall-clock time typed, with a literal Z (CreateLeagueSeasonDialog), and reads the first 16
  // characters back — so a real UTC instant would show as 1:00 p.m. / 4:59 a.m. and a day late. Same convention here.
  registration_open_at: `${addDays(DEMO_DAY, S.opensOffset)}T09:00:00Z`,
  registration_close_at: `${addDays(DEMO_DAY, S.closesOffset)}T23:59:00Z`,
  season_start_date: addDays(SAT0, -S.startsBeforeFirstSaturday), season_end_date: addDays(SAT0, S.endsAfterFirstSaturday),
  waiver_text: S.waiverText, early_bird_until: addDays(DEMO_DAY, S.earlyBirdOffset), how_to_pay: S.howToPay,
  ask_email_consent: true, owing_amber_days: S.owingAmberDays,
}).select('id').single());
const SEASON = season.id;
const divRows = await insertAll('league_divisions', cfg.divisions.map((d, i) => ({
  season_id: SEASON, name: d.code, capacity: d.capacity, sort_order: i, born_from_year: d.from, born_to_year: d.to,
  price: d.price, early_price: d.early, games_per_team: d.gamesPerTeam ?? null, show_standings: true,
})), 'id, name');
const DIV = Object.fromEntries(divRows.map(r => [r.name, r.id]));
const TEAM = {}; // code → [{id,name}]
for (const d of cfg.divisions) {
  if (!d.teams) continue;
  const rows = await insertAll('league_teams', d.teams.map(([name, color], i) => ({ season_id: SEASON, division_id: DIV[d.code], name, color, sort_order: i })), 'id, name, sort_order');
  TEAM[d.code] = rows.sort((a, b) => a.sort_order - b.sort_order);
}
ok(`season "${S.name}" · ${cfg.divisions.length} divisions · ${Object.values(TEAM).flat().length} teams (U9 not drafted; U11 and U15 drafted below)`);

// Coaches: signed in and accepted (a published team's coach), one real account per seat.
const coachRows = [];
const coachOf = {}; // team id → { userId, name }
for (const d of cfg.divisions) for (const c of d.coaches ?? []) {
  const person = c.who === 'coach' ? { name: cfg.people.coach.name, email: cfg.people.coach.email, user: coachUsers.coach } : { name: c.name, email: c.email, user: coachUsers[c.email] };
  const [first, ...rest] = person.name.split(' ');
  const team = TEAM[d.code][c.team];
  const publishedAt = addDays(DEMO_DAY, d.code === 'U11' ? -44 : -43);
  coachRows.push({ org_id: ORG, season_id: SEASON, team_id: team.id, name: person.name, first_name: first, last_name: rest.join(' '), email: person.email.toLowerCase(),
    user_id: person.user.id, invited_at: torontoInstant(addDays(publishedAt, -2), '19:00'), accepted_at: torontoInstant(addDays(publishedAt, -1), '20:15'), created_by: ADMIN, invited_by: ADMIN });
  coachOf[team.id] = { userId: person.user.id, name: person.name };
}
await insertAll('league_team_coaches', coachRows);
ok(`${coachRows.length} coach seats (accepted): ${cfg.people.coach.name} (the +coach account) coaches ${TEAM.U11[0].name}`);

// ── registrations ────────────────────────────────────────────────────────────────────────────────────────────────
head('Children and registrations');
const draft = {};
for (const code of ['U11', 'U15']) draft[code] = snakeDraft(regs.filter(r => r.div === code && r.status === 'active'), TEAM[code].length);
for (const r of regs) r.id = crypto.randomUUID();
await insertAll('league_registrations', regs.map(r => ({
  id: r.id, season_id: SEASON, org_id: ORG, division_id: DIV[r.div],
  player_first_name: r.first, player_last_name: r.last, player_date_of_birth: r.dob, player_position_pref: r.pos, player_notes: r.notes,
  guardian_first_name: r.guardian.first, guardian_last_name: r.guardian.last, guardian_email: r.guardian.email, guardian_phone: r.guardian.phone,
  status: r.status === 'pending' ? 'pending_review' : r.status, waitlist_position: r.waitPos,
  team_id: draft[r.div]?.has(r.key) ? TEAM[r.div][draft[r.div].get(r.key)].id : null,
  admin_notes: r.adminNotes, source: r.source, registered_at: r.registeredAt,
  waiver_accepted_at: r.source === 'public_form' ? r.registeredAt : null, fee_amount: r.fee, registration_fee_paid: false,
})), 'id');
// The accepted day (the trigger stamps "now" on an insert as accepted; the real day is the one the club accepted them).
const accepted = regs.filter(r => r.acceptedAt);
for (const part of chunk(accepted, 80)) {
  sql(`UPDATE league_registrations r SET accepted_at = v.t::timestamptz
       FROM (VALUES ${part.map(r => `(${q(r.id)}::uuid, ${q(r.acceptedAt)})`).join(', ')}) AS v(id, t)
       WHERE r.id = v.id AND r.org_id = ${q(ORG)};`);
}
const ratings = regs.filter(r => r.rating).map(r => ({ registration_id: r.id, org_id: ORG, season_id: SEASON, rating: r.rating, rated_by: ADMIN }));
await insertAll('league_player_ratings', ratings, 'registration_id');
const mix = (code) => { const m = regs.filter(r => r.div === code); return `${m.length} (${m.filter(r => r.status === 'active').length} accepted · ${m.filter(r => r.status === 'pending').length} to review · ${m.filter(r => r.status === 'waitlisted').length} waitlisted)`; };
ok(cfg.divisions.map(d => `${d.code} ${mix(d.code)}`).join('\n    '));
ok(`${ratings.length} ratings (U9 about three quarters; U11 and U15 all)`);

// ── money: through the one money writer ──────────────────────────────────────────────────────────────────────────
head('Money (club_league_money)');
const who = (a) => (a === 'owner' ? OWNER : ADMIN);
async function money(args, label) {
  const { data, error } = await db.rpc('club_league_money', {
    p_org: ORG, p_season: args.season ?? SEASON, p_registration: args.reg, p_action: args.action, p_amount: args.amount ?? null,
    p_day: args.day ?? null, p_method: args.method ?? null, p_reason: args.reason ?? null, p_actor: args.actor ?? ADMIN, p_entry: null,
  });
  die(`money ${label}`, error);
  const res = Array.isArray(data) ? data[0] : data;
  if (res?.refusal) die(`money ${label}`, { message: `refused: ${res.refusal}` });
}
const payers = regs.filter(r => r.pay);
await pmap(payers, (r) => money({ reg: r.id, action: 'receive', amount: r.fee, day: r.pay.day, method: r.pay.method, actor: who(r.pay.actor) }, `${r.first} ${r.last}`));
// the odd ones, in order (each acts on a registration that has just paid)
for (const r of regs.filter(x => x.special)) {
  const s = r.special;
  if (s.correctTo != null) await money({ reg: r.id, action: 'price', amount: s.correctTo, reason: s.reason, day: addDays(DEMO_DAY, -3), method: 'etransfer' }, 'corrected price');
  if (s.voided) {
    await money({ reg: r.id, action: 'undo', reason: 'Marked received by mistake: it was the sibling’s payment.', actor: ADMIN }, 'voided line');
    await money({ reg: r.id, action: 'receive', amount: r.fee, day: addDays(r.pay.day, 2), method: 'etransfer' }, 'paid again');
  }
  if (s.ended) {
    const { data, error } = await db.rpc('league_registration_close', {
      p_org: ORG, p_season: SEASON, p_registration: r.id, p_status: 'withdrawn', p_notes: 'Family moved out of town.', p_actor: ADMIN,
      p_promote: false, p_released: true, p_money: s.money, p_money_reason: s.moneyReason, p_day: addDays(DEMO_DAY, -4), p_method: 'etransfer',
    });
    die('end registration', error);
    const res = Array.isArray(data) ? data[0] : data;
    if (res?.refusal) die('end registration', { message: `refused: ${res.refusal}` });
  }
}
ok(`${payers.length} receipts · 1 corrected price (with its refund line) · 1 voided line (paid again) · 1 ended registration with a refund`);

// ── teams published (U11 and U15), through the real functions; then the history is dated and marked sent ─────────
head('Teams published (U11, U15)');
const T_TEAMS = { U11: addDays(DEMO_DAY, -44), U15: addDays(DEMO_DAY, -43) };
const T_SCHED = { U11: addDays(DEMO_DAY, -42), U15: addDays(DEMO_DAY, -41) };
async function rpcRow(fn, args, label) {
  const { data, error } = await db.rpc(fn, args);
  die(label, error);
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.refusal) die(label, { message: `refused: ${row.refusal}` });
  return row;
}
for (const code of ['U11', 'U15']) {
  const fp = (await db.rpc('league_division_fingerprint', { p_division: DIV[code] })).data;
  const res = await rpcRow('league_division_publish', { p_org: ORG, p_season: SEASON, p_division: DIV[code], p_actor: ADMIN, p_fingerprint: fp, p_coaches: [], p_hashes: [] }, `publish ${code}`);
  const t = torontoInstant(T_TEAMS[code], '19:40');
  sql(`UPDATE league_divisions SET teams_published_at = ${q(t)}, teams_published_by = ${q(ADMIN)} WHERE id = ${q(DIV[code])} AND season_id = ${q(SEASON)};
       UPDATE league_registrations SET told_at = ${q(t)} WHERE division_id = ${q(DIV[code])} AND org_id = ${q(ORG)} AND told_team_id IS NOT NULL;
       UPDATE league_season_notices SET created_at = ${q(t)}, reached_count = family_count WHERE division_id = ${q(DIV[code])} AND org_id = ${q(ORG)} AND kind = 'teams_published';
       UPDATE league_placement_emails SET status = 'sent', created_at = ${q(t)}, sent_at = ${q(minutesLater(t, 2))}, updated_at = ${q(minutesLater(t, 2))} WHERE division_id = ${q(DIV[code])} AND org_id = ${q(ORG)};`);
  ok(`${code} published ${T_TEAMS[code]} · ${res.families} family email(s) recorded as sent history (nothing was mailed)`);
}

// ── the club's field time, the games, the scores ─────────────────────────────────────────────────────────────────
head('Club schedule, games and scores');
const SC = cfg.schedule;
const firstGameSat = addDays(SAT0, -7 * SC.pastSaturdays);
const lastDay = addDays(SAT0, Math.max(7 * (SC.u11.saturdays - SC.pastSaturdays) , 7 * SC.open.saturdays, 7 * SC.open.weeknights) + 7);
const schedule = await one('club schedule', db.from('club_schedules').insert({
  org_id: ORG, name: SC.name, state: 'final', starts_on: firstGameSat, ends_on: lastDay,
  finalized_at: torontoInstant(addDays(DEMO_DAY, -50), '10:00'), finalized_by: ADMIN, sent_at: torontoInstant(addDays(DEMO_DAY, -50), '10:05'), sent_by: ADMIN,
  created_by: ADMIN, updated_by: ADMIN,
}).select('id').single());
const slotRows = [];
function addSlot(venueName, facilityName, day, start, end, use) {
  const v = venues[venueName];
  if (!v?.houseLeague) die('slot', { message: `${venueName} is not a house-league venue — house league never books there` });
  const id = crypto.randomUUID();
  slotRows.push({ id, org_id: ORG, schedule_id: schedule.id, org_venue_id: v.id, facility_id: v.fac[facilityName], starts_at: torontoInstant(day, start), ends_at: torontoInstant(day, end), use, venue: venueName, facility: facilityName });
  return id;
}
const addMin = (t, m) => { const [h, mi] = t.split(':').map(Number); const total = h * 60 + mi + m; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; };

// U11: two games a Saturday on one diamond; the rotation A-B/C-D, A-C/B-D, A-D/B-C; the home side alternates.
const ROT = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]];
const games = []; // { div, home, away, day, start, slotId, venue, facility, result, tag }
const u11 = SC.u11;
for (let k = 0; k < u11.saturdays; k++) {
  const day = addDays(SAT0, 7 * (k - SC.pastSaturdays));
  const slotId = addSlot(u11.venue, u11.facility, day, u11.start, addMin(u11.start, u11.slotMinutes), { div: 'U11', kind: 'games' });
  ROT[k % 3].forEach(([a, b], g) => {
    const flip = k % 2 === 1;
    games.push({ div: 'U11', k, g, home: flip ? b : a, away: flip ? a : b, day, start: addMin(u11.start, g * u11.gameMinutes), minutes: u11.gameMinutes, slotId, venue: u11.venue, facility: u11.facility });
  });
}
const u15 = SC.u15;
for (let k = 0; k < u15.saturdays; k++) {
  const day = addDays(SAT0, 7 * (k - u15.pastSaturdays));
  const slotId = addSlot(u15.venue, u15.facility, day, u15.start, addMin(u15.start, u15.slotMinutes), { div: 'U15', kind: 'games' });
  games.push({ div: 'U15', k, g: 0, home: k % 2, away: (k + 1) % 2, day, start: u15.start, minutes: u15.gameMinutes, slotId, venue: u15.venue, facility: u15.facility });
}
// Field time offered to house league and not yet given to a division (what the U9 walk gives out).
let openCount = 0;
for (let w = 0; w < SC.open.saturdays; w++) for (const row of SC.open.saturdayRows) { addSlot(row.venue, row.facility, addDays(SAT0, 7 * w), row.start, row.end, null); openCount++; }
for (let w = 0; w < SC.open.weeknights; w++) for (const row of SC.open.weeknightRows) { addSlot(row.venue, row.facility, onOrAfter(addDays(SAT0, 7 * w + 1), row.dow), row.start, row.end, null); openCount++; }

await insertAll('club_schedule_slots', slotRows.map(s => ({ id: s.id, org_id: s.org_id, schedule_id: s.schedule_id, org_venue_id: s.org_venue_id, facility_id: s.facility_id, starts_at: s.starts_at, ends_at: s.ends_at })), 'id');
await insertAll('club_schedule_slot_programs', slotRows.map(s => ({ slot_id: s.id, org_id: ORG, program: 'house_league' })), 'slot_id');
await insertAll('league_slot_uses', slotRows.filter(s => s.use).map(s => ({ slot_id: s.id, org_id: ORG, season_id: SEASON, division_id: DIV[s.use.div], kind: s.use.kind, created_by: ADMIN })), 'slot_id');
ok(`club schedule "${SC.name}" (final): ${slotRows.length} slots on house-league diamonds — ${slotRows.filter(s => s.use).length} given to U11/U15 games, ${openCount} offered and not yet given (Saturdays heavy, some weeknights); none on Sherwood Park`);

// Scores: U11's first five Saturdays and U15's first two; two of U11's wait in "Scores to check".
const u11Past = games.filter(g => g.div === 'U11' && g.k < SC.pastSaturdays).sort((a, b) => a.k - b.k || a.g - b.g);
u11Past.forEach((g, i) => { g.result = cfg.u11Results[i]; g.n = i; });
const u15Past = games.filter(g => g.div === 'U15' && g.k < u15.pastSaturdays).sort((a, b) => a.k - b.k);
u15Past.forEach((g, i) => { g.result = cfg.u15Results[i]; g.n = i; });
const gameRows = games.map(g => {
  const start = torontoInstant(g.day, g.start);
  const v = venues[g.venue];
  g.id = crypto.randomUUID();
  g.startIso = start;
  return {
    id: g.id, org_id: ORG, season_id: SEASON, division_id: DIV[g.div], home_team_id: TEAM[g.div][g.home].id, away_team_id: TEAM[g.div][g.away].id,
    scheduled_at: start, ends_at: minutesLater(start, g.minutes), org_venue_id: v.id, org_venue_facility_id: v.fac[g.facility],
    location: `${g.venue} · ${g.facility}`, slot_use_id: g.slotId, status: g.result ? 'completed' : 'scheduled',
    home_score: g.result ? g.result[0] : null, away_score: g.result ? g.result[1] : null,
  };
});
await insertAll('league_games', gameRows, 'id');
const adminName = cfg.people.admin.name;
const scoreRows = [];
for (const g of [...u11Past, ...u15Past]) {
  const homeTeam = TEAM[g.div][g.home];
  const end = minutesLater(g.startIso, g.minutes);
  const row = { game_id: g.id, org_id: ORG, season_id: SEASON };
  const tc = g.div === 'U11' ? cfg.u11ToCheck : null;
  const coach = coachOf[homeTeam.id];
  if (tc && g.n === tc.coachEntered && coach) {
    scoreRows.push({ ...row, entered_side: 'coach', entered_by: coach.userId, entered_by_name: coach.name, entered_for_team: homeTeam.id, entered_at: minutesLater(end, 25) });
  } else if (tc && g.n === tc.reported && coach) {
    const awayCoach = coachOf[TEAM[g.div][g.away].id];
    scoreRows.push({ ...row, entered_side: 'coach', entered_by: coach.userId, entered_by_name: coach.name, entered_for_team: homeTeam.id, entered_at: minutesLater(end, 20),
      reported_by: awayCoach?.userId ?? null, reported_by_name: awayCoach?.name ?? 'Away coach', reported_for_team: TEAM[g.div][g.away].id, reported_at: minutesLater(end, 95), report_note: tc.reportNote });
  } else if (g.div === 'U11' && cfg.u11Checked.includes(g.n) && coach) {
    scoreRows.push({ ...row, entered_side: 'coach', entered_by: coach.userId, entered_by_name: coach.name, entered_for_team: homeTeam.id, entered_at: minutesLater(end, 30),
      checked_by: ADMIN, checked_by_name: adminName, checked_at: minutesLater(end, 60 * 20) });
  } else {
    scoreRows.push({ ...row, entered_side: 'club', entered_by: ADMIN, entered_by_name: adminName, entered_at: minutesLater(end, 150) });
  }
}
await insertAll('league_game_scores', scoreRows, 'game_id');
const toCheck = scoreRows.filter(r => r.entered_side === 'coach' && !r.checked_at);
ok(`U11: ${games.filter(g => g.div === 'U11').length} games (${u11Past.length} scored, 2 ties) · coming Saturday ${SAT0} unscored · ${toCheck.length} waiting in Scores to check (${toCheck.filter(r => r.reported_at).length} Reported, ${toCheck.filter(r => !r.reported_at).length} Coach entered)`);
ok(`U15: ${games.filter(g => g.div === 'U15').length} games (${u15Past.length} scored) · coming Saturday ${SAT0}`);

// Schedules published, through the real function; then dated, and the family rows marked sent.
for (const code of ['U11', 'U15']) {
  const n = games.filter(g => g.div === code).length;
  const res = await rpcRow('league_division_schedule_publish', { p_org: ORG, p_season: SEASON, p_division: DIV[code], p_actor: ADMIN, p_games: n }, `publish schedule ${code}`);
  const t = torontoInstant(T_SCHED[code], '20:05');
  sql(`UPDATE league_divisions SET schedule_published_at = ${q(t)} WHERE id = ${q(DIV[code])} AND season_id = ${q(SEASON)};
       UPDATE league_season_notices SET created_at = ${q(t)}, reached_count = family_count WHERE division_id = ${q(DIV[code])} AND org_id = ${q(ORG)} AND kind = 'schedule_published';
       UPDATE league_schedule_emails SET status = 'sent', created_at = ${q(t)}, updated_at = ${q(minutesLater(t, 2))} WHERE division_id = ${q(DIV[code])} AND org_id = ${q(ORG)};`);
  ok(`${code} schedule published ${T_SCHED[code]} · ${res.families} family email(s) recorded as sent history`);
}

// A typed Email-families send in the history (a row only; no mail).
const welcomeAt = torontoInstant(addDays(DEMO_DAY, -58), '10:30');
const familyCount = new Set(regs.filter(r => r.status === 'active').map(r => r.household)).size;
die('welcome email history', (await db.from('family_email_sends').insert({
  org_id: ORG, sent_by: ADMIN, sent_at: welcomeAt, subject: cfg.welcomeEmail.subject, body: cfg.welcomeEmail.body, audience_kind: 'season',
  audience_label: `Everyone in ${S.name}`, season_id: SEASON, family_count: familyCount, opted_out_count: 0, reached_count: familyCount, failed_count: 0, coach_count: 0, status: 'done',
})).error);
ok('Email families history: one Welcome send (a row only; nothing mailed)');

// ── the finished previous season ─────────────────────────────────────────────────────────────────────────────────
head('Previous season');
const P = cfg.previous;
const pSeason = await one('previous season', db.from('league_seasons').insert({
  org_id: ORG, name: P.name, slug: P.slug, sport: cfg.sport, status: 'registration_closed', description: 'Last summer’s house league.',
  registration_fee: 135, season_start_date: addDays(DEMO_DAY, P.firstSaturdayOffset - 3), season_end_date: addDays(DEMO_DAY, P.firstSaturdayOffset + 7 * P.games + 14),
  registration_open_at: torontoInstant(addDays(DEMO_DAY, -420), '09:00'), registration_close_at: torontoInstant(addDays(DEMO_DAY, -370), '23:59'),
  waiver_text: S.waiverText, ask_email_consent: true, owing_amber_days: 14,
}).select('id').single());
const PDIV = {}; const PTEAM = {};
for (const [i, d] of prevDivs.entries()) {
  PDIV[d.code] = (await one('prev div', db.from('league_divisions').insert({ season_id: pSeason.id, name: d.code, capacity: d.capacity, sort_order: i, born_from_year: d.from, born_to_year: d.to, price: d.price, show_standings: true }).select('id').single())).id;
  PTEAM[d.code] = (await insertAll('league_teams', d.teams.map(([name, color], j) => ({ season_id: pSeason.id, division_id: PDIV[d.code], name, color, sort_order: j })), 'id, sort_order')).sort((a, b) => a.sort_order - b.sort_order);
}
const childOf = new Map((await one('current children', db.from('league_registrations').select('id, child_id').eq('season_id', SEASON))).map(r => [r.id, r.child_id]));
const regById = new Map(regs.map(r => [r.key, r]));
for (const p of previous) p.id = crypto.randomUUID();
await insertAll('league_registrations', previous.map(p => ({
  id: p.id, season_id: pSeason.id, org_id: ORG, division_id: PDIV[p.div], child_id: p.returningKey ? childOf.get(regById.get(p.returningKey).id) : undefined,
  player_first_name: p.first, player_last_name: p.last, player_date_of_birth: p.dob,
  guardian_first_name: p.guardian.first, guardian_last_name: p.guardian.last, guardian_email: p.guardian.email, guardian_phone: p.guardian.phone,
  status: 'active', team_id: PTEAM[p.div][p.team].id, source: 'public_form', registered_at: p.registeredAt, waiver_accepted_at: p.registeredAt, fee_amount: p.fee,
})), 'id');
await pmap(previous, (p) => money({ season: pSeason.id, reg: p.id, action: 'receive', amount: p.fee, day: p.pay.day, method: p.pay.method, actor: ADMIN }, `previous ${p.first}`));
// games: round robin through six Saturdays, every one scored
const prng = mulberry32(cfg.seed + 7);
const pFirst = onOrAfter(addDays(DEMO_DAY, P.firstSaturdayOffset), 6);
const pGames = [];
for (const d of prevDivs) {
  const ts = PTEAM[d.code];
  for (let w = 0; w < P.games; w++) {
    const day = addDays(pFirst, 7 * w);
    const pairs = ts.length === 2 ? [[0, 1]] : [[(w) % 3, (w + 1) % 3]];
    pairs.forEach(([a, b], g) => {
      const home = w % 2 ? b : a; const away = w % 2 ? a : b;
      const start = torontoInstant(day, d.code === 'U9' ? '09:00' : '10:45');
      pGames.push({ season_id: pSeason.id, org_id: ORG, division_id: PDIV[d.code], home_team_id: ts[home].id, away_team_id: ts[away].id, scheduled_at: start,
        ends_at: minutesLater(start, 90), org_venue_id: venues['Lions Park'].id, org_venue_facility_id: venues['Lions Park'].fac['Diamond 1'], location: 'Lions Park · Diamond 1',
        status: 'completed', home_score: 2 + Math.floor(prng() * 11), away_score: 2 + Math.floor(prng() * 11) });
      void g;
    });
  }
}
const pg = await insertAll('league_games', pGames, 'id');
await insertAll('league_game_scores', pg.map(g => ({ game_id: g.id, org_id: ORG, season_id: pSeason.id, entered_side: 'club', entered_by: ADMIN, entered_by_name: adminName, entered_at: minutesLater(pFirst, 0) })).map(r => ({ ...r, entered_at: torontoInstant(pFirst, '15:00') })), 'game_id');
sql(`UPDATE league_divisions SET teams_published_at = ${q(torontoInstant(addDays(pFirst, -25), '19:00'))}, teams_published_by = ${q(ADMIN)},
       schedule_published_at = ${q(torontoInstant(addDays(pFirst, -23), '19:00'))}, schedule_published_by = ${q(ADMIN)} WHERE season_id = ${q(pSeason.id)};
     UPDATE league_seasons SET status = 'completed' WHERE id = ${q(pSeason.id)} AND org_id = ${q(ORG)};
     UPDATE league_seasons SET finished_at = ${q(torontoInstant(addDays(pFirst, 7 * P.games + 10), '12:00'))} WHERE id = ${q(pSeason.id)} AND org_id = ${q(ORG)};`);
ok(`"${P.name}" completed: ${previous.length} registrations (${previous.filter(p => p.returningKey).length} the same children as this season), ${pGames.length} scored games, all paid`);

// ── people, last ─────────────────────────────────────────────────────────────────────────────────────────────────
die('families attach', (await db.rpc('families_attach_people', { p_org_id: ORG })).error);
ok('Families: parents and children attached');

// ── the report ───────────────────────────────────────────────────────────────────────────────────────────────────
head('Done');
const counts = sql(`SELECT d.name AS division, count(*) FILTER (WHERE r.status = 'active') AS accepted, count(*) FILTER (WHERE r.status = 'pending_review') AS to_review,
    count(*) FILTER (WHERE r.status = 'waitlisted') AS waitlisted, count(*) FILTER (WHERE r.status IN ('declined','withdrawn')) AS ended,
    count(*) FILTER (WHERE r.team_id IS NOT NULL) AS on_a_team, count(*) FILTER (WHERE r.registration_fee_paid) AS paid,
    count(*) AS total, d.teams_published_at IS NOT NULL AS teams_published, d.schedule_published_at IS NOT NULL AS schedule_published,
    (SELECT count(*) FROM league_games g WHERE g.division_id = d.id) AS games
  FROM league_divisions d JOIN league_seasons s ON s.id = d.season_id LEFT JOIN league_registrations r ON r.division_id = d.id
  WHERE s.org_id = ${q(ORG)} AND s.id = ${q(SEASON)} GROUP BY d.id, d.name, d.sort_order, d.teams_published_at, d.schedule_published_at ORDER BY d.sort_order;`);
console.table(counts);
const totals = sql(`SELECT (SELECT count(*) FROM league_registrations WHERE org_id = ${q(ORG)}) AS registrations,
    (SELECT count(*) FROM org_children WHERE org_id = ${q(ORG)}) AS children,
    (SELECT count(*) FROM org_people WHERE org_id = ${q(ORG)}) AS parents,
    (SELECT count(*) FROM league_games WHERE org_id = ${q(ORG)}) AS games,
    (SELECT count(*) FROM league_game_scores WHERE org_id = ${q(ORG)}) AS score_records,
    (SELECT count(*) FROM accounting_entries e JOIN accounting_ledgers l ON l.id = e.ledger_id WHERE l.org_id = ${q(ORG)}) AS money_lines,
    (SELECT count(*) FROM club_schedule_slots WHERE org_id = ${q(ORG)}) AS slots,
    (SELECT count(*) FROM league_player_ratings WHERE org_id = ${q(ORG)}) AS ratings,
    (SELECT count(*) FROM league_season_notices WHERE org_id = ${q(ORG)}) AS notices`)[0];
console.log('  totals:', JSON.stringify(totals));
console.log(`\n  Club:   http://localhost:3000/${SLUG}/admin    public: http://localhost:3000/${SLUG}   league: http://localhost:3000/${SLUG}/league`);
console.log(`  Sign in: ${cfg.people.owner.email} (Owner) · ${cfg.people.admin.email} (League admin) · ${cfg.people.coach.email} (coach, ${TEAM.U11[0].name}) — the password is MILTON_DEMO_PASSWORD in .env.local`);
console.log(`  ${cfg.people.parent.email} is the guardian contact of Ella (U9) and Owen (U11) — no account is made; the family-app invitation creates it.`);
console.log('  ⚠ Dev-only world. Reset any time: npm run demo:milton:reset');
