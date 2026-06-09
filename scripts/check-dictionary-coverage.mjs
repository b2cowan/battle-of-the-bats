/**
 * check-dictionary-coverage.mjs  —  the Data Dictionary staleness ratchet (Layer 1)
 *
 * Fails when the LIVE schema (from the committed snapshots) contains tables (or, in a
 * "sealed" domain, columns) that are neither documented in docs/agents/db/DATA_DICTIONARY.md
 * NOR consciously waived in scripts/.dictionary-coverage-baseline.json. This is what makes
 * "schema change ⇒ dictionary change" self-enforcing: a future migration that adds a table
 * cannot land silently — it must be documented or acknowledged.
 *
 * Modeled on scripts/check-public-tokens.mjs (a baseline-ratchet). See
 * docs/projects/active/DATA_DICTIONARY_PLAN.md §11.
 *
 * Progressive strictness:
 *   - Always: every live table must be documented or acknowledged (TABLE granularity).
 *   - Per sealed domain (baseline.sealedDomains): every live column in that domain's tables
 *     must be documented or acknowledged (COLUMN granularity). Domains seal as their phase lands.
 *
 * Dictionary anchors (emitted by DATA_DICTIONARY.md, parsed here — format-independent):
 *   <!-- dict:table:<table> -->            marks a table as documented
 *   <!-- dict:col:<table>.<column> -->     marks a column as documented
 *
 * Usage:
 *   node scripts/check-dictionary-coverage.mjs              # validate (exit 1 on gap)
 *   node scripts/check-dictionary-coverage.mjs --summary    # print coverage stats
 *   node scripts/check-dictionary-coverage.mjs --init        # seed baseline (refuses to clobber; --force to override)
 *   node scripts/check-dictionary-coverage.mjs --reconcile   # add new / drop dead tables, preserve waivers + seals
 *
 * Assumes lowercase snake_case identifiers (every current table/column matches ^[a-z0-9_]+$).
 * Anchors in fenced/inline code in the dictionary are ignored (they're format examples).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SNAP_DIR = path.join(ROOT, 'docs', 'agents', 'db', 'schema-snapshots');
const DICT_PATH = path.join(ROOT, 'docs', 'agents', 'db', 'DATA_DICTIONARY.md');
const BASELINE_PATH = path.join(__dirname, '.dictionary-coverage-baseline.json');

const ARGS = process.argv.slice(2);
const SUMMARY = ARGS.includes('--summary');
const INIT = ARGS.includes('--init');
const FORCE = ARGS.includes('--force');
const RECONCILE = ARGS.includes('--reconcile');

// ── domain taxonomy (the dictionary's canonical 10 domains) ───────────────────
// Single source of truth for domain names. baseline.sealedDomains entries are validated against
// this list at startup so a typo (e.g. "Stripe/Billing") can't silently disable a seal.
const DOMAINS = [
  'Org / Platform core',
  'Tournaments & Registration',
  'Coaches / basic-teams',
  'Rep teams / team workspaces',
  'League / house-league',
  'Accounting',
  'Stripe / Billing',
  'Platform admin',
  'CRM',
  'Notifications & Push',
  'Unclassified',
];

function domainOf(t) {
  if (t.startsWith('rep_') || ['team_workspaces', 'team_org_links', 'team_workspace_claims', 'team_entitlements'].includes(t))
    return 'Rep teams / team workspaces';
  if (t.startsWith('league_')) return 'League / house-league';
  if (t.startsWith('basic_coach_')) return 'Coaches / basic-teams';
  if (t.startsWith('stripe_')) return 'Stripe / Billing';
  if (['notifications', 'notification_preferences', 'tournament_notification_preferences', 'push_subscriptions', 'fan_push_subscriptions', 'platform_email_templates', 'email_batches', 'email_sends'].includes(t))
    return 'Notifications & Push';
  if (t.startsWith('platform_') || t.startsWith('plan_') || ['import_batches', 'import_batch_rows'].includes(t))
    return 'Platform admin';
  if (t.startsWith('early_access')) return 'CRM';
  if (['accounting_entries', 'accounting_ledgers', 'org_payees', 'budget_categories', 'budget_items', 'org_budget_lines', 'org_budget_periods', 'billing_retained_records', 'billing_retention_intents'].includes(t))
    return 'Accounting';
  if (['organizations', 'organization_members', 'org_overrides', 'org_internal_notes', 'org_member_rep_group_scopes', 'org_member_tournament_assignments', 'org_audit_log', 'org_public_site_content'].includes(t))
    return 'Org / Platform core';
  if (['tournaments', 'divisions', 'teams', 'games', 'pools', 'pool_slots', 'diamonds', 'announcements', 'rules', 'rule_items', 'resources', 'tournament_archives', 'tournament_registration_fields', 'tournament_registration_field_answers', 'tournament_roster_players', 'venue_facilities', 'org_venues', 'org_venue_facilities', 'schedule_facility_lanes'].includes(t))
    return 'Tournaments & Registration';
  return 'Unclassified';
}

// ── load live schema (union of dev + prod) ────────────────────────────────────
function loadLive() {
  const tableCols = {}; // table -> Set(columns)
  for (const env of ['dev', 'prod']) {
    const f = path.join(SNAP_DIR, `schema-dump-columns-${env}.json`);
    if (!fs.existsSync(f)) {
      console.error(`Missing snapshot ${f} — run "node scripts/refresh-db-snapshots.mjs" first.`);
      process.exit(1);
    }
    for (const r of JSON.parse(fs.readFileSync(f, 'utf8'))) {
      (tableCols[r.table_name] ||= new Set()).add(r.column_name);
    }
  }
  return tableCols;
}

// ── parse the dictionary's anchors (if it exists yet) ─────────────────────────
function loadDocumented() {
  const tables = new Set();
  const cols = new Set();
  if (fs.existsSync(DICT_PATH)) {
    let md = fs.readFileSync(DICT_PATH, 'utf8');
    // Strip fenced + inline code so the dictionary's OWN format examples (it documents its anchor
    // syntax in the header) can't falsely mark a table/column as covered. Only real anchors count.
    md = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of md.matchAll(/<!--\s*dict:table:([a-z0-9_]+)\s*-->/g)) tables.add(m[1]);
    for (const m of md.matchAll(/<!--\s*dict:col:([a-z0-9_]+\.[a-z0-9_]+)\s*-->/g)) cols.add(m[1]);
  }
  return { tables, cols };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
}

// ── --init: seed the baseline acknowledging all current tables ────────────────
function initBaseline() {
  if (fs.existsSync(BASELINE_PATH) && !FORCE) {
    console.error(`Baseline already exists: ${BASELINE_PATH}`);
    console.error(
      'Refusing to overwrite hand-edited waivers/seals. Use --reconcile to add new + drop dead\n' +
        'tables (preserving sealedDomains, acknowledgedColumns, and custom reasons), or --force to reseed.',
    );
    process.exit(1);
  }
  const live = loadLive();
  const acknowledgedTables = {};
  for (const t of Object.keys(live).sort()) {
    acknowledgedTables[t] = `pending-documentation (${domainOf(t)})`;
  }
  const baseline = {
    _comment:
      'Coverage ratchet for docs/agents/db/DATA_DICTIONARY.md. See DATA_DICTIONARY_PLAN.md §11. ' +
      'Every live table must be documented in the dictionary (<!-- dict:table:NAME --> anchor) OR ' +
      'listed in acknowledgedTables. A future migration that adds a table absent from BOTH fails ' +
      '`npm run check:dictionary`. When a domain phase completes, add it to sealedDomains and the ' +
      'check tightens to column granularity for that domain (each live column must have a ' +
      '<!-- dict:col:TABLE.COLUMN --> anchor or be listed in acknowledgedColumns). As tables get ' +
      'documented, remove them from acknowledgedTables.',
    generated: new Date().toISOString().slice(0, 10),
    sealedDomains: [],
    acknowledgedTables,
    acknowledgedColumns: {},
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`Seeded ${BASELINE_PATH} with ${Object.keys(acknowledgedTables).length} acknowledged tables.`);
}

// ── --reconcile: add newly-appeared tables, drop dead ones, preserve everything else ──
function reconcileBaseline() {
  const existing = loadBaseline();
  if (!existing) {
    console.error('No baseline to reconcile — run --init first.');
    process.exit(1);
  }
  const live = loadLive();
  const liveTables = new Set(Object.keys(live));
  const documented = loadDocumented();
  const ack = { ...(existing.acknowledgedTables || {}) };
  const added = [];
  const removed = [];
  for (const t of [...liveTables].sort()) {
    if (!ack[t] && !documented.tables.has(t)) {
      ack[t] = `pending-documentation (${domainOf(t)})`;
      added.push(t);
    }
  }
  for (const t of Object.keys(ack)) {
    if (!liveTables.has(t)) {
      delete ack[t];
      removed.push(t);
    }
  }
  const sortedAck = {};
  for (const t of Object.keys(ack).sort()) sortedAck[t] = ack[t];
  const out = {
    _comment: existing._comment,
    generated: existing.generated,
    sealedDomains: existing.sealedDomains || [],
    acknowledgedTables: sortedAck,
    acknowledgedColumns: existing.acknowledgedColumns || {},
  };
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`Reconciled: +${added.length} new (${added.join(', ') || 'none'}), -${removed.length} dead (${removed.join(', ') || 'none'}).`);
}

// ── validate ──────────────────────────────────────────────────────────────────
function validate() {
  const live = loadLive();
  const baseline = loadBaseline();
  if (!baseline) {
    console.error(`No baseline found. Run "node scripts/check-dictionary-coverage.mjs --init" first.`);
    process.exit(1);
  }
  const documented = loadDocumented();
  const ackTables = new Set(Object.keys(baseline.acknowledgedTables || {}));
  const sealed = new Set(baseline.sealedDomains || []);
  const sealedTables = new Set(baseline.sealedTables || []);
  const ackCols = baseline.acknowledgedColumns || {};

  // A sealed-domain name that doesn't match a real domain would silently enforce nothing.
  for (const d of sealed) {
    if (!DOMAINS.includes(d)) {
      console.error(`✖ baseline.sealedDomains contains unknown domain "${d}".`);
      console.error(`  Valid domains: ${DOMAINS.join(' | ')}`);
      process.exit(1);
    }
  }
  // A sealed table name that isn't live would silently enforce nothing (typo / dropped table).
  for (const t of sealedTables) {
    if (!live[t]) {
      console.error(`✖ baseline.sealedTables lists "${t}" which is not a live table (typo or dropped — run --reconcile).`);
      process.exit(1);
    }
  }

  const liveTables = Object.keys(live).sort();
  const uncoveredTables = [];
  const uncoveredCols = [];
  let documentedCount = 0;

  for (const t of liveTables) {
    const isDocumented = documented.tables.has(t);
    const isAck = ackTables.has(t);
    if (isDocumented) documentedCount++;
    if (!isDocumented && !isAck) {
      uncoveredTables.push(`${t}  (${domainOf(t)})`);
      continue;
    }
    // column granularity for sealed domains OR individually sealed tables
    if (sealed.has(domainOf(t)) || sealedTables.has(t)) {
      const waived = new Set(ackCols[t] || []);
      for (const c of [...live[t]].sort()) {
        if (!documented.cols.has(`${t}.${c}`) && !waived.has(c)) {
          uncoveredCols.push(`${t}.${c}`);
        }
      }
    }
  }

  if (SUMMARY) {
    console.log(`Dictionary coverage — ${liveTables.length} live tables (dev∪prod)`);
    console.log(`  documented:   ${documentedCount}`);
    console.log(`  acknowledged: ${liveTables.filter((t) => !documented.tables.has(t) && ackTables.has(t)).length}`);
    console.log(`  sealed domains: ${sealed.size ? [...sealed].join(', ') : '(none yet)'}`);
    console.log(`  sealed tables:  ${sealedTables.size} (column-granular)`);
    const staleAck = [...ackTables].filter((t) => !live[t]).sort();
    if (staleAck.length) console.log(`  ⚠ stale acknowledged (no longer live — run --reconcile): ${staleAck.join(', ')}`);
  }

  if (uncoveredTables.length || uncoveredCols.length) {
    console.error('\n✖ Data Dictionary coverage gap — the live schema has surface that is neither');
    console.error('  documented (in DATA_DICTIONARY.md) nor acknowledged (in the coverage baseline).\n');
    if (uncoveredTables.length) {
      console.error(`  Undocumented/unacknowledged TABLES (${uncoveredTables.length}):`);
      for (const t of uncoveredTables) console.error(`    - ${t}`);
    }
    if (uncoveredCols.length) {
      console.error(`\n  Undocumented COLUMNS in sealed domains (${uncoveredCols.length}):`);
      for (const c of uncoveredCols) console.error(`    - ${c}`);
    }
    console.error('\n  Fix: document them in docs/agents/db/DATA_DICTIONARY.md (add the dict: anchors),');
    console.error('  or, if intentionally undocumented, add them to scripts/.dictionary-coverage-baseline.json.');
    process.exit(1);
  }

  console.log(`✓ Dictionary coverage OK — ${liveTables.length} live tables all documented or acknowledged.`);
}

if (INIT) initBaseline();
else if (RECONCILE) reconcileBaseline();
else validate();
