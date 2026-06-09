/**
 * apply-migration-api.mjs
 *
 * Applies a SQL migration file to a Supabase project via the Management API
 * (/v1/projects/{ref}/database/query) — no local `pg` dependency required.
 *
 * Usage:
 *   node scripts/apply-migration-api.mjs <path-to-migration.sql>            # dev (default)
 *   node scripts/apply-migration-api.mjs <path-to-migration.sql> --prod     # PRODUCTION
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (one account PAT reaches BOTH projects).
 * Targets:  dev = npgnrxaitgbtbtvvykto   |   prod = qcttcboqysynwcdyghil
 *
 * NOTE: nothing runs migrations automatically — not the Amplify build, not the /release agent.
 * After applying to EITHER env, run `node scripts/refresh-db-snapshots.mjs` so the committed
 * snapshots + `check-prod-migration-drift.mjs` stay accurate. Apply to prod BEFORE promoting
 * code that reads the new schema to master (else prod 500s — see the migration-040 incident).
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
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const PROJECT_REFS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not set in .env.local');
  process.exit(1);
}

// Parse args: an optional target flag (--prod | --dev | --target <env> | --env <env>) plus the
// single positional .sql path. Default target is dev (backward-compatible with existing usage).
let target = 'dev';
const positionals = [];
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--prod' || a === '--production') target = 'prod';
  else if (a === '--dev') target = 'dev';
  else if (a === '--target' || a === '--env') target = (argv[++i] || '').toLowerCase();
  else if (a.startsWith('--target=') || a.startsWith('--env=')) target = a.slice(a.indexOf('=') + 1).toLowerCase();
  else if (a.startsWith('-')) { console.error(`Unknown flag: ${a}`); process.exit(1); }
  else positionals.push(a);
}
const PROJECT_REF = PROJECT_REFS[target];
if (!PROJECT_REF) {
  console.error(`Invalid target "${target}" — use --dev (default) or --prod.`);
  process.exit(1);
}
const migrationFile = positionals[0];
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration-api.mjs <path-to-migration.sql> [--prod]');
  process.exit(1);
}
const sqlPath = path.resolve(migrationFile);
if (!fs.existsSync(sqlPath)) {
  console.error(`File not found: ${sqlPath}`);
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

function apiQuery(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

if (target === 'prod') {
  console.log('\n⚠️  ============ APPLYING TO PRODUCTION ============ ⚠️');
}
console.log(`\n📄 Applying ${path.basename(sqlPath)} to ${target} (${PROJECT_REF})…\n`);
const res = await apiQuery(sql);
if (res.status >= 200 && res.status < 300) {
  console.log(`✅ Migration applied successfully to ${target}.`);
  console.log(res.body && res.body !== '[]' ? `   Response: ${res.body.slice(0, 300)}` : '');
  // Data Dictionary maintenance (see docs/agents/db/DATA_DICTIONARY.md header rules):
  console.log('\n📌 Next: refresh snapshots + keep the Data Dictionary in sync for this schema change:');
  if (target === 'dev') {
    console.log('     • apply to PROD before promoting code to master:  node scripts/apply-migration-api.mjs <file> --prod');
  }
  console.log('     • node scripts/refresh-db-snapshots.mjs   (regenerates dev+prod snapshots + drift + coverage check)');
  console.log('     • node scripts/check-prod-migration-drift.mjs   (verifies prod is not behind dev before a master release)');
  console.log('     • update docs/agents/db/DATA_DICTIONARY.md for any new/changed field (same unit of work).');
} else {
  console.error(`❌ Migration failed (HTTP ${res.status}):`);
  console.error(`   ${res.body.slice(0, 600)}`);
  process.exit(1);
}
