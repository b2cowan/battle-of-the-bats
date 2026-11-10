/**
 * backfill-org-logo-aspect.mjs — one-time pass that measures the logos uploaded BEFORE their shape was stored: the
 * organizations' (migration 458, navigation Phase 1 Part B, owner answer 2 = A, 2026-11-09) and the events'
 * (`tournaments.logo_aspect`, migration 460, navigation Phase 2 gate ruling, 2026-11-10). Both tables, one run.
 *
 *   node scripts/backfill-org-logo-aspect.mjs            # dev (default) — a dry run: prints what it would write
 *   node scripts/backfill-org-logo-aspect.mjs --write    # dev — writes
 *   node scripts/backfill-org-logo-aspect.mjs --prod --write   # PRODUCTION — ONLY at the promote, with the owner's yes
 *
 * Reads every organization and every event that has a logo and no stored shape, measures it (sharp, EXIF turn applied — the same
 * arithmetic as lib/org-logo-measure.ts) and writes `logo_aspect`. A made stock logo is always 512 x 512 (aspect 1) and
 * costs no fetch. A logo that cannot be fetched or read is left NULL (the tile then shows initials) and listed.
 * Re-runnable: it only ever touches rows whose `logo_aspect` is still NULL. Needs SUPABASE_ACCESS_TOKEN in .env.local.
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const line of fs.existsSync(path.join(ROOT, '.env.local')) ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n') : []) {
  const t = line.trim();
  const eq = t.indexOf('=');
  if (!t || t.startsWith('#') || eq === -1) continue;
  if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const write = argv.includes('--write');
const REF = prod ? 'qcttcboqysynwcdyghil' : 'npgnrxaitgbtbtvvykto';

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com', path: `/v1/projects/${REF}/database/query`, method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve(JSON.parse(d || '[]')) : reject(new Error(`${res.statusCode} ${d.slice(0, 300)}`))));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function measure(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const { default: sharp } = await import('sharp');
  const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
  if (!meta.width || !meta.height) throw new Error('no size');
  return (meta.orientation ?? 1) >= 5 ? meta.height / meta.width : meta.width / meta.height;
}

console.log(`${prod ? '⚠️  PRODUCTION' : 'dev'} — ${write ? 'WRITING' : 'dry run (add --write)'}`);
// The organizations' logos, then the events' (an event's `slug` is unique only within its organization, so it is listed
// with the organization's). Only `organizations` and `tournaments` ever reach the SQL below — the table names are not input.
const TABLES = [
  ['organizations', "select id, slug, logo_url from public.organizations where logo_url is not null and logo_aspect is null order by slug"],
  ['tournaments', "select t.id, o.slug || '/' || t.slug as slug, t.logo_url from public.tournaments t join public.organizations o on o.id = t.org_id where t.logo_url is not null and t.logo_aspect is null order by 2"],
];
let wrote = 0;
const unreadable = [];
for (const [table, select] of TABLES) {
  const rows = await query(select);
  console.log(`${table}: ${rows.length} logo(s) without a stored shape.`);
  for (const row of rows) {
    const url = String(row.logo_url);
    let aspect = null;
    // A made stock logo: <orgId>/stock-<logoId>-<rrggbb>-<ms>.png, always 512 x 512 (lib/stock-logo-render.ts).
    if (/\/stock-[^/]+\.png(\?|$)/.test(url)) aspect = 1;
    else if (/^https?:\/\//.test(url)) {
      try { aspect = await measure(url); } catch (e) { unreadable.push(`${row.slug}: ${e.message}`); }
    } else unreadable.push(`${row.slug}: not an uploaded file (${url.slice(0, 40)})`);
    if (aspect === null || !Number.isFinite(aspect) || aspect <= 0) continue;
    console.log(`  ${row.slug.padEnd(32)} ${aspect.toFixed(3)}`);
    if (write) {
      // Only while the logo is still the one that was measured (a club may have changed it during the slow fetches).
      await query(`update public.${table} set logo_aspect = ${Number(aspect)} where id = '${String(row.id).replace(/[^0-9a-f-]/gi, '')}' and logo_aspect is null and logo_url = '${url.replace(/'/g, "''")}'`);
      wrote++;
    }
  }
}
console.log(`${write ? `wrote ${wrote}` : 'would write'}; ${unreadable.length} left unmeasured (they show initials).`);
for (const u of unreadable) console.log(`  unmeasured — ${u}`);
