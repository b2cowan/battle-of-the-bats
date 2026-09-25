/**
 * refresh-db-schema.mjs
 *
 * Queries the live Supabase dev project via the Management API and regenerates
 * memory/reference_db_schema.md with the current table+column structure.
 *
 * Usage:
 *   node scripts/refresh-db-schema.mjs
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (or the environment).
 * Targets the dev project: npgnrxaitgbtbtvvykto
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Safe to import: refresh-db-snapshots.mjs only runs its main() when it is the entrypoint.
import { CONSTRAINTS_SQL } from './refresh-db-snapshots.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Claude auto-memory lives in ~/.claude/projects/<encoded-cwd>/memory/
// Windows encoding: C:\Users\Foo Bar\project  →  c--Users-Foo-Bar-project
//   - drive letter lowercased, colon dropped
//   - first backslash → '--', subsequent backslashes and spaces → '-'
function getClaudeMemoryPath() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  let encoded = ROOT;
  // Lowercase drive letter and drop colon: "C:" → "c"
  encoded = encoded.replace(/^([A-Za-z]):/, (_, d) => d.toLowerCase());
  // First path separator → '--'
  encoded = encoded.replace(/^([a-z])[\\/]/, '$1--');
  // All remaining separators and spaces → '-'
  encoded = encoded.replace(/[\\/\s]+/g, '-');
  return path.join(home, '.claude', 'projects', encoded, 'memory');
}

// Load .env.local
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

const PROJECT_REF = 'npgnrxaitgbtbtvvykto';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not set in .env.local');
  process.exit(1);
}

function apiQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
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
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Parse error: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ── Module grouping ──────────────────────────────────────────────────────────

const MODULE_ORDER = [
  'Tournament',
  'League',
  'Rep Teams',
  'Standalone Team Workspace',
  'Accounting',
  'Stripe / Billing',
  'Organization / Platform Core',
  'Platform Admin',
  'CRM / Leads',
  'Other',
];

function classifyTable(name) {
  if (['tournaments','divisions','pools','pool_slots','teams','games','contacts',
       'diamonds','announcements','rules','rule_items','resources',
       'tournament_archives','tournament_registration_fields',
       'tournament_registration_field_answers','venue_facilities','org_venues',
       'org_venue_facilities'].includes(name)) return 'Tournament';
  if (name.startsWith('league_')) return 'League';
  if (name.startsWith('rep_')) return 'Rep Teams';
  if (['team_workspaces','team_org_links','team_workspace_claims',
       'team_entitlements','basic_coach_team_registrations',
       'basic_coach_team_users'].includes(name)) return 'Standalone Team Workspace';
  if (['accounting_entries','accounting_ledgers','org_payees',
       'budget_categories','budget_items','org_budget_lines','org_budget_periods',
       'billing_retained_records','billing_retention_intents'].includes(name)) return 'Accounting';
  if (name.startsWith('stripe_')) return 'Stripe / Billing';
  if (['organizations','organization_members','org_overrides','org_internal_notes',
       'org_member_rep_group_scopes','org_member_tournament_assignments',
       'org_audit_log','org_public_site_content'].includes(name)) return 'Organization / Platform Core';
  if (name.startsWith('platform_') || name.startsWith('plan_') ||
      ['push_subscriptions','notifications','notification_preferences',
       'tournament_notification_preferences'].includes(name)) return 'Platform Admin';
  if (name.startsWith('early_access') || name.startsWith('email_')) return 'CRM / Leads';
  return 'Other';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Querying live schema from fieldlogichq-dev...');

  const [colRows, fkRows, idxRows] = await Promise.all([
    apiQuery(`
      SELECT
        t.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default
      FROM information_schema.tables t
      JOIN information_schema.columns c
        ON c.table_name = t.table_name AND c.table_schema = t.table_schema
      WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position
    `),
    // The snapshot script's catalog query, not a second information_schema join: that join cost
    // 10–13 s per run, crossed the columns of every multi-column FK, and picked its winner in an
    // undefined order (see CONSTRAINTS_SQL's comment).
    apiQuery(CONSTRAINTS_SQL),
    apiQuery(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `),
  ]);

  // Build FK lookup: table -> col -> "foreign_table.foreign_col"
  // Only FKs to public tables get an arrow (an auth.users target has foreign_table null). A column
  // in several FKs shows ONE arrow: a single-column FK wins over a multi-column one, because
  // `team_id → rep_teams.id` says what the column is and a composite's half does not. Composites
  // are written first so a single-column FK always overwrites them. Between two FKs of the SAME kind
  // (two composites, or two single-column FKs on one column), the later constraint name in
  // CONSTRAINTS_SQL's order wins: deterministic, but arbitrary. Today every column shared by
  // composites also has a single-column FK, so no arrow depends on that tie-break.
  const fkWidth = {};
  for (const r of fkRows) {
    if (r.constraint_type !== 'FOREIGN KEY') continue;
    const k = `${r.table_name}.${r.constraint_name}`;
    fkWidth[k] = (fkWidth[k] || 0) + 1;
  }
  const fkPublic = fkRows.filter(r => r.constraint_type === 'FOREIGN KEY' && r.foreign_table);
  const fkMap = {};
  for (const pass of ['composite', 'single']) {
    for (const r of fkPublic) {
      const isComposite = fkWidth[`${r.table_name}.${r.constraint_name}`] > 1;
      if ((pass === 'composite') !== isComposite) continue;
      fkMap[r.table_name] = fkMap[r.table_name] || {};
      fkMap[r.table_name][r.column_name] = `${r.foreign_table}.${r.foreign_column}`;
    }
  }

  // Build index lookup: table -> [index names]
  const idxMap = {};
  for (const r of idxRows) {
    idxMap[r.tablename] = idxMap[r.tablename] || [];
    idxMap[r.tablename].push(r.indexname);
  }

  // Group columns by table
  const tableMap = {};
  for (const r of colRows) {
    tableMap[r.table_name] = tableMap[r.table_name] || [];
    tableMap[r.table_name].push(r);
  }

  const tableNames = Object.keys(tableMap).sort();
  console.log(`${tableNames.length} tables found.`);

  // Group tables by module
  const modules = {};
  for (const t of tableNames) {
    const mod = classifyTable(t);
    modules[mod] = modules[mod] || [];
    modules[mod].push(t);
  }

  // ── Build markdown ───────────────────────────────────────────────────────
  const now = new Date().toISOString().slice(0, 10);
  const lines = [];

  lines.push(`---`);
  lines.push(`name: reference_db_schema`);
  lines.push(`description: Complete public schema table+column list — auto-generated ${now} from live fieldlogichq-dev Supabase project.`);
  lines.push(`metadata:`);
  lines.push(`  node_type: memory`);
  lines.push(`  type: reference`);
  lines.push(`---`);
  lines.push(``);
  lines.push(`# DB Schema Reference — ${now}`);
  lines.push(``);
  lines.push(`**Auto-generated** from live \`fieldlogichq-dev\` project (ref \`${PROJECT_REF}\`) via Management API.`);
  lines.push(`Run \`node scripts/refresh-db-schema.mjs\` to refresh after applying migrations.`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  for (const mod of MODULE_ORDER) {
    const tables = modules[mod];
    if (!tables || tables.length === 0) continue;

    lines.push(`## Module: ${mod}`);
    lines.push(``);

    for (const tbl of tables) {
      lines.push(`### ${tbl}`);

      const cols = tableMap[tbl];
      const fks = fkMap[tbl] || {};

      const colParts = cols.map(c => {
        let desc = c.column_name;
        // Type annotation for non-obvious types
        if (['jsonb','json','uuid','text[]','boolean','integer','bigint',
             'numeric','timestamptz','timestamp without time zone',
             'time without time zone'].includes(c.data_type)) {
          const typeLabel = c.data_type === 'ARRAY' ? `${c.udt_name.replace('_','')}[]` : c.data_type;
          desc += ` (${typeLabel})`;
        }
        if (fks[c.column_name]) {
          desc += ` → ${fks[c.column_name]}`;
        }
        if (c.is_nullable === 'NO' && !c.column_default) {
          desc += ` NOT NULL`;
        }
        return desc;
      });
      lines.push(colParts.join(', '));

      const idxs = idxMap[tbl];
      if (idxs && idxs.length > 0) {
        lines.push(`- Indexes: ${idxs.join(', ')}`);
      }
      lines.push(``);
    }
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Tables by count`);
  lines.push(``);
  lines.push(`Total: **${tableNames.length} tables** across ${Object.keys(modules).filter(m => modules[m]?.length).length} modules.`);
  lines.push(``);
  for (const mod of MODULE_ORDER) {
    const tables = modules[mod];
    if (tables?.length) lines.push(`- ${mod}: ${tables.length} tables`);
  }

  const output = lines.join('\n');

  // Write to Claude auto-memory (loaded at conversation start)
  const claudeMemory = getClaudeMemoryPath();
  const claudePath = path.join(claudeMemory, 'reference_db_schema.md');
  fs.writeFileSync(claudePath, output, 'utf8');
  console.log(`Written to Claude memory: ${claudePath} (${Math.round(output.length / 1024)}KB)`);

  // Also write to project memory folder for reference
  const projectMemory = path.join(ROOT, 'memory', 'reference_db_schema.md');
  if (fs.existsSync(path.dirname(projectMemory))) {
    fs.writeFileSync(projectMemory, output, 'utf8');
    console.log(`Written to project memory: memory/reference_db_schema.md`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
