/**
 * backfill-team-crest-aspect.mjs — one-time pass that measures the team crests saved BEFORE their shape was recorded
 * (navigation Phase 4, gate ruling C7, owner 2026-11-11: "record its shape when saved, measure existing uploads once — dev in
 * the build, prod at the promote with the owner's yes", as the club and event logos were by backfill-org-logo-aspect.mjs).
 *
 *   node scripts/backfill-team-crest-aspect.mjs            # dev (default) — a dry run: prints what it would write
 *   node scripts/backfill-team-crest-aspect.mjs --write    # dev — writes
 *   node scripts/backfill-team-crest-aspect.mjs --prod --write   # PRODUCTION — ONLY at the promote, with the owner's yes
 *
 * The crest is `rep_teams.pdf_settings.logoDataUrl` (a PNG of 256 px or less after the save route's sharp pass). The save
 * route now writes `logoAspect` (width / height, EXIF turn applied) and `logoVersion` (the first 12 hex of the picture's
 * SHA-1) beside it — `lib/team-crest.ts` `crestFacts`, whose arithmetic this repeats in an .mjs that cannot import it. A
 * crest the sidebar has no version for shows the team's colour (or initials) until this runs.
 *
 * Reads every team with a crest and no recorded version, decodes the picture locally (no fetch), and writes both facts
 * with `jsonb_set` — only while the picture is still the one measured. A crest that cannot be read keeps no shape (the tile
 * shows the colour) and is listed. Re-runnable. Needs SUPABASE_ACCESS_TOKEN in .env.local.
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

console.log(`${prod ? '⚠️  PRODUCTION' : 'dev'} — ${write ? 'WRITING' : 'dry run (add --write)'}`);
const rows = await query(`select t.id, o.slug || '/' || t.slug as slug, t.pdf_settings->>'logoDataUrl' as crest
  from public.rep_teams t join public.organizations o on o.id = t.org_id
  where t.pdf_settings->>'logoDataUrl' is not null and t.pdf_settings->>'logoVersion' is null order by 2`);
console.log(`rep_teams: ${rows.length} crest(s) without a recorded shape.`);
const { default: sharp } = await import('sharp');
let wrote = 0;
const unreadable = [];
for (const row of rows) {
  const crest = String(row.crest ?? '');
  const comma = crest.indexOf(',');
  if (!crest.startsWith('data:image/') || comma < 0) { unreadable.push(`${row.slug}: not a data URL`); continue; }
  const bytes = Buffer.from(crest.slice(comma + 1), 'base64');
  const version = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 12);
  let aspect = null;
  try {
    const meta = await sharp(bytes, { limitInputPixels: false }).metadata();
    if (meta.width && meta.height) aspect = (meta.orientation ?? 1) >= 5 ? meta.height / meta.width : meta.width / meta.height;
  } catch (e) { unreadable.push(`${row.slug}: ${e.message}`); }
  const rounded = aspect && Number.isFinite(aspect) && aspect > 0 ? Math.round(aspect * 1000) / 1000 : null;
  console.log(`  ${row.slug.padEnd(40)} ${rounded === null ? 'unreadable — version only' : rounded.toFixed(3)}  v=${version}`);
  if (write) {
    const id = String(row.id).replace(/[^0-9a-f-]/gi, '');
    const facts = rounded === null ? `jsonb_build_object('logoVersion', '${version}')` : `jsonb_build_object('logoAspect', ${rounded}, 'logoVersion', '${version}')`;
    // Only while the crest is still the one measured (a head coach may have saved a new one meanwhile).
    await query(`update public.rep_teams set pdf_settings = pdf_settings || ${facts}
      where id = '${id}' and pdf_settings->>'logoVersion' is null and md5(pdf_settings->>'logoDataUrl') = '${crypto.createHash('md5').update(crest).digest('hex')}'`);
    wrote++;
  }
}
console.log(`${write ? `wrote ${wrote}` : 'would write'}; ${unreadable.length} unreadable (they show the team's colour).`);
for (const u of unreadable) console.log(`  unreadable — ${u}`);
