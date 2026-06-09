/**
 * apply-migration-api.mjs
 *
 * Applies a SQL migration file to the Supabase dev project via the Management API
 * (/v1/projects/{ref}/database/query) — no local `pg` dependency required.
 *
 * Usage: node scripts/apply-migration-api.mjs <path-to-migration.sql>
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (or the environment).
 * Targets the dev project: npgnrxaitgbtbtvvykto
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

const PROJECT_REF = 'npgnrxaitgbtbtvvykto';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not set in .env.local');
  process.exit(1);
}

const [, , migrationFile] = process.argv;
if (!migrationFile) {
  console.error('Usage: node scripts/apply-migration-api.mjs <path-to-migration.sql>');
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

console.log(`\n📄 Applying ${path.basename(sqlPath)} to dev (${PROJECT_REF})…\n`);
const res = await apiQuery(sql);
if (res.status >= 200 && res.status < 300) {
  console.log('✅ Migration applied successfully.');
  console.log(res.body && res.body !== '[]' ? `   Response: ${res.body.slice(0, 300)}` : '');
  // Data Dictionary maintenance (see docs/agents/db/DATA_DICTIONARY.md header rules):
  console.log('\n📌 Next: refresh snapshots + update the Data Dictionary for this schema change:');
  console.log('     • apply to PROD too (this script targets dev only), then');
  console.log('     • node scripts/refresh-db-snapshots.mjs   (regenerates dev+prod snapshots + drift + coverage check)');
  console.log('     • update docs/agents/db/DATA_DICTIONARY.md for any new/changed field (same unit of work).');
} else {
  console.error(`❌ Migration failed (HTTP ${res.status}):`);
  console.error(`   ${res.body.slice(0, 600)}`);
  process.exit(1);
}
