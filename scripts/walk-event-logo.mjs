/**
 * walk-event-logo.mjs — the fixture for the owner walk of navigation Phase 2 Part A (the event at the head of the
 * tournament sidebar and its switch list; Owner QA Ledger §508). DEV ONLY: it refuses the production project.
 *
 *   node scripts/walk-event-logo.mjs <variant>     change the UAT Rep Club Invitational 2026's own logo and/or name
 *   node scripts/walk-event-logo.mjs restore       put the event back exactly as it was
 *
 * Variants: logo · wide · tall · light · none · broken · long · two
 *   none = the event has no logo of its own, so the cell shows the CLUB's logo (E10's fallback).
 *   wide / tall = a badly shaped event logo, so the cell shows the EVENT's initials, never the club's logo (T5).
 * The event's first logo, name and stored shape are remembered the first time a variant is applied (in the system temp
 * folder) and `restore` writes them back and deletes the test images. Run `restore` when the walk is done.
 * (Part B's `walk-logo-tile.mjs` changes the CLUB's logo; together they reach "no logo anywhere".)
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
const ORG_SLUG = 'uat-rep-club';
const EVENT_NAME = 'UAT Rep Club Invitational 2026';
const BUCKET = 'org-logos';
const SAVED = path.join(os.tmpdir(), 'walk-event-logo-original.json');
const FILES = ['walk-square.png', 'walk-wide.png', 'walk-tall.png', 'walk-light.png'];

const variant = process.argv[2];
const NAMES = {
  long: 'Lakeshore Minor Baseball Fall Classic Invitational Championship 2026',
  two: 'Lakeshore Winter Indoor 2026',
};
if (!variant || !['logo', 'wide', 'tall', 'light', 'none', 'broken', 'long', 'two', 'restore'].includes(variant)) {
  console.error('Usage: node scripts/walk-event-logo.mjs logo|wide|tall|light|none|broken|long|two|restore');
  process.exit(1);
}

const { data: org, error: orgErr } = await db.from('organizations').select('id').eq('slug', ORG_SLUG).single();
if (orgErr || !org) { console.error('UAT Rep Club not found on dev.', orgErr?.message); process.exit(1); }
// Found by its first name; after `long` / `two` it is found by the id remembered with the original.
const remembered = fs.existsSync(SAVED) ? JSON.parse(fs.readFileSync(SAVED, 'utf8')) : null;
const { data: ev, error: evErr } = remembered
  ? await db.from('tournaments').select('id, name, logo_url, logo_aspect').eq('id', remembered.id).single()
  : await db.from('tournaments').select('id, name, logo_url, logo_aspect').eq('org_id', org.id).eq('name', EVENT_NAME).single();
if (evErr || !ev) { console.error(`${EVENT_NAME} not found on dev.`, evErr?.message); process.exit(1); }

if (variant === 'restore') {
  if (!remembered) { console.log('Nothing to restore: no variant was applied from this machine.'); process.exit(0); }
  const { id, ...orig } = remembered;
  const { error: e } = await db.from('tournaments').update(orig).eq('id', id);
  if (e) { console.error(e.message); process.exit(1); }
  await db.storage.from(BUCKET).remove(FILES.map(f => `${org.id}/${id}/${f}`));
  fs.unlinkSync(SAVED);
  console.log(`Restored: "${orig.name}", its own logo ${orig.logo_url ? 'back' : 'none (as before)'}.`);
  process.exit(0);
}

if (!remembered) fs.writeFileSync(SAVED, JSON.stringify({ id: ev.id, name: ev.name, logo_url: ev.logo_url, logo_aspect: ev.logo_aspect }));
const orig = remembered ?? { name: ev.name };

const disc = (w, h, fill) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
  .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2.4}" fill="${fill}"/></svg>`) }]).png().toBuffer();
async function put(file, buf) {
  const p = `${org.id}/${ev.id}/${file}`;
  const { error: e } = await db.storage.from(BUCKET).upload(p, buf, { contentType: 'image/png', upsert: true });
  if (e) throw e;
  return db.storage.from(BUCKET).getPublicUrl(p).data.publicUrl + `?v=${Date.now()}`;
}

const patch = { name: orig.name, logo_url: null, logo_aspect: null };
if (variant === 'logo' || variant === 'long' || variant === 'two') { patch.logo_url = await put('walk-square.png', await disc(300, 300, '#8C2F39')); patch.logo_aspect = 1; }
if (variant === 'wide') { patch.logo_url = await put('walk-wide.png', await disc(600, 100, '#B3261E')); patch.logo_aspect = 6; }
if (variant === 'tall') { patch.logo_url = await put('walk-tall.png', await disc(100, 400, '#1F3A5F')); patch.logo_aspect = 0.25; }
if (variant === 'light') { patch.logo_url = await put('walk-light.png', await disc(300, 300, '#F2F2F0')); patch.logo_aspect = 1; }
if (variant === 'broken') { patch.logo_url = 'http://localhost:3000/this-event-logo-does-not-exist.png'; patch.logo_aspect = 1; }
if (NAMES[variant]) patch.name = NAMES[variant];

const { error: e2 } = await db.from('tournaments').update(patch).eq('id', ev.id);
if (e2) { console.error(e2.message); process.exit(1); }
console.log(`The event is now: ${variant} — "${patch.name}", its own logo ${patch.logo_url ? `set (shape ${patch.logo_aspect})` : 'none (the club’s shows)'}. Reload the page.`);
