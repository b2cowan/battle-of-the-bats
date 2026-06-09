/**
 * check-prod-migration-drift.mjs — release guardrail (prod migration safety)
 *
 * Migrations in this repo are plain .sql files applied to each Supabase project BY HAND via the
 * Management API (apply-migration-api.mjs). NOTHING runs them automatically — not the Amplify
 * build (amplify.yml just does `pnpm run build`), not the /release agent (it only pushes git).
 * So promoting code to master can ship a route that reads a table/column which exists in DEV but
 * was never applied to PROD → a guaranteed runtime 500 (this happened with migration 040, which
 * caused the prod registration 500 on 2026-06-08).
 *
 * This check queries BOTH live projects and FAILS (exit 1) when prod is MISSING schema that dev
 * has (tables or columns) — the signature of a migration applied to dev but not prod. Wire it
 * into the pre-promote gate. It is READ-ONLY (information_schema only) and never writes.
 *
 * Usage:
 *   node scripts/check-prod-migration-drift.mjs           # exit 1 if prod is behind dev
 *   node scripts/check-prod-migration-drift.mjs --json     # machine-readable output
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (one account PAT reaches both projects).
 * "Can't verify" (missing token / query failure) is treated as a FAILURE — a release must never
 * proceed on an unverified DB state.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

const PROJECTS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const JSON_OUT = process.argv.includes('--json');

if (!TOKEN) {
  console.error('✖ SUPABASE_ACCESS_TOKEN not set — cannot verify prod migration drift.');
  console.error('  A release must not proceed unverified; set the PAT in .env.local and retry.');
  process.exit(1);
}

function apiQuery(ref, sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request(
      {
        hostname: 'api.supabase.com',
        path: `/v1/projects/${ref}/database/query`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode} from project ${ref}: ${d.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(d));
          } catch {
            reject(new Error(`Unparseable response from project ${ref}: ${d.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// table -> Set(columns) for the public schema of a project.
async function loadColumns(ref) {
  const rows = await apiQuery(
    ref,
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema='public' ORDER BY table_name, column_name;`,
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, new Set());
    map.get(r.table_name).add(r.column_name);
  }
  return map;
}

let dev, prod;
try {
  [dev, prod] = await Promise.all([loadColumns(PROJECTS.dev), loadColumns(PROJECTS.prod)]);
} catch (e) {
  console.error(`✖ Could not verify prod migration drift: ${e.message}`);
  console.error('  Treating as a FAILURE — do not release on an unverified DB state.');
  process.exit(1);
}

// Prod-behind-dev: the release blocker (schema in dev that prod is missing).
const missingTables = [];
const missingColumns = [];
for (const [table, cols] of dev) {
  if (!prod.has(table)) {
    missingTables.push(table);
    continue;
  }
  const prodCols = prod.get(table);
  for (const c of cols) if (!prodCols.has(c)) missingColumns.push(`${table}.${c}`);
}

// Prod-ahead (rare): informational only — never blocks a release.
const prodAheadTables = [];
for (const [table] of prod) if (!dev.has(table)) prodAheadTables.push(table);

const behind = missingTables.length + missingColumns.length;

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        ok: behind === 0,
        missingTables: missingTables.sort(),
        missingColumns: missingColumns.sort(),
        prodAheadTables: prodAheadTables.sort(),
      },
      null,
      2,
    ),
  );
  process.exit(behind === 0 ? 0 : 1);
}

if (behind === 0) {
  console.log('✓ Prod schema is in sync with dev — no unapplied migrations detected.');
  if (prodAheadTables.length) {
    console.log(`  (note: prod has ${prodAheadTables.length} table(s) not in dev: ${prodAheadTables.sort().join(', ')})`);
  }
  process.exit(0);
}

console.error('\n✖ PROD IS BEHIND DEV — schema exists in dev but NOT in prod.');
console.error('  This is the signature of a migration applied to dev but never applied to prod.');
console.error('  Promoting code that reads this schema will 500 in production (cf. migration 040).\n');
if (missingTables.length) {
  console.error(`  Missing TABLES in prod (${missingTables.length}):`);
  for (const t of missingTables.sort()) console.error(`    - ${t}`);
}
if (missingColumns.length) {
  console.error(`  Missing COLUMNS in prod (${missingColumns.length}):`);
  for (const c of missingColumns.sort()) console.error(`    - ${c}`);
}
console.error('\n  Fix: apply the corresponding migration(s) to prod, then refresh + re-check:');
console.error('    node scripts/apply-migration-api.mjs supabase/migrations/<file>.sql --prod');
console.error('    node scripts/refresh-db-snapshots.mjs');
console.error('    node scripts/check-prod-migration-drift.mjs');
process.exit(1);
