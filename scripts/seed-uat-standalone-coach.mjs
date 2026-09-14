/**
 * Clone a coached team into a brand-new STANDALONE Premium Coaches Portal on the DEV database.
 *
 * WHY THIS EXISTS. The UAT coach fixture (`UAT Test Team` inside `uat-test-org`) is a club-linked
 * team: every coach walk so far has been taken from inside a club. A standalone head coach — the
 * per-team Premium customer with no organization behind them — reads a different portal (their own
 * shadow org, `team_workspaces` billing, Settings → Start next season, no club money) and had no
 * fixture at all with data in it. The dev seed route provisions an EMPTY standalone workspace; this
 * script provisions one holding a faithful copy of a team the owner already knows.
 *
 *   node scripts/seed-uat-standalone-coach.mjs --dry-run --null-dangling   # plan + counts, writes nothing
 *   node scripts/seed-uat-standalone-coach.mjs --null-dangling             # build it (refuses if the slug exists)
 *   node scripts/seed-uat-standalone-coach.mjs --null-dangling --reset     # delete and rebuild
 *
 * `--null-dangling` is what the UAT team needs: its ledger holds two "Rep allocation payment"
 * transfers whose club-side halves are gone even in the source (the allocation was deleted under
 * them), so the link is written NULL. Without the flag any such reference aborts the run and is
 * named, which is the right default for a team you have not looked at.
 *
 * Defaults clone uat-test-org/uat-test-team into org `uat-standalone` as "UAT Standalone Team",
 * owned by UAT_COACH_EMAIL. Override with --from-org, --from-team, --slug, --team-name, --team-slug,
 * --owner <email>.
 *
 * HOW IT WORKS — the schema is read live, never from a hand-kept table list.
 *   1. The clone SET is the FK closure from `rep_teams` (+ the team's accounting ledger): every table
 *      whose rows can reference a cloned row, transitively. Workspace plumbing and club-side money
 *      (`EXCLUDED`) never join it.
 *   2. Row SELECTION is a fixed point over OWNERSHIP keys (the NOT NULL in-set foreign keys, plus a
 *      nullable `team_id`): a row is cloned when one of those points at a cloned row. Any other
 *      reference is remapped, kept as-is when it names a platform-shared row (a platform budget
 *      category), or reported as dangling. Club-level rows (org_id set, team_id NULL) that the team's data references — a
 *      club expense tag on a team expense, say — are ADOPTED as team-owned rows, because a team with
 *      no club cannot have club words. Every id is re-minted through one `id_map`.
 *   3. INSERTS run in FK order over the NOT NULL edges; nullable in-set references (self-links,
 *      the fundraiser-entry ↔ credit cycle) are written NULL and patched in a second pass.
 *   4. The whole thing is ONE transaction. A dangling reference, a unique collision or a missing
 *      owner membership aborts it with nothing written.
 *
 * What is written for the workspace itself mirrors `lib/team-workspace-provisioning.ts`
 * (provisionStandaloneTeamWorkspace) field for field — the shadow org, the owner membership, the
 * `team_workspaces` + `team_entitlements` rows and the org "General" ledger. It is not imported
 * because that module drags the Next.js runtime in behind `lib/db.ts`; if the provisioner changes
 * shape, change the block marked PROVISIONER MIRROR below.
 *
 * ⚠ Secrets are never copied: every `*token_hash` column is NULLed (or re-minted at random where
 * NOT NULL). A copied token would be one credential opening two teams.
 *
 * ⚠ DEV ONLY. Hard-wired to the dev project ref; there is no --prod.
 */
import https from 'https';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

// ── env ──────────────────────────────────────────────────────────────────────
for (const line of fs.existsSync(path.join(ROOT, '.env.local')) ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n') : []) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
}
const DEV_PROJECT_REF = 'npgnrxaitgbtbtvvykto';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('✗ SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }

// ── args ─────────────────────────────────────────────────────────────────────
const args = { dryRun: false, reset: false, nullDangling: false, fromOrg: 'uat-test-org', fromTeam: 'uat-test-team',
  slug: 'uat-standalone', teamName: 'UAT Standalone Team', teamSlug: 'uat-standalone-team', owner: process.env.UAT_COACH_EMAIL ?? null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--dry-run') args.dryRun = true;
  else if (a === '--reset') args.reset = true;
  else if (a === '--null-dangling') args.nullDangling = true;
  else if (a === '--from-org') args.fromOrg = argv[++i];
  else if (a === '--from-team') args.fromTeam = argv[++i];
  else if (a === '--slug') args.slug = argv[++i];
  else if (a === '--team-name') args.teamName = argv[++i];
  else if (a === '--team-slug') args.teamSlug = argv[++i];
  else if (a === '--owner') args.owner = argv[++i];
  else { console.error(`Unknown arg: ${a}`); process.exit(1); }
}
if (!args.owner) { console.error('✗ No owner: set UAT_COACH_EMAIL in .env.local or pass --owner <email>.'); process.exit(1); }
if (!/^[a-z0-9-]+$/.test(args.slug) || !/^[a-z0-9-]+$/.test(args.teamSlug)) { console.error('✗ Slugs must be lowercase a-z, 0-9 and dashes.'); process.exit(1); }

// ── tables that never join the clone ─────────────────────────────────────────
/** Workspace plumbing is written by the PROVISIONER MIRROR below; club-side money cannot exist for
 *  a team with no club (a club's allocations billed to the team, the team's requests back to it,
 *  the club's own budget). Anything in the set that points at one of these is a dangling
 *  reference and is reported before anything is written. */
const EXCLUDED = new Set([
  'organizations', 'team_workspaces', 'team_entitlements', 'team_org_links', 'team_workspace_claims',
  'rep_cost_allocations', 'rep_allocation_splits', 'rep_allocation_installments', 'rep_team_payment_requests',
  'org_budget_lines', 'org_budget_periods',
]);

// ── sql runner (Supabase Management API, dev only) ───────────────────────────
function apiQuery(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${DEV_PROJECT_REF}/database/query`,
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
async function sql(query) {
  const res = await apiQuery(query);
  if (res.status < 200 || res.status >= 300) {
    let msg = res.body;
    try { msg = JSON.parse(res.body).message ?? res.body; } catch { /* raw */ }
    throw new Error(msg);
  }
  return JSON.parse(res.body);
}
const lit = v => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const q = name => `"${name}"`;

// ── 1. resolve the source and the owner ──────────────────────────────────────
const [src] = await sql(`
  select o.id as org_id, o.name as org_name, rt.id as team_id, rt.name as team_name,
         (select id from rep_program_years y where y.team_id = rt.id and y.status = 'active' order by y.year desc limit 1) as active_year_id,
         (select id from auth.users where lower(email) = lower(${lit(args.owner)})) as owner_id,
         (select id from organizations where slug = ${lit(args.slug)}) as target_org_id
    from organizations o join rep_teams rt on rt.org_id = o.id
   where o.slug = ${lit(args.fromOrg)} and rt.slug = ${lit(args.fromTeam)}`);
if (!src) { console.error(`✗ No team ${args.fromOrg}/${args.fromTeam} on dev.`); process.exit(1); }
if (!src.owner_id) { console.error(`✗ No auth user ${args.owner} on dev.`); process.exit(1); }
if (src.target_org_id && !args.reset) { console.error(`✗ Org slug "${args.slug}" already exists. Pass --reset to delete and rebuild it.`); process.exit(1); }

// ── 2. live schema ───────────────────────────────────────────────────────────
const columns = await sql(`
  select table_name, column_name, data_type, is_nullable = 'YES' as nullable,
         (is_generated = 'ALWAYS' or identity_generation is not null) as generated, ordinal_position
    from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`);
// Column PAIRS from pg_catalog, not information_schema — a composite FK such as
// (goal_id, team_id) → (id, team_id) cross-joins there and would read team_id as a key into the
// goals table. Only the pair landing on the parent's `id` is a reference this script remaps.
const fks = await sql(`
  select cl.relname as table_name, a.attname as column_name, fcl.relname as foreign_table
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    join pg_class fcl on fcl.oid = con.confrelid
    cross join lateral unnest(con.conkey, con.confkey) with ordinality as k(attnum, fattnum, ord)
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
    join pg_attribute fa on fa.attrelid = con.confrelid and fa.attnum = k.fattnum
   where con.contype = 'f' and ns.nspname = 'public' and fa.attname = 'id'`);

const cols = new Map();  // table -> [{name, type, nullable, generated}]
for (const c of columns) {
  if (!cols.has(c.table_name)) cols.set(c.table_name, []);
  cols.get(c.table_name).push({ name: c.column_name, type: c.data_type, nullable: c.nullable, generated: c.generated });
}
const hasCol = (t, c) => (cols.get(t) ?? []).some(x => x.name === c);
const fkOf = (t, c) => fks.find(f => f.table_name === t && f.column_name === c)?.foreign_table ?? null;

// The clone set: FK closure from the seeds, never crossing EXCLUDED.
const SET = new Set(['rep_teams', 'accounting_ledgers']);
for (let grew = true; grew;) {
  grew = false;
  for (const f of fks) {
    if (SET.has(f.foreign_table) && !SET.has(f.table_name) && !EXCLUDED.has(f.table_name)) { SET.add(f.table_name); grew = true; }
  }
}

// Per-table plan.
const plan = new Map();
for (const t of SET) {
  const tc = cols.get(t);
  const hasId = tc.some(c => c.name === 'id');
  const inSetFks = [];      // {col, to, nullable}
  const orgCols = [];       // FK -> organizations
  const outsideOrgScoped = []; // FK -> a table outside the set that carries org_id (cross-org if kept)
  for (const c of tc) {
    const to = fkOf(t, c.name);
    if (!to) continue;
    if (to === 'organizations') orgCols.push(c.name);
    else if (SET.has(to)) inSetFks.push({ col: c.name, to, nullable: c.nullable });
    else if (hasCol(to, 'org_id')) outsideOrgScoped.push({ col: c.name, to });
  }
  const deferred = inSetFks.filter(f => f.nullable).map(f => f.col);
  if (!hasId && deferred.length) throw new Error(`${t} has no id column but a nullable in-set FK (${deferred.join(', ')}) — the deferred pass cannot address its rows.`);
  const adoptable = hasCol(t, 'org_id') && hasCol(t, 'team_id') && tc.find(c => c.name === 'team_id').nullable && fkOf(t, 'team_id') === 'rep_teams';
  plan.set(t, { hasId, inSetFks, orgCols, outsideOrgScoped, deferred, adoptable });
}

// Insert order: Kahn over the NOT NULL in-set edges (nullable ones are deferred, self-links ignored).
const order = [];
{
  const indeg = new Map([...SET].map(t => [t, 0]));
  const edges = [];
  for (const t of SET) for (const f of plan.get(t).inSetFks) if (!f.nullable && f.to !== t) { edges.push([f.to, t]); indeg.set(t, indeg.get(t) + 1); }
  const ready = [...SET].filter(t => indeg.get(t) === 0).sort();
  while (ready.length) {
    const t = ready.shift(); order.push(t);
    for (const [from, to] of edges) if (from === t) { indeg.set(to, indeg.get(to) - 1); if (indeg.get(to) === 0) ready.push(to); }
    ready.sort();
  }
  if (order.length !== SET.size) throw new Error(`FK cycle over NOT NULL edges among: ${[...SET].filter(t => !order.includes(t)).join(', ')}`);
}

// ── 3. generate the SQL ──────────────────────────────────────────────────────
const NEW_ORG = randomUUID();
const S = { org: lit(src.org_id), team: lit(src.team_id), newOrg: lit(NEW_ORG), owner: lit(src.owner_id) };
const map = expr => `(select x.new from id_map x where x.old = ${expr})`;
const newTeam = map(S.team);
/** OWNERSHIP edges are the NOT NULL in-set keys (team_id, program_year_id, ledger_id, player_id…).
 *  plus a nullable `team_id` — the team-owned-or-club-level pattern (award words, tags, budget
 *  words) has no other owner key. Selection follows only those; any other nullable key is a
 *  reference that gets remapped, never a reason to pull a row in — following one would drag the club's side of a ledger transfer in through
 *  `linked_entry_id`, or another team's expense in through an adopted club tag. */
const ownerFks = t => plan.get(t).inSetFks.filter(f => (!f.nullable || (f.col === 'team_id' && f.to === 'rep_teams')) && f.to !== t);
/** "rows of F already selected" — by id when it has one, else when every ownership key is mapped
 *  (`except` leaves one key out: adoption asks "is the OTHER end of this join row cloned?"). */
const selectedRows = (t, alias, except = null) => {
  const p = plan.get(t);
  if (p.hasId) return `exists (select 1 from id_map m where m.old = ${alias}.id)`;
  const keys = ownerFks(t).filter(f => f.col !== except);
  return keys.map(f => `${alias}.${q(f.col)} in (select old from id_map)`).join(' and ') || 'false';
};
/** A platform row (org_id NULL in an org-scoped table — a platform budget category, say) is shared
 *  by every org and is referenced by its ORIGINAL id, never cloned. */
const isPlatformRow = (parent, expr) => (hasCol(parent, 'org_id')
  ? `exists (select 1 from ${q(parent)} p where p.id = ${expr} and p.org_id is null)`
  : 'false');
/** Remap an in-set reference: the clone's id when cloned, the original when platform-shared. */
const ref = (parent, expr) => `coalesce(${map(expr)}, case when ${isPlatformRow(parent, expr)} then ${expr} else null end)`;

const out = [];
out.push('begin;');
// The shadow free team is SET NULL (not cascaded) when its workspace goes; delete it first or every
// rebuild leaves a stale orphan in the owner's public-form team picker.
if (src.target_org_id) out.push(`delete from basic_coach_teams where team_workspace_id in (select id from team_workspaces where workspace_org_id = ${lit(src.target_org_id)});`);
if (src.target_org_id) out.push(`delete from organizations where id = ${lit(src.target_org_id)};`);
out.push(`create temp table id_map (old uuid primary key, new uuid not null, tbl text not null, adopted boolean not null default false) on commit drop;`);
out.push(`create temp table clone_report (k text, v text) on commit drop;`);

// PROVISIONER MIRROR — lib/team-workspace-provisioning.ts: createOrganization(..., 'team', {accountKind:
// 'team_workspace', teamWorkspaceStatus: 'active', isDiscoverable: false}) + the subscription patch,
// then createOrganizationMember(owner). The dev seed route's billing shape: platform_admin source,
// platform_override billing + entitlement, no Stripe.
const orgName = `${args.teamName} Coaches Portal`;
out.push(`insert into organizations (id, name, slug, plan_id, tournament_limit, account_kind, team_workspace_status, is_discoverable, free_floor, subscription_status)
  values (${S.newOrg}, ${lit(orgName)}, ${lit(args.slug)}, 'team', 1, 'team_workspace', 'active', false, null, 'active');`);
out.push(`insert into organization_members (organization_id, user_id, role, accepted_at) values (${S.newOrg}, ${S.owner}, 'owner', now());`);

// Seeds.
out.push(`insert into id_map (old, new, tbl) select id, gen_random_uuid(), 'rep_teams' from rep_teams where id = ${S.team};`);
out.push(`insert into id_map (old, new, tbl) select id, gen_random_uuid(), 'accounting_ledgers' from accounting_ledgers where org_id = ${S.org} and entity_type = 'team' and entity_id = ${S.team};`);

// Fixed-point selection (+ adoption of referenced club-level rows).
{
  const body = [];
  for (const t of order) {
    const p = plan.get(t);
    if (!p.hasId) continue;
    const preds = ownerFks(t).map(f => `t.${q(f.col)} in (select old from id_map)`);
    if (!preds.length) continue;
    body.push(`insert into id_map (old, new, tbl) select t.id, gen_random_uuid(), ${lit(t)} from ${q(t)} t
      where (${preds.join(' or ')}) and not exists (select 1 from id_map m where m.old = t.id);
    get diagnostics n = row_count; total := total + n;`);
  }
  for (const t of order) {
    const p = plan.get(t);
    for (const f of p.inSetFks) {
      if (!plan.get(f.to).adoptable) continue;
      body.push(`insert into id_map (old, new, tbl, adopted) select p.id, gen_random_uuid(), ${lit(f.to)}, true from ${q(f.to)} p
      where p.org_id = ${S.org} and p.team_id is null
        and p.id in (select f.${q(f.col)} from ${q(t)} f where ${selectedRows(t, 'f', f.col)})
        and not exists (select 1 from id_map m where m.old = p.id);
    get diagnostics n = row_count; total := total + n;`);
    }
  }
  out.push(`do $fix$ declare n int; total int; begin
  loop
    total := 0;
    ${body.join('\n    ')}
    exit when total = 0;
  end loop;
end $fix$;`);
}

// Pre-check: dangling references. NOT NULL in-set → always fatal. Nullable in-set and org-scoped
// outside refs → fatal unless --null-dangling (they are then written NULL).
{
  const checks = [];
  for (const t of order) {
    const p = plan.get(t);
    for (const f of p.inSetFks) {
      checks.push(`select count(*) into n from ${q(t)} t where ${selectedRows(t, 't')} and t.${q(f.col)} is not null and not exists (select 1 from id_map x where x.old = t.${q(f.col)}) and not ${isPlatformRow(f.to, `t.${q(f.col)}`)};
    if n > 0 then ${f.nullable ? 'soft' : 'hard'} := ${f.nullable ? 'soft' : 'hard'} || format('%s.%s→%s=%s ', ${lit(t)}, ${lit(f.col)}, ${lit(f.to)}, n); end if;`);
    }
    for (const f of p.outsideOrgScoped) {
      const c = cols.get(t).find(x => x.name === f.col);
      checks.push(`select count(*) into n from ${q(t)} t where ${selectedRows(t, 't')} and t.${q(f.col)} is not null;
    if n > 0 then ${c.nullable ? 'soft' : 'hard'} := ${c.nullable ? 'soft' : 'hard'} || format('%s.%s→%s=%s ', ${lit(t)}, ${lit(f.col)}, ${lit(f.to)}, n); end if;`);
    }
  }
  out.push(`do $chk$ declare n int; hard text := ''; soft text := ''; begin
    ${checks.join('\n    ')}
    if hard <> '' then raise exception 'NOT NULL references to rows outside the clone (cannot be nulled): %', hard; end if;
    if soft <> '' then
      ${args.nullDangling ? `insert into clone_report values ('nulled dangling refs', soft);` : `raise exception 'references to rows outside the clone (pass --null-dangling to write them NULL): %', soft;`}
    end if;
end $chk$;`);
}

// Inserts, in FK order.
const isTokenHash = name => /token_hash/.test(name);
const overrides = {
  rep_teams: { name: lit(args.teamName), slug: lit(args.teamSlug) },
  accounting_ledgers: { name: lit(args.teamName) },   // getOrCreateRepTeamLedger names the ledger after the team
};
for (const t of order) {
  const p = plan.get(t);
  const names = [];
  const exprs = [];
  for (const c of cols.get(t)) {
    if (c.generated) continue;
    const to = fkOf(t, c.name);
    let e;
    if (overrides[t]?.[c.name]) e = overrides[t][c.name];
    else if (c.name === 'id' && p.hasId) e = 'm.new';
    else if (to === 'organizations') e = S.newOrg;
    else if (to && SET.has(to)) e = c.nullable ? 'null' : ref(to, `t.${q(c.name)}`);
    else if (to && p.outsideOrgScoped.some(f => f.col === c.name)) e = c.nullable ? 'null' : `t.${q(c.name)}`; // NOT NULL ones already aborted above
    else if (isTokenHash(c.name)) e = c.nullable ? 'null' : `encode(gen_random_bytes(32), 'hex')`;
    else if (c.type === 'uuid') e = `coalesce(${map(`t.${q(c.name)}`)}, t.${q(c.name)})`; // soft references (entity_id, source_entity_id)
    else e = `t.${q(c.name)}`;
    names.push(q(c.name)); exprs.push(e);
  }
  const from = p.hasId
    ? `from ${q(t)} t join id_map m on m.old = t.id and m.tbl = ${lit(t)}`
    : `from ${q(t)} t where ${selectedRows(t, 't')}`;
  out.push(`insert into ${q(t)} (${names.join(', ')}) select ${exprs.join(', ')} ${from};`);
}

// Deferred pass: nullable in-set references, and adopted rows become the new team's own.
for (const t of order) {
  const p = plan.get(t);
  if (!p.deferred.length) continue;
  const sets = p.deferred.map(c => (c === 'team_id' && p.adoptable)
    ? `${q(c)} = case when m.adopted then ${newTeam} else ${ref('rep_teams', `t.${q(c)}`)} end`
    : `${q(c)} = ${ref(p.inSetFks.find(f => f.col === c).to, `t.${q(c)}`)}`);
  out.push(`update ${q(t)} n set ${sets.join(', ')} from ${q(t)} t join id_map m on m.old = t.id and m.tbl = ${lit(t)} where n.id = m.new;`);
}

// PROVISIONER MIRROR — the rest of provisionStandaloneTeamWorkspace: the org General ledger,
// team_workspaces, team_entitlements. Then org memberships for the cloned staff (role 'coach', as
// coach-membership.ts mints them) and the owner assertion.
out.push(`insert into accounting_ledgers (org_id, entity_type, entity_id, name) values (${S.newOrg}, 'org', null, ${lit(`${orgName} — General`)});`);
out.push(`insert into team_workspaces (workspace_org_id, rep_team_id, active_program_year_id, primary_owner_user_id, source, workspace_state, billing_mode, billing_owner_org_id, billing_owner_user_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end)
  values (${S.newOrg}, ${newTeam}, ${src.active_year_id ? map(lit(src.active_year_id)) : 'null'}, ${S.owner}, 'platform_admin', 'independent', 'platform_override', null, ${S.owner}, null, null, 'active', null);`);
out.push(`insert into team_entitlements (team_workspace_id, org_id, rep_team_id, source, status)
  select w.id, ${S.newOrg}, ${newTeam}, 'platform_override', 'active' from team_workspaces w where w.workspace_org_id = ${S.newOrg};`);
// The free-team SHADOW every paid portal carries (mig 297 / Part C of "your team in your own
// tournament"): the coach-side tournament record, roster submission and the public register form's
// picker key on it. Provisioning mints it; this fixture mirrors the provisioner, so it mints it too —
// otherwise the fixture is the from-scratch defect the migration exists to repair.
out.push(`with shadow as (
  insert into basic_coach_teams (name, normalized_name, primary_coach_name, primary_coach_email, sport, age_group, source, team_workspace_id, created_at, updated_at)
  select t.name, lower(trim(t.name)), null, lower(u.email), left(t.sport, 80), left(t.division, 80), 'premium_upgrade', w.id, now(), now()
    from team_workspaces w join rep_teams t on t.id = w.rep_team_id left join auth.users u on u.id = w.primary_owner_user_id
   where w.workspace_org_id = ${S.newOrg} and u.email is not null
  returning id, team_workspace_id
), linked as (
  update team_workspaces w set basic_coach_team_id = s.id from shadow s where w.id = s.team_workspace_id returning w.basic_coach_team_id
)
insert into basic_coach_team_users (basic_coach_team_id, user_id, role, status) select l.basic_coach_team_id, ${S.owner}, 'owner', 'active' from linked l;`);
out.push(`insert into organization_members (organization_id, user_id, role, accepted_at)
  select ${S.newOrg}, s.user_id, 'coach', now() from rep_team_staff_memberships s
   where s.org_id = ${S.newOrg} and s.status = 'active'
     and not exists (select 1 from organization_members om where om.organization_id = ${S.newOrg} and om.user_id = s.user_id);`);
out.push(`do $own$ begin
  if not exists (select 1 from rep_team_staff_memberships where org_id = ${S.newOrg} and user_id = ${S.owner} and status = 'active' and coach_role = 'head_coach')
  then raise exception 'owner ${args.owner} is not an active head coach on the source team — pick an owner who is'; end if;
end $own$;`);

// Report.
out.push(`insert into clone_report select 'rows: ' || tbl, count(*)::text || case when bool_or(adopted) then ' (' || count(*) filter (where adopted) || ' adopted from club level)' else '' end from id_map group by tbl;`);
for (const t of order) if (!plan.get(t).hasId) out.push(`insert into clone_report select 'rows: ${t}', count(*)::text from ${q(t)} t where ${selectedRows(t, 't')};`);
out.push(`insert into clone_report values ('org', ${lit(`${args.slug} (${NEW_ORG})`)}), ('team', ${lit(args.teamName)} || ' (' || ${newTeam} || ')'), ('owner', ${lit(args.owner)}), ('portal', ${lit(`/${args.slug}/coaches`)});`);
out.push(`select k, v from clone_report order by k;`);
out.push(args.dryRun ? 'rollback;' : 'commit;');

const script = out.join('\n');

// ── 4. run ───────────────────────────────────────────────────────────────────
console.log(`${args.dryRun ? 'DRY RUN — ' : ''}clone ${args.fromOrg}/${args.fromTeam} ("${src.team_name}") → /${args.slug} as "${args.teamName}", owner ${args.owner}`);
console.log(`  clone set: ${SET.size} tables · excluded: ${[...EXCLUDED].filter(t => t !== 'organizations').join(', ')}`);
if (src.target_org_id) console.log(`  --reset: deleting existing org ${args.slug} (${src.target_org_id}) first`);
let rows;
try {
  rows = await sql(script);
} catch (err) {
  console.error(`✗ Aborted, nothing written:\n  ${String(err.message).split('\n')[0]}`);
  const dump = path.join(os.tmpdir(), 'seed-uat-standalone-coach.sql');
  fs.writeFileSync(dump, script);
  console.error(`  The generated SQL is at ${dump} for inspection.`);
  process.exit(1);
}
for (const r of rows) console.log(`  ${r.k.padEnd(44)} ${r.v}`);
console.log(args.dryRun ? '\nRolled back (dry run). Re-run without --dry-run to build it.' : `\n✓ Built. Sign in as ${args.owner} and open /${args.slug}/coaches.`);
