/**
 * walk-logo-tile.mjs — the fixture for the owner walk of navigation Phase 1 Part B (the club cell and the logo tile;
 * Owner QA Ledger §507). DEV ONLY: it refuses the production project.
 *
 *   node scripts/walk-logo-tile.mjs <variant>     change the UAT Rep Club's logo and/or name
 *   node scripts/walk-logo-tile.mjs restore       put the club back exactly as it was
 *
 * Variants: logo · wide · tall · light · none · broken · long · two
 * The club's first logo, name and stored shape are remembered the first time a variant is applied (in the system temp
 * folder) and `restore` writes them back and deletes the test images. Run `restore` when the walk is done.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import sharp from 'sharp';

config({ path: path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '.env.local'), quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || url.includes('qcttcboqysynwcdyghil')) { console.error('Refusing: this fixture is for the dev project only.'); process.exit(1); }
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SLUG = 'uat-rep-club';
const BUCKET = 'org-logos';
const SAVED = path.join(os.tmpdir(), 'walk-logo-tile-original.json');
const FILES = ['walk-square.png', 'walk-wide.png', 'walk-tall.png', 'walk-light.png'];

const variant = process.argv[2];
const NAMES = {
  long: 'The Northfield & District Minor Baseball Association of Greater Riverside',
  two: 'Riverside Rep Baseball Club',
};
if (!variant || !['logo', 'wide', 'tall', 'light', 'none', 'broken', 'long', 'two', 'restore'].includes(variant)) {
  console.error('Usage: node scripts/walk-logo-tile.mjs logo|wide|tall|light|none|broken|long|two|restore');
  process.exit(1);
}

const { data: org, error } = await db.from('organizations').select('id, name, logo_url, logo_aspect').eq('slug', SLUG).single();
if (error || !org) { console.error('UAT Rep Club not found on dev.', error?.message); process.exit(1); }

if (variant === 'restore') {
  if (!fs.existsSync(SAVED)) { console.log('Nothing to restore: no variant was applied from this machine.'); process.exit(0); }
  const orig = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
  const { error: e } = await db.from('organizations').update(orig).eq('id', org.id);
  if (e) { console.error(e.message); process.exit(1); }
  await db.storage.from(BUCKET).remove(FILES.map(f => `${org.id}/${f}`));
  fs.unlinkSync(SAVED);
  console.log(`Restored: name "${orig.name}", logo ${orig.logo_url ? 'back' : 'none'}.`);
  process.exit(0);
}

if (!fs.existsSync(SAVED)) fs.writeFileSync(SAVED, JSON.stringify({ name: org.name, logo_url: org.logo_url, logo_aspect: org.logo_aspect }));
const orig = JSON.parse(fs.readFileSync(SAVED, 'utf8'));

const disc = (w, h, fill) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
  .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2.4}" fill="${fill}"/></svg>`) }]).png().toBuffer();
async function put(file, buf) {
  const p = `${org.id}/${file}`;
  const { error: e } = await db.storage.from(BUCKET).upload(p, buf, { contentType: 'image/png', upsert: true });
  if (e) throw e;
  return db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl + `?v=${Date.now()}`;
}

const patch = { name: orig.name, logo_url: null, logo_aspect: null };
if (variant === 'logo' || variant === 'long' || variant === 'two') { patch.logo_url = await put('walk-square.png', await disc(300, 300, '#1F6B4F')); patch.logo_aspect = 1; }
if (variant === 'wide') { patch.logo_url = await put('walk-wide.png', await disc(600, 100, '#B3261E')); patch.logo_aspect = 6; }
if (variant === 'tall') { patch.logo_url = await put('walk-tall.png', await disc(100, 400, '#1F3A5F')); patch.logo_aspect = 0.25; }
if (variant === 'light') { patch.logo_url = await put('walk-light.png', await disc(300, 300, '#F2F2F0')); patch.logo_aspect = 1; }
if (variant === 'broken') { patch.logo_url = 'http://localhost:3000/this-logo-does-not-exist.png'; patch.logo_aspect = 1; }
if (NAMES[variant]) patch.name = NAMES[variant];

const { error: e2 } = await db.from('organizations').update(patch).eq('id', org.id);
if (e2) { console.error(e2.message); process.exit(1); }
console.log(`UAT Rep Club is now: ${variant} — name "${patch.name}", logo ${patch.logo_url ? 'set' : 'none'}${patch.logo_aspect ? ` (shape ${patch.logo_aspect})` : ''}. Reload the page.`);
