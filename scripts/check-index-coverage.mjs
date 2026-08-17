/**
 * Index-coverage gate — fail when an org-scoped table cannot be read by its tenant.
 *
 * WHY THIS EXISTS: "Every `org_id` column must be indexed" has been the standing rule in
 * docs/agents/db/DB_ARCHITECTURE_REVIEW.md since 2026-05. Nothing enforced it, so it quietly
 * stopped being true in 25+ places and nobody noticed for three months (Finding #33, found by
 * the 2026-08-17 quarterly health check; closed on dev by migration 249). A rule that lives in
 * a document and is read by nothing is not a rule — it is a hope. This is the reader.
 *
 * `org_id` is the RLS tenancy anchor. An unindexed one is not merely slow: it is the column
 * every policy's USING clause lands on, so it degrades the security boundary's cost, not just
 * a report's.
 *
 * ⚠ TWO TRAPS, both of which produced a WRONG answer during the audit that led to this file.
 * Anyone editing the matcher below should read these first:
 *
 *   1. A PARTIAL index only covers a plain `WHERE col = $1` lookup when its predicate is
 *      exactly `<col> IS NOT NULL` (equality implies not-null, so Postgres can use it).
 *      `games` carries two indexes led by `tournament_id` — but predicated on
 *      `score_submitted_at IS NOT NULL` and `generator_locked = true`. Neither can serve an
 *      ordinary lookup. `games.tournament_id`, the busiest table in the tournament module,
 *      was completely unindexed while looking covered.
 *
 *   2. The obvious regex `\(org_id[,)]` also matches `COALESCE(org_id, …)` buried mid-composite.
 *      That is exactly how `request_metrics_rollup` passed a first draft of this check while
 *      having no usable `org_id` index at all. The matcher MUST anchor on the access-method
 *      opening paren, and org_id must LEAD — a trailing column of a composite cannot serve a
 *      lookup on its own.
 *
 * DEV ONLY, deliberately. Prod legitimately lags dev between a migration and its prod apply;
 * gating on prod would block every commit until the owner runs the apply. Prod catching up is
 * already covered by check-prod-migration-drift.mjs and check-schema-parity.mjs. The three
 * compose:  freshness = "snapshot reflects the migrations"
 *           parity    = "the two databases agree"
 *           coverage  = "the schema obeys its own tenancy rule"   ← this file
 *
 * Runs OFFLINE against the committed snapshots — no network, no credentials — so it is safe in
 * verify:changed, the pre-commit hook and the deploy build.
 *
 *   node scripts/check-index-coverage.mjs           gate (default)
 *   node scripts/check-index-coverage.mjs --list    print coverage for every org_id table
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SNAP = 'docs/agents/db/schema-snapshots';
const EXCEPTIONS = 'scripts/.index-coverage-exceptions.json';

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const asRows = (v) => (Array.isArray(v) ? v : Object.values(v));

let columns, indexes;
try {
  columns = asRows(readJson(`${SNAP}/schema-dump-columns-dev.json`));
  indexes = asRows(readJson(`${SNAP}/schema-dump-indexes-dev.json`));
} catch (e) {
  console.error('✖ Index-coverage gate could not read the committed snapshots.');
  console.error(`  ${e.message}`);
  console.error('  Run `npm run refresh:snapshots` (needs SUPABASE_ACCESS_TOKEN) and commit the result.');
  process.exit(1);
}

/**
 * Does `indexdef` give a usable plain-equality lookup led by `col`?
 * See traps 1 and 2 in the header before loosening either half of this.
 */
function leadsUsableIndex(indexdef, col) {
  const lead = indexdef.match(/USING\s+\w+\s+\(\s*([a-z_][a-z0-9_]*)\s*[,)]/i);
  if (!lead || lead[1].toLowerCase() !== col) return false;      // trap 2: must LEAD, bare column
  const partial = indexdef.match(/\)\s+WHERE\s+\((.*)\)\s*$/is);
  if (!partial) return true;
  const pred = partial[1].trim().toLowerCase().replace(/^\(|\)$/g, '').trim();
  return pred === `${col} is not null`;                          // trap 1: only this predicate covers
}

const byTable = new Map();
for (const i of indexes) (byTable.get(i.tablename) ?? byTable.set(i.tablename, []).get(i.tablename)).push(i.indexdef);

const orgTables = [...new Set(columns.filter(c => c.column_name === 'org_id').map(c => c.table_name))].sort();
const covered = orgTables.filter(t => (byTable.get(t) ?? []).some(d => leadsUsableIndex(d, 'org_id')));
const bare = orgTables.filter(t => !covered.includes(t));

if (process.argv.includes('--list')) {
  for (const t of orgTables) console.log(`${covered.includes(t) ? '✓' : '✗'} ${t}`);
  console.log(`\n${covered.length}/${orgTables.length} org_id columns lead an index.`);
  process.exit(0);
}

const exceptions = existsSync(join(ROOT, EXCEPTIONS)) ? readJson(EXCEPTIONS).accepted ?? {} : {};
const unexpected = bare.filter(t => !(t in exceptions));
const resolved = Object.keys(exceptions).filter(t => !bare.includes(t));

if (unexpected.length) {
  console.error(`✖ Index-coverage gate — ${unexpected.length} table(s) have an org_id column with no index leading on it.\n`);
  for (const t of unexpected) console.error(`    ${t}`);
  console.error('\n  org_id is the RLS tenancy anchor. Add to the next migration:');
  for (const t of unexpected) console.error(`    CREATE INDEX IF NOT EXISTS ${t}_org_id_idx ON public.${t} (org_id);`);
  console.error(`\n  If a table is genuinely exempt (a telemetry buffer whose org_id is a label, not a`);
  console.error(`  tenant relationship), add it to ${EXCEPTIONS} WITH A REASON — never silently.`);
  process.exit(1);
}

if (resolved.length) {
  console.log(`ℹ Index-coverage — ${resolved.length} accepted exception(s) now covered; drop from ${EXCEPTIONS}: ${resolved.join(', ')}`);
}

console.log(`✓ Index coverage OK — ${covered.length}/${orgTables.length} org_id columns lead an index (${bare.length} accepted exception(s)).`);
