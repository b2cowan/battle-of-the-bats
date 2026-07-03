/**
 * mirror-battle-of-the-bats.mjs
 *
 * Copies the PRODUCTION "Battle of the Bats" tournament subtree into the DEV
 * database so the public fan pages can be tested like-for-like. Read-only on prod;
 * writes only to dev. Idempotent (deletes any prior copy of this exact org +
 * tournament first, then re-inserts). Same UUIDs + slugs as prod, so the dev URL is
 * /milton-softball-organization/battle-of-the-bats (matching prod).
 *
 * SCOPE: organizations, tournaments, divisions, teams, games. No brackets table
 * exists (bracket_id is a soft label). Facilities/venues/slots are NOT copied — the
 * facility FKs on games are nulled and the free-text `location` is kept, so the
 * schedule still shows the venue name without dragging in the facility subtree.
 *
 * PII IS STRIPPED: coach names/emails, contact emails, admin/check-in notes,
 * score-submitter identity, and Stripe/billing fields are all nulled.
 *
 * Usage:
 *   node scripts/mirror-battle-of-the-bats.mjs            # apply to dev
 *   node scripts/mirror-battle-of-the-bats.mjs --dry-run  # print SQL only
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('='); if (eq === -1) continue;
  const k = t.slice(0, eq).trim(); const v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set'); process.exit(1); }

const DEV = 'npgnrxaitgbtbtvvykto';
const PROD = 'qcttcboqysynwcdyghil';
const ORG_ID = '42871b5b-5f96-44ab-afac-6f9ede1cdaed';
const TOURNAMENT_ID = '7ab0c79e-f29a-4512-9ac1-16aa661b324d';
const DRY_RUN = process.argv.includes('--dry-run');

function apiQuery(ref, query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${ref}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', reject); req.write(body); req.end();
  });
}
async function selectProd(sql) {
  const r = await apiQuery(PROD, sql);
  if (r.status < 200 || r.status >= 300) throw new Error(`prod query failed ${r.status}: ${r.body.slice(0, 400)}`);
  return JSON.parse(r.body);
}

// Columns to null out on the dev copy (PII / billing / facility FKs).
const NULL_COLS = {
  organizations: new Set(['stripe_customer_id', 'stripe_subscription_id', 'internal_notes', 'billing_suspended_at', 'billing_suspension_reason', 'subscription_period', 'current_period_end', 'rep_team_subscription_item_id']),
  tournaments: new Set(['contact_email', 'default_contact_member_id']),
  divisions: new Set(['contact_member_id']),
  // Venue subtree IS copied now (so venue labels resolve live like prod). Drop only
  // the pointers back into the org-level facility library.
  diamonds: new Set(['source_org_venue_id']),
  venue_facilities: new Set(['source_org_facility_id']),
  teams: new Set(['coach', 'email', 'coach_email', 'admin_notes', 'check_in_notes', 'checked_in_by_name', 'checked_in_by_user_id', 'slot_id']),
  // Keep diamond_id + venue_facility_id (the venue rows are copied above). Still drop
  // schedule lanes/slots (not copied) + score-submitter PII.
  games: new Set(['schedule_facility_lane_id', 'home_slot_id', 'away_slot_id', 'score_submitted_by_user_id', 'score_submitted_by_email']),
};
const JSONB_COLS = {
  organizations: new Set(['enabled_addons', 'pdf_settings', 'coach_settings']),
  tournaments: new Set(['settings', 'public_hidden_pages']),
  divisions: new Set(['pool_names', 'playoff_config', 'settings']),
  diamonds: new Set(),
  venue_facilities: new Set(['settings']),
  teams: new Set(),
  games: new Set(),
};

function lit(val, isJsonb) {
  if (val === null || val === undefined) return 'NULL';
  if (isJsonb) return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  return `'${String(val).replace(/'/g, "''")}'`;
}
function insertOf(table, row) {
  const nulls = NULL_COLS[table]; const jsonb = JSONB_COLS[table];
  const cols = Object.keys(row);
  const vals = cols.map(c => (nulls.has(c) ? 'NULL' : lit(row[c], jsonb.has(c))));
  return `insert into public.${table} (${cols.map(c => `"${c}"`).join(', ')}) values (${vals.join(', ')});`;
}

const org = (await selectProd(`select * from organizations where id='${ORG_ID}';`))[0];
const tournament = (await selectProd(`select * from tournaments where id='${TOURNAMENT_ID}';`))[0];
const divisions = await selectProd(`select * from divisions where tournament_id='${TOURNAMENT_ID}';`);
const diamonds = await selectProd(`select * from diamonds where tournament_id='${TOURNAMENT_ID}';`);
const venueFacilities = await selectProd(`select * from venue_facilities where tournament_id='${TOURNAMENT_ID}';`);
const teams = await selectProd(`select * from teams where tournament_id='${TOURNAMENT_ID}';`);
const games = await selectProd(`select * from games where tournament_id='${TOURNAMENT_ID}';`);

if (!org || !tournament) { console.error('Could not read org/tournament from prod'); process.exit(1); }

const statements = [
  'begin;',
  `delete from public.games where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.venue_facilities where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.diamonds where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.teams where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.divisions where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.tournaments where id='${TOURNAMENT_ID}';`,
  `delete from public.organizations where id='${ORG_ID}';`,
  insertOf('organizations', org),
  insertOf('tournaments', tournament),
  ...divisions.map(d => insertOf('divisions', d)),
  ...diamonds.map(d => insertOf('diamonds', d)),
  ...venueFacilities.map(f => insertOf('venue_facilities', f)),
  ...teams.map(t => insertOf('teams', t)),
  ...games.map(g => insertOf('games', g)),
  'commit;',
];
const sql = statements.join('\n');

console.log(`Read from prod: 1 org, 1 tournament, ${divisions.length} division(s), ${diamonds.length} venue(s), ${venueFacilities.length} facilit(ies), ${teams.length} team(s), ${games.length} game(s).`);
if (DRY_RUN) { console.log('\n----- SQL (dry run, not applied) -----\n'); console.log(sql); process.exit(0); }

const res = await apiQuery(DEV, sql);
if (res.status >= 200 && res.status < 300) {
  console.log('✅ Applied to DEV.');
  const check = await apiQuery(DEV, `select (select count(*) from teams where tournament_id='${TOURNAMENT_ID}') teams, (select count(*) from games where tournament_id='${TOURNAMENT_ID}') games, (select slug from organizations where id='${ORG_ID}') org_slug, (select slug from tournaments where id='${TOURNAMENT_ID}') tslug;`);
  console.log('Verify (dev):', check.body);
} else {
  console.error(`❌ Apply to dev failed (HTTP ${res.status}): ${res.body.slice(0, 800)}`);
  process.exit(1);
}
