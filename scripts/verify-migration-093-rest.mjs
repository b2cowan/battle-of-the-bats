/**
 * REST-level verifier for Migration 093.
 *
 * This uses Supabase PostgREST credentials from an env file, so it works when
 * direct Postgres/Supavisor credentials are unavailable.
 *
 * Usage:
 *   node scripts/verify-migration-093-rest.mjs --env .env.local
 *   node scripts/verify-migration-093-rest.mjs --env .env.production.local
 */

import dotenv from 'dotenv';

const envArgIndex = process.argv.indexOf('--env');
const envPath = envArgIndex >= 0 ? process.argv[envArgIndex + 1] : '.env.local';
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !key) {
  console.error(`Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in ${envPath}`);
  process.exit(1);
}

const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;

async function get(path) {
  const response = await fetch(`${restUrl}${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { ok: response.ok, status: response.status, body };
}

async function post(path, payload) {
  const response = await fetch(`${restUrl}${path}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { ok: response.ok, status: response.status, body };
}

async function expectAvailable(checkId, description, table, column) {
  const result = await get(`/${table}?select=${column}&limit=1`);
  return {
    check_id: checkId,
    description,
    status: result.ok ? 'PASS' : `FAIL - ${table}.${column} is not available`,
  };
}

async function expectUnavailable(checkId, description, table, column) {
  const result = await get(`/${table}?select=${column}&limit=1`);
  return {
    check_id: checkId,
    description,
    status: result.ok ? `FAIL - ${table}.${column} is still available` : 'PASS',
  };
}

async function expectRpcOk(checkId, description, rpcName, payload) {
  const result = await post(`/rpc/${rpcName}`, payload);
  return {
    check_id: checkId,
    description,
    status: result.ok ? 'PASS' : `FAIL - ${rpcName} returned HTTP ${result.status}`,
  };
}

const checks = [];
const emptyUuid = '00000000-0000-0000-0000-000000000000';

checks.push(await expectAvailable('093-01', 'divisions table is available', 'divisions', 'id'));
checks.push(await expectUnavailable('093-02', 'legacy age_groups table is unavailable', 'age_groups', 'id'));

for (const table of ['pools', 'teams', 'pool_slots', 'games']) {
  checks.push(await expectAvailable(`093-new-${table}`, `${table}.division_id is available`, table, 'division_id'));
  checks.push(await expectUnavailable(`093-old-${table}`, `${table}.age_group_id is unavailable`, table, 'age_group_id'));
}

for (const table of ['announcements', 'rules']) {
  checks.push(await expectAvailable(`093-new-${table}`, `${table}.division_ids is available`, table, 'division_ids'));
  checks.push(await expectUnavailable(`093-old-${table}`, `${table}.age_group_ids is unavailable`, table, 'age_group_ids'));
}

for (const table of ['league_seasons', 'rep_teams']) {
  checks.push(await expectAvailable(`093-new-${table}`, `${table}.division is available`, table, 'division'));
  checks.push(await expectUnavailable(`093-old-${table}`, `${table}.age_group is unavailable`, table, 'age_group'));
}

const feeMode = await get('/tournaments?select=id&fee_schedule_mode=eq.age_group&limit=1');
checks.push({
  check_id: '093-12',
  description: 'no tournaments still use fee_schedule_mode = age_group',
  status: feeMode.ok && Array.isArray(feeMode.body) && feeMode.body.length === 0
    ? 'PASS'
    : 'FAIL - age_group fee_schedule_mode remains or could not be checked',
});

checks.push(await expectRpcOk(
  '093-rpc-01',
  'is_org_member_for_age_group function executes',
  'is_org_member_for_age_group',
  { agid: emptyUuid }
));
checks.push(await expectRpcOk(
  '093-rpc-02',
  'can_access_tournament_for_pool function executes',
  'can_access_tournament_for_pool',
  { pool_age_group_id: emptyUuid }
));
checks.push(await expectRpcOk(
  '093-rpc-03',
  'claim_next_slot function executes',
  'claim_next_slot',
  { p_age_group_id: emptyUuid, p_team_id: emptyUuid }
));

console.log(`Migration 093 REST verification against ${supabaseUrl}`);
console.table(checks);

const failures = checks.filter((row) => row.status.startsWith('FAIL'));
if (failures.length > 0) {
  console.error(`Migration 093 REST verification failed: ${failures.length} failing check(s).`);
  process.exit(1);
}

console.log('Migration 093 REST verification passed.');
