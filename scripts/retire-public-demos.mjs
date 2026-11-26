/**
 * retire-public-demos.mjs — delete the two retired public demo clubs and their two shared accounts. One-off.
 *
 * Retire the public demos, Phase 2 (docs/projects/active/RETIRE_PUBLIC_DEMOS_PLAN.md; owner ruling 2026-11-25,
 * BUSINESS_DECISIONS.md "Both public demos are RETIRED"; Decision D4: production data is deleted by a script on the
 * owner's yes, never by a weakened console).
 *
 *   node scripts/retire-public-demos.mjs                   # dev, dry run: counts what it would delete
 *   node scripts/retire-public-demos.mjs --apply           # dev, deletes
 *   node scripts/retire-public-demos.mjs --prod            # PRODUCTION, dry run (reads .env.production.local)
 *   node scripts/retire-public-demos.mjs --prod --apply    # PRODUCTION, deletes: ONLY after the owner has seen the
 *                                                          # --prod dry run's counts and said yes IN THAT SESSION
 *
 * What it deletes, in this order:
 *   1. The two demo clubs (riverdale-minor-ball, riverdale-ridge), by the SAME purge the platform-admin delete runs
 *      (app/api/platform-admin/orgs/[id]/delete/route.ts): the same table deletes in the same order before the
 *      organization row, the same audit rows, then the club's stored files through the same shared helpers
 *      (lib/org-storage-purge.ts, lib/resource-file-server.ts). tests/unit/retire-public-demos-script.test.ts fails
 *      if the route's table deletes and this script's drift apart. The console's demo refusal is NOT weakened: this
 *      script never calls the route.
 *   2. The two shared accounts (demo-organizer@example.com, demo-coach@example.com). Deleting an account deletes its
 *      sessions, which ends every open demo session.
 *
 * It refuses, before deleting anything, when a demo club holds something the console's own delete would stop on or
 * that a script should not undo by itself: a live Stripe subscription, an online-payments account, its own web
 * address, or a member who is not the club's shared account. It refuses to delete an account that belongs to any
 * club other than the two demos, or that a non-cascading record still names once the clubs are gone.
 *
 * Prints COUNTS ONLY, never rows (the 2026-11-18 production-read rule). The demo data is fictional; the rule holds anyway.
 * The shared account is found as the demo club's own member (never by searching every account), and only if its email
 * is the registry's, so the script cannot reach a stranger who signed up with that address.
 * Re-runnable: a club or account that is already gone is reported as gone. A club deleted by an earlier run is found
 * again through that run's own `delete_organization` record (written strictly, before anything changes), which names
 * its account and its files, so a re-run finishes an account or a file removal that was left behind.
 */
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const wantProd = argv.includes('--prod');
const apply = argv.includes('--apply');
const unknown = argv.filter(a => a !== '--prod' && a !== '--apply');
if (unknown.length) {
  console.error(`✖ Unknown argument(s): ${unknown.join(' ')}. Use --apply and/or --prod.`);
  process.exit(1);
}

const PROD_PROJECT_REF = 'qcttcboqysynwcdyghil';
const DEV_PROJECT_REF = 'npgnrxaitgbtbtvvykto';

/* ── The host guard. ONE env file, loaded into this process BEFORE any module that reads it (lib/supabase-admin.ts
   builds its client at import), and the project it points at must be the one the flag asked for. ───────────── */
const ENV_FILE = path.join(ROOT, wantProd ? '.env.production.local' : '.env.local');
if (!existsSync(ENV_FILE)) {
  console.error(`✖ ${path.basename(ENV_FILE)} not found. Nothing was read or changed.`);
  process.exit(1);
}
process.loadEnvFile(ENV_FILE);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/i.exec(supabaseUrl)?.[1] ?? null;
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !ref) {
  console.error(`✖ ${path.basename(ENV_FILE)} has no Supabase URL or service key. Nothing was read or changed.`);
  process.exit(1);
}
if (wantProd && ref !== PROD_PROJECT_REF) {
  console.error('✖ --prod was given but the env file does not point at the production project. Nothing was read or changed.');
  process.exit(1);
}
if (!wantProd && ref !== DEV_PROJECT_REF) {
  console.error('✖ Without --prod this runs only against the dev project, and the env file points elsewhere. Nothing was read or changed.');
  process.exit(1);
}

// The app's modules import each other without extensions; this resolver (the unit suite's) lets node load them.
await import('../tests/ts-resolver.mjs');
const { supabaseAdmin: db } = await import('../lib/supabase-admin.ts');
const { DEMO_ORGS } = await import('../lib/demo-org.ts');
const { countOrgFiles, removeOrgFiles } = await import('../lib/org-storage-purge.ts');
const { readOrgLegacyResourceKeys, legacyKeysNoRowNames } = await import('../lib/resource-file-server.ts');
const { writePlatformAuditLog, writePlatformAuditLogStrict } = await import('../lib/platform-audit.ts');

/** The two retired demos. Checked against the product's own registry below, so a typo cannot aim this at a real club. */
const DEMOS = [
  { slug: 'riverdale-minor-ball', email: 'demo-organizer@example.com' },
  { slug: 'riverdale-ridge', email: 'demo-coach@example.com' },
];
for (const d of DEMOS) {
  if (!DEMO_ORGS.some(o => o.slug === d.slug && o.organizerEmail === d.email)) {
    console.error(`✖ ${d.slug} / ${d.email} is not in lib/demo-org.ts's demo registry. Nothing was read or changed.`);
    process.exit(1);
  }
}

/**
 * The route's table deletes before the organization row, in its order (a NO ACTION foreign key on org_id each; the
 * club's held time before the facilities its blocks name). tests/unit/retire-public-demos-script.test.ts compares this
 * list with the route's code.
 */
const ORG_PRE_DELETES = [
  'club_schedules',
  'org_time_blocks',
  'org_venue_facilities',
  'billing_retained_records',
  'billing_retention_intents',
];

/**
 * Columns that name an account and do NOT cascade when it is deleted (read from dev's foreign keys 2026-11-25:
 * public foreign keys to auth.users with ON DELETE NO ACTION or RESTRICT). A row in one of these still naming a
 * shared account after its club is gone would make the account delete fail, so the script counts them first.
 */
const NON_CASCADING_ACCOUNT_COLUMNS = [
  ['accounting_entries', 'created_by'], ['league_email_log', 'sent_by'], ['league_notification_log', 'sent_by'],
  ['org_payees', 'created_by'], ['rep_allocation_installments', 'paid_by'], ['rep_cost_allocations', 'created_by'],
  ['rep_document_templates', 'published_by'], ['rep_dues_credits', 'created_by'], ['rep_player_documents', 'uploaded_by'],
  ['rep_season_surplus', 'created_by'], ['rep_team_expenses', 'created_by'], ['rep_team_payment_requests', 'created_by'],
  ['rep_team_payment_requests', 'reviewed_by'], ['tournament_archives', 'sealed_by'],
];

const ACTOR = 'scripts/retire-public-demos.mjs';
const REASON = 'Retire the public demos, Phase 2 (owner ruling 2026-11-25: both public demos are retired).';

function fail(label, error) {
  console.error(`✖ ${label}: ${error?.message ?? error}`);
  process.exit(1);
}

async function count(table, column, value, extra) {
  let q = db.from(table).select('*', { count: 'exact', head: true }).eq(column, value);
  if (extra) q = extra(q);
  const { count: n, error } = await q;
  if (error) fail(`count ${table}.${column}`, error);
  return n ?? 0;
}

/**
 * One account by id, and only if its email is the demo's. The shared account is never found by searching every
 * account (that would load real people's records on production, against the 2026-11-18 rule): it is the demo club's
 * own member, or, once the club is gone, the id this script recorded when it deleted the club.
 */
async function accountById(id, email) {
  const { data, error } = await db.auth.admin.getUserById(id);
  if (error) {
    if (error.status === 404 || /not found/i.test(error.message ?? '')) return null;
    fail('read the shared account', error);
  }
  const u = data?.user ?? null;
  return u && (u.email ?? '').toLowerCase() === email ? u : null;
}

async function clubAccount(orgId, email) {
  const { data, error } = await db.from('organization_members').select('user_id').eq('organization_id', orgId).limit(5);
  if (error) fail('read the club\'s members', error);
  for (const r of data ?? []) {
    const u = await accountById(r.user_id, email);
    if (u) return u;
  }
  return null;
}

/** This script's latest audit row among `actions` whose new_value.<key> is `value` (a re-run's only memory of a deleted club). */
async function lastAudit(actions, key, value) {
  const { data, error } = await db.from('platform_audit_log').select('action, new_value')
    .eq('actor_email', ACTOR).in('action', actions).eq(`new_value->>${key}`, value)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) fail(`read this script's ${actions[0]} record`, error);
  return data ?? null;
}

/** The route's file half (purgeOrgFiles), after the rows: a legacy rules file another club's row still names is kept.
 *  Returns false when anything was left; the `_failed` audit row lets a re-run try again. */
async function purgeFiles(slug, id, legacyKeys) {
  let files;
  try {
    const { free, unread } = await legacyKeysNoRowNames(legacyKeys ?? [], id);
    files = await removeOrgFiles({ storage: db.storage, orgId: id, legacyResourceKeys: free });
    if (unread.length) files.failed.push({ bucket: 'resources', keyOrPrefix: `${unread.length} legacy rules file(s)`, message: 'not checked, kept' });
  } catch (err) {
    files = { removed: 0, byBucket: {}, failed: [{ bucket: '?', keyOrPrefix: `${id}/`, message: err?.message ?? String(err) }] };
  }
  await writePlatformAuditLog(ACTOR, null, files.failed.length ? 'delete_organization_files_failed' : 'delete_organization_files',
    'org_id', id, { orgId: id, orgSlug: slug, legacyResourceKeys: legacyKeys ?? [], removed: files.removed,
      byBucket: files.byBucket, failedCount: files.failed.length }, { reason: REASON });
  console.log(`✓ ${slug}: ${files.removed} stored file(s) removed${files.failed.length ? `, ${files.failed.length} NOT removed (run again to retry)` : ''}`);
  return files.failed.length === 0;
}

async function accountReferences(userId) {
  let total = 0;
  const byTable = {};
  for (const [table, column] of NON_CASCADING_ACCOUNT_COLUMNS) {
    const n = await count(table, column, userId);
    if (n) { total += n; byTable[`${table}.${column}`] = n; }
  }
  return { total, byTable };
}

console.log(`${wantProd ? '⚠ PRODUCTION' : 'dev'} — ${apply ? 'DELETING' : 'dry run (add --apply to delete)'}\n`);

/* ── Read and count everything first; refuse before any change. ─────────────────────────────────────────────── */
const plan = [];
const refusals = [];
for (const d of DEMOS) {
  const { data: org, error } = await db.from('organizations')
    .select('id, slug, stripe_subscription_id, subscription_status').eq('slug', d.slug).maybeSingle();
  if (error) fail(`read ${d.slug}`, error);
  let account = null;
  let filesRetry = null;
  if (org) {
    account = await clubAccount(org.id, d.email);
  } else {
    // A re-run: the club went in an earlier run. That run's record names the account and the files it held.
    const deleted = await lastAudit(['delete_organization'], 'orgSlug', d.slug);
    const v = deleted?.new_value ?? {};
    if (v.demoAccountId) account = await accountById(v.demoAccountId, d.email);
    if (v.orgId) {
      const files = await lastAudit(['delete_organization_files', 'delete_organization_files_failed'], 'orgId', v.orgId);
      if (files?.action !== 'delete_organization_files') filesRetry = { orgId: v.orgId, legacyKeys: v.legacyResourceKeys ?? [] };
    }
  }
  const entry = { ...d, org, account, filesRetry, counts: {} };
  plan.push(entry);
  if (filesRetry) entry.counts['stored files left by an earlier run (retried)'] = 'yes';

  if (org) {
    const legacyKeys = await readOrgLegacyResourceKeys(org.id);
    if (!legacyKeys) refusals.push(`${d.slug}: its rules files could not be read`);
    const files = await countOrgFiles({ storage: db.storage, orgId: org.id, legacyResourceKeys: legacyKeys ?? [] });
    if (files.failed.length) refusals.push(`${d.slug}: its stored files could not be counted`);
    const members = await count('organization_members', 'organization_id', org.id);
    const otherMembers = account
      ? await count('organization_members', 'organization_id', org.id, q => q.neq('user_id', account.id))
      : members;
    entry.legacyKeys = legacyKeys;
    entry.counts = {
      members,
      'members other than the shared account': otherMembers,
      tournaments: await count('tournaments', 'org_id', org.id),
      teams: await count('rep_teams', 'org_id', org.id),
      'stored files': files.removed,
    };
    if (org.stripe_subscription_id && org.subscription_status !== 'canceled') refusals.push(`${d.slug}: a live Stripe subscription`);
    if (await count('org_payment_accounts', 'org_id', org.id)) refusals.push(`${d.slug}: an online-payments account`);
    if (await count('org_custom_domains', 'org_id', org.id)) refusals.push(`${d.slug}: its own web address`);
    if (otherMembers) refusals.push(`${d.slug}: ${otherMembers} member(s) other than its shared account`);
  }
}

// The accounts, once both clubs are read (a shared account's membership in EITHER demo club is not "elsewhere").
const demoIds = plan.map(p => p.org?.id).filter(Boolean);
for (const e of plan) {
  if (!e.account) continue;
  const elsewhere = await count('organization_members', 'user_id', e.account.id,
    q => (demoIds.length ? q.not('organization_id', 'in', `(${demoIds.join(',')})`) : q));
  e.counts['account: clubs other than the demos'] = elsewhere;
  e.counts['account: non-cascading records naming it (before the club goes)'] = (await accountReferences(e.account.id)).total;
  if (elsewhere) refusals.push(`${e.email}: belongs to ${elsewhere} club(s) other than the demos`);
}

for (const e of plan) {
  console.log(`${e.slug}: club ${e.org ? 'present' : 'already gone'}; ${e.email}: account ${e.account ? 'present' : 'not found (already gone)'}`);
  for (const [k, v] of Object.entries(e.counts)) console.log(`    ${k}: ${v}`);
}

if (refusals.length) {
  console.error('\n✖ Refused. Nothing was changed:');
  for (const r of refusals) console.error(`    ${r}`);
  process.exit(1);
}
if (!apply) {
  console.log('\nDry run: nothing was changed. Run again with --apply to delete.');
  process.exit(0);
}

/* ── Delete. Clubs first (the route's purge), then the accounts. ───────────────────────────────────────────── */
let problems = 0;
for (const e of plan) {
  if (!e.org) {
    if (e.filesRetry && !(await purgeFiles(e.slug, e.filesRetry.orgId, e.filesRetry.legacyKeys))) problems++;
    continue;
  }
  const id = e.org.id;
  // Written FIRST and strictly: it is a re-run's only record of this club's id, its rules files and its account.
  try {
    await writePlatformAuditLogStrict(ACTOR, null, 'delete_organization', 'org_slug', e.slug,
      { orgId: id, orgSlug: e.slug, legacyResourceKeys: e.legacyKeys, demoAccountId: e.account?.id ?? null, via: ACTOR },
      { reason: REASON });
  } catch (err) { fail(`${e.slug}: write the change log first (nothing of this club was changed)`, err); }
  for (const table of ORG_PRE_DELETES) {
    const { error } = await db.from(table).delete().eq('org_id', id);
    if (error) fail(`${e.slug}: delete from ${table}`, error);
  }
  const { error: orgError } = await db.from('organizations').delete().eq('id', id);
  if (orgError) fail(`${e.slug}: delete the club`, orgError);
  console.log(`✓ ${e.slug}: club deleted`);
  if (!(await purgeFiles(e.slug, id, e.legacyKeys))) problems++;
}

for (const e of plan) {
  if (!e.account) continue;
  const refs = await accountReferences(e.account.id);
  if (refs.total) {
    console.error(`✖ ${e.email}: NOT deleted. ${refs.total} non-cascading record(s) still name it:`);
    for (const [k, v] of Object.entries(refs.byTable)) console.error(`    ${k}: ${v}`);
    problems++;
    continue;
  }
  const { error } = await db.auth.admin.deleteUser(e.account.id);
  if (error) { console.error(`✖ ${e.email}: NOT deleted: ${error.message}`); problems++; continue; }
  await writePlatformAuditLog(ACTOR, null, 'delete_demo_account', 'email', e.email, { via: ACTOR }, { reason: REASON });
  console.log(`✓ ${e.email}: account deleted (its sessions with it)`);
}

/* ── Read back. ─────────────────────────────────────────────────────────────────────────────────────────── */
const { count: clubsLeft, error: readBackError } = await db.from('organizations')
  .select('*', { count: 'exact', head: true }).in('slug', DEMOS.map(d => d.slug));
if (readBackError) fail('read back the clubs', readBackError);
let accountsLeft = 0;
for (const e of plan) if (e.account && await accountById(e.account.id, e.email)) accountsLeft++;
console.log(`\nRead back: demo clubs left ${clubsLeft ?? 0}, shared accounts left ${accountsLeft}.`);
process.exit(problems || clubsLeft || accountsLeft ? 1 : 0);
