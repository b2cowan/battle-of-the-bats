/**
 * mirror-tournament.mjs
 *
 * Copies ONE production tournament subtree into the DEV database so it can be
 * tested like-for-like. Read-only on prod; writes only to dev.
 *
 * Generalizes mirror-battle-of-the-bats.mjs with two important safety changes:
 *   1. The org row is UPSERTED with `on conflict (id) do nothing` — it is never
 *      deleted. This is required now that the Milton org holds more than one
 *      tournament in dev: deleting the org would cascade-wipe the others.
 *   2. The `pools` table IS copied (the older script predates manual pool
 *      assignment and skipped it, which left mirrored divisions with no pools).
 *
 * Only the target tournament's subtree is delete+reinserted (idempotent). Same
 * UUIDs + slugs as prod, so dev URLs match prod.
 *
 * SCOPE: organizations (insert-if-missing), tournaments, divisions, pools,
 * diamonds, venue_facilities, teams, games. Schedule lanes/slots are NOT copied
 * (FKs nulled). PII stripped: coach names/emails, contact emails, admin/check-in
 * notes, score-submitter identity, Stripe/billing fields.
 *
 * Usage:
 *   node scripts/mirror-tournament.mjs --tournament <uuid> [--org <uuid>] [--dry-run]
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

const argv = process.argv.slice(2);
let TOURNAMENT_ID = null;
let ORG_ID = null;
const DRY_RUN = argv.includes('--dry-run');
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--tournament') TOURNAMENT_ID = argv[++i];
  else if (argv[i] === '--org') ORG_ID = argv[++i];
}
if (!TOURNAMENT_ID) { console.error('Provide --tournament <uuid>'); process.exit(1); }

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

// Columns to null out on the dev copy (PII / billing / facility FKs / schedule slots).
const NULL_COLS = {
  organizations: new Set(['stripe_customer_id', 'stripe_subscription_id', 'internal_notes', 'billing_suspended_at', 'billing_suspension_reason', 'subscription_period', 'current_period_end', 'rep_team_subscription_item_id']),
  tournaments: new Set(['contact_email', 'default_contact_member_id']),
  divisions: new Set(['contact_member_id']),
  pools: new Set(),
  diamonds: new Set(['source_org_venue_id']),
  venue_facilities: new Set(['source_org_facility_id']),
  teams: new Set(['coach', 'email', 'coach_email', 'admin_notes', 'check_in_notes', 'checked_in_by_name', 'checked_in_by_user_id', 'slot_id']),
  games: new Set(['schedule_facility_lane_id', 'home_slot_id', 'away_slot_id', 'score_submitted_by_user_id', 'score_submitted_by_email']),
};
const JSONB_COLS = {
  organizations: new Set(['enabled_addons', 'pdf_settings', 'coach_settings']),
  tournaments: new Set(['settings', 'public_hidden_pages']),
  // NB: pool_names is a TEXT column (comma-joined string), NOT jsonb — casting it
  // to jsonb wraps the value in quotes and corrupts the pool labels.
  divisions: new Set(['playoff_config', 'settings']),
  pools: new Set(['settings']),
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
function insertOf(table, row, { onConflictDoNothing = false } = {}) {
  const nulls = NULL_COLS[table]; const jsonb = JSONB_COLS[table];
  const cols = Object.keys(row);
  const vals = cols.map(c => (nulls.has(c) ? 'NULL' : lit(row[c], jsonb.has(c))));
  const tail = onConflictDoNothing ? ' on conflict (id) do nothing' : '';
  return `insert into public.${table} (${cols.map(c => `"${c}"`).join(', ')}) values (${vals.join(', ')})${tail};`;
}

const tournament = (await selectProd(`select * from tournaments where id='${TOURNAMENT_ID}';`))[0];
if (!tournament) { console.error(`Tournament ${TOURNAMENT_ID} not found on prod`); process.exit(1); }
ORG_ID = ORG_ID || tournament.org_id;
const org = (await selectProd(`select * from organizations where id='${ORG_ID}';`))[0];
if (!org) { console.error(`Org ${ORG_ID} not found on prod`); process.exit(1); }

const divisions = await selectProd(`select * from divisions where tournament_id='${TOURNAMENT_ID}';`);
const divIds = divisions.map(d => `'${d.id}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`;
const pools = await selectProd(`select * from pools where division_id in (${divIds});`);
const diamonds = await selectProd(`select * from diamonds where tournament_id='${TOURNAMENT_ID}';`);
const venueFacilities = await selectProd(`select * from venue_facilities where tournament_id='${TOURNAMENT_ID}';`);
const teams = await selectProd(`select * from teams where tournament_id='${TOURNAMENT_ID}';`);
const games = await selectProd(`select * from games where tournament_id='${TOURNAMENT_ID}';`);

const statements = [
  'begin;',
  // Delete only THIS tournament's subtree (children first). The org row is left alone.
  `delete from public.games where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.teams where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.pools where division_id in (${divIds});`,
  `delete from public.venue_facilities where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.diamonds where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.divisions where tournament_id='${TOURNAMENT_ID}';`,
  `delete from public.tournaments where id='${TOURNAMENT_ID}';`,
  // Ensure the org exists WITHOUT disturbing an existing dev copy (no cascade).
  insertOf('organizations', org, { onConflictDoNothing: true }),
  insertOf('tournaments', tournament),
  ...divisions.map(d => insertOf('divisions', d)),
  ...pools.map(p => insertOf('pools', p)),
  ...diamonds.map(d => insertOf('diamonds', d)),
  ...venueFacilities.map(f => insertOf('venue_facilities', f)),
  ...teams.map(t => insertOf('teams', t)),
  ...games.map(g => insertOf('games', g)),
  'commit;',
];
const sql = statements.join('\n');

console.log(`Read from prod: org "${org.name}", tournament "${tournament.name}", ${divisions.length} division(s), ${pools.length} pool(s), ${diamonds.length} venue(s), ${venueFacilities.length} facilit(ies), ${teams.length} team(s), ${games.length} game(s).`);
if (DRY_RUN) { console.log('\n----- SQL (dry run, not applied) -----\n'); console.log(sql); process.exit(0); }

const res = await apiQuery(DEV, sql);
if (res.status >= 200 && res.status < 300) {
  console.log('✅ Applied to DEV.');
  const check = await apiQuery(DEV, `select (select count(*) from teams where tournament_id='${TOURNAMENT_ID}') teams, (select count(*) from pools where division_id in (${divIds})) pools, (select count(*) from games where tournament_id='${TOURNAMENT_ID}') games, (select slug from organizations where id='${ORG_ID}') org_slug, (select slug from tournaments where id='${TOURNAMENT_ID}') tslug;`);
  console.log('Verify (dev):', check.body);
} else {
  console.error(`❌ Apply to dev failed (HTTP ${res.status}): ${res.body.slice(0, 800)}`);
  process.exit(1);
}
