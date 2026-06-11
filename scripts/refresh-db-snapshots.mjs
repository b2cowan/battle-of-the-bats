/**
 * refresh-db-snapshots.mjs
 *
 * Regenerates the committed structure snapshots in docs/agents/db/schema-snapshots/
 * for BOTH the dev AND prod Supabase projects from their live information_schema /
 * pg_catalog (structure only — NO business-data rows are ever read), and emits a
 * dev-vs-prod structural drift report. Then refreshes the dev markdown memory doc
 * by delegating to refresh-db-schema.mjs.
 *
 * This is the single command the Data Dictionary maintenance rules require to be run
 * after every migration (dev AND prod). See docs/agents/db/DATA_DICTIONARY.md (header
 * rules) and docs/projects/active/DATA_DICTIONARY_PLAN.md (Phase 0 / §11).
 *
 * Usage:
 *   node scripts/refresh-db-snapshots.mjs                 # both envs, write all + drift + markdown
 *   node scripts/refresh-db-snapshots.mjs --probe         # connectivity/auth check only, no writes
 *   node scripts/refresh-db-snapshots.mjs --env=dev       # one env only
 *   node scripts/refresh-db-snapshots.mjs --no-markdown   # skip the dev markdown refresh
 *   node scripts/refresh-db-snapshots.mjs --fail-on-drift # exit non-zero if dev != prod (post-migration gate)
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (a Supabase Management API personal access
 * token, scoped to the account — it reaches BOTH projects; the project is chosen by the
 * {ref} path segment, so no per-project credentials are needed).
 *
 * NOTE: fk_constraints_prod.json is an ad-hoc legacy-FK-name artifact and is intentionally
 * NOT regenerated here.
 *
 * KNOWN SHAPE QUIRK (matches prior snapshots — do NOT "fix"): FK rows whose target is in the
 * `auth` schema (e.g. FKs to auth.users via created_by/user_id/...) carry foreign_table:null /
 * foreign_column:null, because information_schema.constraint_column_usage only surfaces public
 * targets. This is by design and byte-identical to the previous committed files.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SNAP_DIR = path.join(ROOT, 'docs', 'agents', 'db', 'schema-snapshots');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

const PROJECTS = {
  dev: 'npgnrxaitgbtbtvvykto',
  prod: 'qcttcboqysynwcdyghil',
};

// ── args ─────────────────────────────────────────────────────────────────────
const ARGS = process.argv.slice(2);
const hasFlag = (f) => ARGS.includes(f);
const envArg = (ARGS.find((a) => a.startsWith('--env=')) || '--env=both').split('=')[1];
const ENVS = envArg === 'both' ? ['dev', 'prod'] : [envArg];
const PROBE = hasFlag('--probe');
const NO_MARKDOWN = hasFlag('--no-markdown');
const FAIL_ON_DRIFT = hasFlag('--fail-on-drift');

// Validate env selection up front so a typo fails clean (not with a /projects/undefined URL).
for (const e of ENVS) {
  if (!PROJECTS[e]) {
    console.error(`Unknown --env "${e}" (expected dev | prod | both)`);
    process.exit(1);
  }
}

// ── env loading (mirrors refresh-db-schema.mjs) ───────────────────────────────
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

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not set in .env.local');
  process.exit(1);
}

// ── Management API query (read-only) ──────────────────────────────────────────
function apiQuery(sql, ref) {
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
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(d);
          } catch {
            return reject(new Error(`[${ref}] non-JSON response (HTTP ${res.statusCode}): ${d.slice(0, 200)}`));
          }
          // Success = an array of row objects. Anything else (e.g. {message}) is an error envelope.
          if (!Array.isArray(parsed)) {
            return reject(
              new Error(`[${ref}] query failed (HTTP ${res.statusCode}): ${JSON.stringify(parsed).slice(0, 300)}`),
            );
          }
          resolve(parsed);
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── SQL (structure only; zero business-data rows) ─────────────────────────────
const SQL = {
  columns: `
    SELECT t.table_name, c.ordinal_position, c.column_name, c.data_type,
           c.udt_name, c.is_nullable, c.column_default
    FROM information_schema.tables t
    JOIN information_schema.columns c
      ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position
  `,
  constraints: `
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name,
           ccu.table_name  AS foreign_table,
           ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     AND tc.constraint_type = 'FOREIGN KEY'
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
  `,
  indexes: `
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `,
  rls: `
    (SELECT 'RLS' AS kind, c.relname AS table_name,
            CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS detail,
            NULL::text AS check_clause
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r')
    UNION ALL
    (SELECT 'CHECK' AS kind, tc.table_name, tc.constraint_name AS detail, cc.check_clause
     FROM information_schema.table_constraints tc
     JOIN information_schema.check_constraints cc
       ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.table_schema
     WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
       AND tc.constraint_name NOT LIKE '%_not_null')
    ORDER BY table_name, kind, detail
  `,
};

// ── shaping helpers (emit the EXACT existing file shapes) ──────────────────────
function shapeColumnsSplit(rows) {
  return rows.map((r) => ({
    table_name: r.table_name,
    column_name: r.column_name,
    data_type: r.data_type,
    udt_name: r.udt_name,
    is_nullable: r.is_nullable,
    column_default: r.column_default,
    ordinal_position: Number(r.ordinal_position),
  }));
}
function shapeColumnsCombined(rows) {
  return rows.map((r) => ({
    table_name: r.table_name,
    pos: Number(r.ordinal_position),
    column_name: r.column_name,
    data_type: r.data_type,
    udt_name: r.udt_name,
    is_nullable: r.is_nullable,
    column_default: r.column_default,
  }));
}
function shapeConstraintsSplit(rows) {
  return rows.map((r) => ({
    table_name: r.table_name,
    constraint_name: r.constraint_name,
    constraint_type: r.constraint_type,
    column_name: r.column_name,
    foreign_table: r.foreign_table ?? null,
    foreign_column: r.foreign_column ?? null,
  }));
}
function shapeForeignKeysCombined(rows) {
  return rows
    .filter((r) => r.constraint_type === 'FOREIGN KEY')
    .map((r) => ({
      table_name: r.table_name,
      column_name: r.column_name,
      foreign_table: r.foreign_table ?? null,
      foreign_column: r.foreign_column ?? null,
      constraint_name: r.constraint_name,
    }));
}
function shapeIndexes(rows) {
  return rows.map((r) => ({ tablename: r.tablename, indexname: r.indexname, indexdef: r.indexdef }));
}
function shapeRls(rows) {
  return rows.map((r) => ({
    kind: r.kind,
    table_name: r.table_name,
    detail: r.detail,
    check_clause: r.check_clause ?? null,
  }));
}

function writeJson(file, obj) {
  fs.writeFileSync(path.join(SNAP_DIR, file), JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// ── migration watermark (the snapshot-freshness gate) ─────────────────────────
// Records the state of supabase/migrations/ at refresh time so scripts/check-snapshot-freshness.mjs
// can fail when a migration lands without a snapshot refresh — the residual hole the coverage ratchet
// cannot see (it reads the committed, possibly-stale snapshot). See DATA_DICTIONARY_PLAN.md §11.
// Number-only (no date) so a true no-op refresh produces no diff (byte-stable, like the dumps).
function writeManifest() {
  const files = fs.existsSync(MIGRATIONS_DIR)
    ? fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    : [];
  const nums = files.map((f) => parseInt((f.match(/^(\d+)/) || [])[1], 10)).filter((n) => Number.isFinite(n));
  const manifest = {
    _comment:
      'Migration watermark for the snapshot-freshness gate (scripts/check-snapshot-freshness.mjs). ' +
      'highestMigration + migrationCount record the state of supabase/migrations/ at the last ' +
      '`npm run refresh:snapshots`. The gate FAILS when supabase/migrations/ has advanced beyond this ' +
      '(a migration landed without a snapshot refresh+commit). See DATA_DICTIONARY_PLAN.md §11. ' +
      'Written by refresh-db-snapshots.mjs — do not hand-edit.',
    highestMigration: nums.length ? Math.max(...nums) : 0,
    migrationCount: files.length,
  };
  writeJson('SNAPSHOT_MANIFEST.json', manifest);
  return { highest: manifest.highestMigration, count: manifest.migrationCount };
}

// ── drift (purely structural; dev vs prod) ────────────────────────────────────
function diffSets(devSet, prodSet) {
  const onlyDev = [...devSet].filter((x) => !prodSet.has(x)).sort();
  const onlyProd = [...prodSet].filter((x) => !devSet.has(x)).sort();
  return { onlyDev, onlyProd };
}

function buildDrift(raw) {
  const date = new Date().toISOString().slice(0, 10);
  const dev = raw.dev;
  const prod = raw.prod;

  // tables
  const devTables = new Set(dev.columns.map((c) => c.table_name));
  const prodTables = new Set(prod.columns.map((c) => c.table_name));
  const tbl = diffSets(devTables, prodTables);

  // columns (key table.column), compare type tuple where both present
  const colKey = (c) => `${c.table_name}.${c.column_name}`;
  const devCols = new Map(dev.columns.map((c) => [colKey(c), c]));
  const prodCols = new Map(prod.columns.map((c) => [colKey(c), c]));
  const col = diffSets(new Set(devCols.keys()), new Set(prodCols.keys()));
  const colChanged = [];
  for (const [k, d] of devCols) {
    const p = prodCols.get(k);
    if (!p) continue;
    const sig = (c) => `${c.data_type}|${c.udt_name}|${c.is_nullable}|${c.column_default ?? ''}`;
    if (sig(d) !== sig(p)) colChanged.push({ key: k, dev: sig(d), prod: sig(p) });
  }
  colChanged.sort((a, b) => a.key.localeCompare(b.key));

  // indexes (key indexname; compare def)
  const idxKey = (i) => i.indexname;
  const devIdx = new Map(dev.indexes.map((i) => [idxKey(i), i.indexdef]));
  const prodIdx = new Map(prod.indexes.map((i) => [idxKey(i), i.indexdef]));
  const idx = diffSets(new Set(devIdx.keys()), new Set(prodIdx.keys()));
  const idxChanged = [];
  for (const [k, d] of devIdx) {
    const p = prodIdx.get(k);
    if (p !== undefined && p !== d) idxChanged.push({ key: k, dev: d, prod: p });
  }
  idxChanged.sort((a, b) => a.key.localeCompare(b.key));

  // constraints (key table.constraint_name)
  const conKey = (c) => `${c.table_name}.${c.constraint_name}`;
  const devCon = new Set(dev.constraints.map(conKey));
  const prodCon = new Set(prod.constraints.map(conKey));
  const con = diffSets(devCon, prodCon);

  // rls: RLS state per table + CHECK clauses
  const rlsState = (rows) =>
    new Map(rows.filter((r) => r.kind === 'RLS').map((r) => [r.table_name, r.detail]));
  const devRls = rlsState(dev.rls);
  const prodRls = rlsState(prod.rls);
  const rlsChanged = [];
  for (const [t, d] of devRls) {
    const p = prodRls.get(t);
    if (p !== undefined && p !== d) rlsChanged.push({ key: t, dev: d, prod: p });
  }
  rlsChanged.sort((a, b) => a.key.localeCompare(b.key));

  const checkKey = (r) => `${r.table_name}.${r.detail}`;
  const devChk = new Map(dev.rls.filter((r) => r.kind === 'CHECK').map((r) => [checkKey(r), r.check_clause]));
  const prodChk = new Map(prod.rls.filter((r) => r.kind === 'CHECK').map((r) => [checkKey(r), r.check_clause]));
  const chk = diffSets(new Set(devChk.keys()), new Set(prodChk.keys()));

  const counts = {
    tables: tbl.onlyDev.length + tbl.onlyProd.length,
    columns: col.onlyDev.length + col.onlyProd.length + colChanged.length,
    indexes: idx.onlyDev.length + idx.onlyProd.length + idxChanged.length,
    constraints: con.onlyDev.length + con.onlyProd.length,
    rls: rlsChanged.length + chk.onlyDev.length + chk.onlyProd.length,
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // markdown
  const L = [];
  L.push(`# Dev vs Prod — structural drift`);
  L.push('');
  L.push(`**Generated:** ${date} by \`scripts/refresh-db-snapshots.mjs\` (structure only — no business data).`);
  L.push('');
  L.push(total === 0 ? `**✅ No structural drift** between dev and prod.` : `**⚠️ ${total} divergence(s)** across dev/prod.`);
  L.push('');
  L.push(`| Dimension | Only in DEV | Only in PROD | Changed |`);
  L.push(`|---|---|---|---|`);
  L.push(`| Tables | ${tbl.onlyDev.length} | ${tbl.onlyProd.length} | — |`);
  L.push(`| Columns | ${col.onlyDev.length} | ${col.onlyProd.length} | ${colChanged.length} |`);
  L.push(`| Indexes | ${idx.onlyDev.length} | ${idx.onlyProd.length} | ${idxChanged.length} |`);
  L.push(`| Constraints | ${con.onlyDev.length} | ${con.onlyProd.length} | — |`);
  L.push(`| RLS / CHECK | ${chk.onlyDev.length} | ${chk.onlyProd.length} | ${rlsChanged.length} (RLS state) |`);
  L.push('');

  const section = (title, items, render = (x) => `- \`${x}\``) => {
    L.push(`### ${title} (${items.length})`);
    if (!items.length) L.push('_none_');
    else for (const it of items) L.push(render(it));
    L.push('');
  };

  L.push(`## Tables`);
  section('Only in DEV', tbl.onlyDev);
  section('Only in PROD', tbl.onlyProd);

  L.push(`## Columns`);
  section('Only in DEV', col.onlyDev);
  section('Only in PROD', col.onlyProd);
  section('Type/nullability/default changed', colChanged, (c) => `- \`${c.key}\` — dev: \`${c.dev}\` | prod: \`${c.prod}\``);

  L.push(`## Indexes`);
  section('Only in DEV', idx.onlyDev);
  section('Only in PROD', idx.onlyProd);
  section('Definition changed', idxChanged, (c) => `- \`${c.key}\`\n  - dev: \`${c.dev}\`\n  - prod: \`${c.prod}\``);

  L.push(`## Constraints (PK / UNIQUE / FK)`);
  section('Only in DEV', con.onlyDev);
  section('Only in PROD', con.onlyProd);

  L.push(`## RLS / CHECK`);
  section('RLS state differs', rlsChanged, (c) => `- \`${c.key}\` — dev: ${c.dev} | prod: ${c.prod}`);
  section('CHECK only in DEV', chk.onlyDev);
  section('CHECK only in PROD', chk.onlyProd);

  return { md: L.join('\n') + '\n', total, counts };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function fetchEnv(env) {
  const ref = PROJECTS[env];
  if (!ref) throw new Error(`Unknown env "${env}" (expected dev|prod|both)`);
  // sequential per env to be gentle on the Management API
  const columns = await apiQuery(SQL.columns, ref);
  const constraints = await apiQuery(SQL.constraints, ref);
  const indexes = await apiQuery(SQL.indexes, ref);
  const rls = await apiQuery(SQL.rls, ref);
  return { columns, constraints, indexes, rls };
}

async function main() {
  if (PROBE) {
    for (const env of ENVS) {
      const ref = PROJECTS[env];
      const rows = await apiQuery(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
        ref,
      );
      console.log(`✓ ${env} (${ref}) reachable — ${rows[0]?.n} public tables`);
    }
    console.log('Probe OK — token reaches all requested projects.');
    return;
  }

  if (!fs.existsSync(SNAP_DIR)) {
    console.error(`Snapshot dir not found: ${SNAP_DIR}`);
    process.exit(1);
  }

  // Fetch ALL envs first (no writes), so a late failure (e.g. prod query #3) never leaves the
  // working tree half-updated (dev split files new, prod split files stale).
  const raw = {};
  for (const env of ENVS) {
    console.log(`Querying ${env} (${PROJECTS[env]})...`);
    raw[env] = await fetchEnv(env);
    const t = new Set(raw[env].columns.map((c) => c.table_name)).size;
    console.log(`  ${t} tables, ${raw[env].columns.length} columns, ${raw[env].constraints.length} constraint-rows, ${raw[env].indexes.length} indexes, ${raw[env].rls.length} rls/check rows`);
  }

  // All fetches succeeded — write the per-env split files.
  for (const env of ENVS) {
    writeJson(`schema-dump-columns-${env}.json`, shapeColumnsSplit(raw[env].columns));
    writeJson(`schema-dump-constraints-${env}.json`, shapeConstraintsSplit(raw[env].constraints));
    writeJson(`schema-dump-indexes-${env}.json`, shapeIndexes(raw[env].indexes));
  }

  // combined canonical file — only (re)write when BOTH envs were fetched, so we
  // never half-update it with one stale half.
  if (ENVS.includes('dev') && ENVS.includes('prod')) {
    const combined = {};
    for (const env of ['dev', 'prod']) {
      combined[env] = {
        columns: shapeColumnsCombined(raw[env].columns),
        foreign_keys: shapeForeignKeysCombined(raw[env].constraints),
        indexes: shapeIndexes(raw[env].indexes),
        rls: shapeRls(raw[env].rls),
      };
    }
    writeJson('schema_dumps.json', combined);
    console.log('Wrote schema_dumps.json (combined dev+prod canonical).');

    const drift = buildDrift(raw);
    fs.writeFileSync(path.join(SNAP_DIR, 'DRIFT_dev_vs_prod.md'), drift.md, 'utf8');
    console.log(`Wrote DRIFT_dev_vs_prod.md — ${drift.total} divergence(s): ${JSON.stringify(drift.counts)}`);

    if (FAIL_ON_DRIFT && drift.total > 0) {
      console.error(`--fail-on-drift: ${drift.total} dev/prod divergence(s) found.`);
      process.exitCode = 2;
    }

    const wm = writeManifest();
    console.log(`Wrote SNAPSHOT_MANIFEST.json — migration watermark #${wm.highest} (${wm.count} files).`);
  } else {
    console.log('Single-env run: skipped schema_dumps.json + drift (need both envs).');
  }

  // refresh the dev markdown memory doc via the existing proven script
  if (!NO_MARKDOWN && ENVS.includes('dev')) {
    try {
      console.log('Refreshing memory/reference_db_schema.md via refresh-db-schema.mjs...');
      execFileSync('node', [path.join(ROOT, 'scripts', 'refresh-db-schema.mjs')], {
        stdio: 'inherit',
        cwd: ROOT,
      });
    } catch (e) {
      console.warn(`⚠ Markdown refresh failed (snapshots are still written): ${e.message}`);
    }
  }

  // Layer 2 (maintenance harness): right after the schema is re-snapshotted, surface any Data
  // Dictionary coverage gap so a newly-added table/column gets documented in the same sitting.
  // Non-fatal here (you refresh THEN document) — the gate that BLOCKS is `npm run verify:changed`.
  try {
    execFileSync('node', [path.join(ROOT, 'scripts', 'check-dictionary-coverage.mjs')], {
      stdio: 'inherit',
      cwd: ROOT,
    });
  } catch {
    console.warn(
      '⚠ Data Dictionary coverage gap (see above) — document the new schema in ' +
        'docs/agents/db/DATA_DICTIONARY.md or acknowledge it in scripts/.dictionary-coverage-baseline.json.',
    );
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
