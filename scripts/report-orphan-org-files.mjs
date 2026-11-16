#!/usr/bin/env node
/**
 * REPORT ONLY — the stored files left behind by clubs deleted before the delete removed them (Board Ready Stage 0a,
 * 2026-11-15). It never removes, moves or writes anything in storage or the database; it writes one JSON report under
 * `.probe/`. Removing what it finds is a separate owner decision.
 *
 * What it reads, per club bucket (the list is `ORG_FILE_BUCKETS` in lib/org-storage-purge.ts, its single home):
 *   · each top-level folder: a uuid that matches no row in `organizations` is an orphaned club folder; its files are counted
 *   · a top-level folder that is not a uuid, and a top-level file, are listed as "unrecognised" (never assumed orphaned),
 *     except in `resources`, where a top-level file is a legacy flat rules key: orphaned when no `resources` row names it
 *
 *   node scripts/report-orphan-org-files.mjs           the DEV project (.env.local)
 *   node scripts/report-orphan-org-files.mjs --prod    the PRODUCTION project (.env.production.local) — a read of production:
 *                                                      only with the owner's yes
 *
 * The console shows counts only. The ids and file names are in the report file.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ORG_FILE_BUCKETS } from '../lib/org-storage-purge.ts';

const PROD = process.argv.includes('--prod');
config({ path: PROD ? '.env.production.local' : '.env.local', quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const PAGE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function listPage(bucket, folder, offset) {
  const { data, error } = await sb.storage.from(bucket).list(folder, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw Object.assign(new Error(error.message), { storage: error });
  return data ?? [];
}

/** Every entry directly in a folder, paged. */
async function listAll(bucket, folder) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await listPage(bucket, folder, offset);
    out.push(...page);
    if (page.length < PAGE) return out;
  }
}

/** Files under a folder, at any depth. */
async function countFiles(bucket, folder) {
  let n = 0;
  const stack = [folder];
  while (stack.length) {
    const f = stack.pop();
    for (const e of await listAll(bucket, f)) {
      if (e.id == null) stack.push(`${f}/${e.name}`);
      else n++;
    }
  }
  return n;
}

async function allRows(table, columns, filter) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(columns).order('id').range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

const orgIds = new Set((await allRows('organizations', 'id')).map(r => r.id));
// The keys the rules rows name (both spellings: as typed and percent-encoded), for the legacy flat files.
const PUBLIC_PREFIX = '/storage/v1/object/public/resources/';
const namedKeys = new Set();
for (const r of await allRows('resources', 'id, url', q => q.like('url', `%${PUBLIC_PREFIX}%`))) {
  try {
    const p = new URL(String(r.url)).pathname;
    if (!p.startsWith(PUBLIC_PREFIX)) continue;
    const raw = p.slice(PUBLIC_PREFIX.length);
    namedKeys.add(raw);
    try { namedKeys.add(decodeURIComponent(raw)); } catch { /* keep the raw spelling */ }
  } catch { /* not an address */ }
}

const report = { project: new URL(url).host.split('.')[0], env: PROD ? 'prod' : 'dev', at: new Date().toISOString(), organizations: orgIds.size, buckets: {} };
for (const bucket of ORG_FILE_BUCKETS) {
  const b = { orphanedClubFolders: [], orphanedFiles: 0, legacyFlatUnnamed: [], unrecognised: [], error: null };
  report.buckets[bucket] = b;
  let root;
  try {
    root = await listAll(bucket, '');
  } catch (e) {
    b.error = /bucket not found/i.test(e.message) ? 'bucket not found' : e.message;
    continue;
  }
  for (const e of root) {
    if (e.id == null) {
      if (!UUID.test(e.name)) { b.unrecognised.push(`${e.name}/`); continue; }
      if (orgIds.has(e.name)) continue;
      // One unreadable folder is recorded, never the end of the report.
      try {
        const files = await countFiles(bucket, e.name);
        b.orphanedClubFolders.push({ orgId: e.name, files });
        b.orphanedFiles += files;
      } catch (err) {
        b.orphanedClubFolders.push({ orgId: e.name, files: null, error: err.message });
      }
    } else if (bucket === 'resources') {
      if (e.name === '.emptyFolderPlaceholder') continue;
      if (!namedKeys.has(e.name) && !namedKeys.has(encodeURIComponent(e.name))) b.legacyFlatUnnamed.push(e.name);
    } else if (e.name !== '.emptyFolderPlaceholder') {
      b.unrecognised.push(e.name);
    }
  }
}

const dir = path.join(process.cwd(), '.probe');
mkdirSync(dir, { recursive: true });
const out = path.join(dir, `orphan-org-files-${report.env}-${report.at.slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(report, null, 2));

console.log(`Orphaned stored files — ${report.env} (${report.organizations} clubs on file). Report only; nothing was removed.`);
for (const [bucket, b] of Object.entries(report.buckets)) {
  if (b.error) { console.log(`  ${bucket}: not read (${b.error})`); continue; }
  console.log(`  ${bucket}: ${b.orphanedClubFolders.length} deleted-club folder(s), ${b.orphanedFiles} file(s)`
    + `${bucket === 'resources' ? `; ${b.legacyFlatUnnamed.length} old flat file(s) no row names` : ''}`
    + `${b.unrecognised.length ? `; ${b.unrecognised.length} unrecognised top-level entr${b.unrecognised.length === 1 ? 'y' : 'ies'}` : ''}`);
}
console.log(`Report: ${path.relative(process.cwd(), out)}`);
