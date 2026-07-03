/**
 * db-query.mjs — run a read/query statement against a Supabase project via the
 * Management API (/v1/projects/{ref}/database/query) and print the JSON result.
 *
 * Usage:
 *   node scripts/db-query.mjs --prod -q "select 1"          # inline SQL
 *   node scripts/db-query.mjs --dev  -f path/to/query.sql   # from a file
 *
 * Reads SUPABASE_ACCESS_TOKEN from .env.local (one PAT reaches both projects).
 * Default target is dev. Intended for ad-hoc introspection / data ops.
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
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }

let target = 'dev';
let inlineSql = null;
let fileSql = null;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--prod') target = 'prod';
  else if (a === '--dev') target = 'dev';
  else if (a === '-q' || a === '--query') inlineSql = argv[++i];
  else if (a === '-f' || a === '--file') fileSql = argv[++i];
  else { console.error(`Unknown arg: ${a}`); process.exit(1); }
}
const sql = inlineSql ?? (fileSql ? fs.readFileSync(path.resolve(fileSql), 'utf8') : null);
if (!sql) { console.error('Provide -q "<sql>" or -f <file>'); process.exit(1); }

const PROJECT_REF = PROJECT_REFS[target];

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

// Safety rail: this is an ad-hoc runner, so refuse anything but a read against PROD.
// (Writes to prod must go through a purpose-built, reviewed script.)
if (target === 'prod') {
  const firstWord = sql.trim().replace(/^\(+/, '').split(/\s+/)[0]?.toLowerCase();
  if (!['select', 'with', 'explain', 'show'].includes(firstWord)) {
    console.error(`Refusing to run a non-read statement ("${firstWord}") against PROD. Use a dedicated, reviewed script for prod writes.`);
    process.exit(1);
  }
}

const res = await apiQuery(sql);
if (res.status >= 200 && res.status < 300) {
  console.log(res.body);
} else {
  console.error(`Query failed (HTTP ${res.status}): ${res.body.slice(0, 800)}`);
  process.exit(1);
}
