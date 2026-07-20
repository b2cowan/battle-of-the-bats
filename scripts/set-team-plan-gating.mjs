/**
 * set-team-plan-gating.mjs — dedicated, reviewed prod-write script for ONE row:
 * plan_gating.plan_key='team' (the standalone Premium Coaches Portal checkout gate).
 *
 * Context (owner directive 2026-07-20, BUSINESS_DECISIONS.md D4): migration 065
 * seeded team='live' and it was never audited, leaving the $29/mo checkout
 * accidentally open on prod while all copy said "coming soon" (0 sales).
 * Phase 0 of FOUNDING_SEASON_COACHES_FREE_PLAN.md closes it to 'early_access';
 * Phase 3 (coaches launch, $0 Founding Season comp path) reopens it to 'live'.
 *
 * Usage:
 *   node scripts/set-team-plan-gating.mjs --prod --set early_access   # Phase 0 close
 *   node scripts/set-team-plan-gating.mjs --prod --set live           # Phase 3 reopen
 *   node scripts/set-team-plan-gating.mjs --dev  --set ...            # dev mirror
 *
 * Prints the row before and after; refuses unknown statuses; no-ops (exit 0)
 * if the row already has the requested status. Reads SUPABASE_ACCESS_TOKEN
 * from .env.local (same Management API pattern as db-query.mjs).
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const PROJECT_REFS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };
const ALLOWED_STATUSES = ['live', 'early_access'];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }

let target = null;
let setStatus = null;
let backfillAudit = false;
let actor = 'b2cowan@gmail.com'; // default: the platform owner; pass --actor if someone else runs this
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--prod') target = 'prod';
  else if (a === '--dev') target = 'dev';
  else if (a === '--set') setStatus = argv[++i];
  else if (a === '--actor') actor = argv[++i];
  else if (a === '--backfill-audit') backfillAudit = true;
  else { console.error(`Unknown arg: ${a}`); process.exit(1); }
}
// Everything interpolated into SQL below goes through esc() — no exceptions, even
// values that are enum-like today (gating_status has no DB CHECK constraint).
const esc = (s) => String(s).replace(/'/g, "''");
if (!target || !setStatus) {
  console.error('Usage: node scripts/set-team-plan-gating.mjs --prod|--dev --set live|early_access');
  process.exit(1);
}
if (!ALLOWED_STATUSES.includes(setStatus)) {
  console.error(`Refusing status "${setStatus}" — allowed: ${ALLOWED_STATUSES.join(', ')}`);
  process.exit(1);
}

const NOTE = setStatus === 'early_access'
  ? 'Owner directive 2026-07-20 (BUSINESS_DECISIONS D4): close accidentally-live team checkout (mig-065 seed drift, 0 sales); reopens as $0 Founding Season comp at FOUNDING_SEASON_COACHES_FREE_PLAN Phase 3 launch'
  : 'FOUNDING_SEASON_COACHES_FREE_PLAN Phase 3 launch: reopen team as $0 Founding Season comp (BUSINESS_DECISIONS 2026-07-20 D1/D2)';

function query(sql) {
  const body = JSON.stringify({ query: sql });
  const options = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${PROJECT_REFS[target]}/database/query`,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data || '[]'));
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const before = await query(`select plan_key, gating_status, updated_by_email, last_change_note, updated_at from plan_gating where plan_key = 'team'`);
console.log(`[${target}] before:`, JSON.stringify(before));
if (!before.length) { console.error('No plan_gating row for team — aborting.'); process.exit(1); }
if (before[0].gating_status === setStatus) {
  if (backfillAudit) {
    // Recovery mode: the gating row already has the requested status but the flip
    // predates the script's audit write (or that write failed) — record it now.
    await query(
      `insert into platform_audit_log (actor_email, action, field, old_value, new_value)
       values ('${esc(actor)}', 'update_plan_gating', 'plan_gating.team',
               'null'::jsonb,
               '${esc(JSON.stringify({ gating_status: setStatus, note: before[0].last_change_note ?? NOTE, backfilled: true }))}'::jsonb)`
    );
    console.log(`[${target}] audit row backfilled for existing '${setStatus}' state.`);
    process.exit(0);
  }
  console.log(`[${target}] already '${setStatus}' — nothing to do.`);
  process.exit(0);
}

const after = await query(
  `update plan_gating set gating_status = '${esc(setStatus)}', updated_by_email = '${esc(actor)}', updated_at = now(), last_change_note = '${esc(NOTE)}' where plan_key = 'team' returning plan_key, gating_status, updated_by_email, last_change_note, updated_at`
);
console.log(`[${target}] after:`, JSON.stringify(after));

// Record the flip in platform_audit_log so it appears in the same audit view as
// every other plan_gating change (the platform-admin UI path writes this row via
// writePlatformAuditLog; this script mirrors it for CLI-driven flips).
await query(
  `insert into platform_audit_log (actor_email, action, field, old_value, new_value)
   values ('${esc(actor)}', 'update_plan_gating', 'plan_gating.team',
           '${esc(JSON.stringify({ gating_status: before[0].gating_status }))}'::jsonb,
           '${esc(JSON.stringify({ gating_status: setStatus, note: NOTE }))}'::jsonb)`
);
console.log(`[${target}] audit row written.`);
console.log(`[${target}] plan_gating.team → '${setStatus}' done.`);
