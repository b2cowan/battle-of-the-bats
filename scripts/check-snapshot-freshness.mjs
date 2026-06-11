/**
 * check-snapshot-freshness.mjs — the Data Dictionary snapshot-freshness gate (Layer 1½)
 *
 * Fails when supabase/migrations/ has advanced beyond the migration watermark recorded in
 * docs/agents/db/schema-snapshots/SNAPSHOT_MANIFEST.json by the last `npm run refresh:snapshots`.
 *
 * This closes the residual "author added a migration but forgot to refresh + commit the snapshot"
 * hole that the coverage ratchet (check-dictionary-coverage.mjs) cannot catch on its own: the
 * ratchet reads the COMMITTED snapshot, so if that snapshot is stale it is blind to any column the
 * new migration added. The watermark makes "a migration landed" and "the snapshot was refreshed"
 * the same unit of work. See docs/projects/active/DATA_DICTIONARY_PLAN.md §11.
 *
 * Watermark, not mtime/git-time: it compares the highest migration number + file count on disk
 * against what the manifest recorded, so it is deterministic and needs no git history or network —
 * safe to run in `npm run verify:changed`. The manifest is (re)written ONLY by refresh-db-snapshots.mjs,
 * so the only way to clear a stale failure is to actually refresh the snapshots (then commit both).
 *
 * Usage:
 *   node scripts/check-snapshot-freshness.mjs        # exit 1 if a migration outran the snapshot
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'agents', 'db', 'schema-snapshots', 'SNAPSHOT_MANIFEST.json');
const REFRESH_HINT =
  'Fix: run `npm run refresh:snapshots` (dev AND prod), then commit the refreshed snapshots +\n' +
  '       SNAPSHOT_MANIFEST.json in the SAME change as the migration (schema change ⇒ dictionary change).';

// ── scan supabase/migrations for numeric-prefixed .sql files ──────────────────
function scanMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations dir not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const numbered = files
    .map((f) => ({ file: f, num: parseInt((f.match(/^(\d+)/) || [])[1], 10) }))
    .filter((x) => Number.isFinite(x.num));
  const highest = numbered.length ? Math.max(...numbered.map((x) => x.num)) : 0;
  return { count: files.length, highest, numbered };
}

const { count, highest, numbered } = scanMigrations();

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('✖ Snapshot manifest missing: docs/agents/db/schema-snapshots/SNAPSHOT_MANIFEST.json');
  console.error('  It is written by `npm run refresh:snapshots` — run that once to seed the watermark.');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (e) {
  console.error(`✖ Could not parse SNAPSHOT_MANIFEST.json: ${e.message}`);
  process.exit(1);
}

const wmHighest = Number(manifest.highestMigration ?? -1);
const wmCount = Number(manifest.migrationCount ?? -1);
const newer = numbered.filter((x) => x.num > wmHighest).sort((a, b) => a.num - b.num);
const stale = highest > wmHighest || count > wmCount;

if (stale) {
  console.error('\n✖ DB snapshot is STALE — a migration has landed since the last snapshot refresh.\n');
  console.error(`  supabase/migrations/: highest #${highest}, ${count} files`);
  console.error(`  snapshot watermark:   highest #${wmHighest}, ${wmCount} files (SNAPSHOT_MANIFEST.json)`);
  if (newer.length) {
    console.error(`\n  Migration(s) past the watermark (${newer.length}):`);
    for (const x of newer) console.error(`    - ${x.file}`);
  } else if (count > wmCount) {
    console.error(`\n  A migration was inserted/renamed at or below #${wmHighest} (file count grew ${wmCount} → ${count}).`);
  }
  console.error('\n  The committed snapshot predates this migration, so the dictionary coverage ratchet');
  console.error('  is reading a stale schema and cannot see any columns the migration added.');
  console.error(`\n  ${REFRESH_HINT}\n`);
  process.exit(1);
}

console.log(`✓ Snapshot freshness OK — migrations at #${highest} (${count} files) match the snapshot watermark.`);
