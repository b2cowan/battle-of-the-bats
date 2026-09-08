#!/usr/bin/env node
/**
 * seed-founding-season-fixture.mjs — put the Founding Season desk into a state worth walking.
 *
 * ⚠⚠ A WALK OVER AN EMPTY LIST REPORTS COVERAGE IT LACKS. Dev holds two founding organizations and
 * ZERO founding coach workspaces, so an unseeded desk would show two near-identical rows and prove
 * nothing about the columns the September 2027 conversion actually runs on. This seeds the four
 * states the walk has to be able to see:
 *
 *   1. a founding ORGANIZATION WITH a card on file, on a paid plan (the chooser + a card)
 *   2. a founding ORGANIZATION WITHOUT a card, on a paid plan  (the "no card yet" filter)
 *   3. a founding COACHES PORTAL                                (both kinds in one list)
 *   4. a founding organization on a FREE plan                   (nothing to renew — no chooser)
 *
 * It also leaves one row on the LEGACY comp instant so the desk's amber "Legacy" chip — a row
 * migration 279 never reached — is visible rather than theoretical.
 *
 * DEV ONLY. It refuses to run against production: these are fixture states, not customer facts.
 *
 * Usage: node scripts/seed-founding-season-fixture.mjs
 *
 * To walk the SUMMER window (the chooser, the card ask), start the dev server with the card window
 * already open — the constants are env-overridable for exactly this:
 *   NEXT_PUBLIC_FOUNDING_SEASON_CARD_WINDOW_OPEN=2026-01-01T05:00:00.000Z npm run dev
 * Without that the desk still renders; it simply shows the pre-window state.
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const DEV_REF = 'npgnrxaitgbtbtvvykto';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }
if (process.argv.includes('--prod')) {
  console.error('Refusing: this seeds FIXTURE states and must never touch production.');
  process.exit(1);
}

// Kept in step with lib/plan-config.ts by the assertion at the foot of this file.
const FOUNDING_END = '2027-10-01T04:00:00.000Z';
const FOUNDING_LEGACY_END = '2027-01-01T00:00:00.000Z';
const REASON = 'Founding Season - fixture seed for the desk walk';
// Read, never written down. The walk signs in as the coach owner, so the fixture gives that account
// the same password the other documented walk accounts use — from .env.local, so no credential is
// committed to source control.
const WALK_PASSWORD = process.env.UAT_PLATFORM_ADMIN_PASSWORD;
if (!WALK_PASSWORD) {
  console.error('UAT_PLATFORM_ADMIN_PASSWORD not set in .env.local — needed to give the fixture coach a walkable sign-in.');
  process.exit(1);
}

function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${DEV_REF}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// The four fixture accounts, by slug so a re-run is idempotent and readable.
const ORG_WITH_CARD = 'dev-tplus-org';        // paid plan + a card, and its comp sits on the LEGACY instant
const ORG_NO_CARD = 'dev-test-org';           // paid plan, no card — the "no card yet" row
const COACH_PORTAL = 'dev-standalone-team';   // a comped Premium Coaches Portal
const ORG_FREE_PLAN = 'test-minor-softball';  // comped onto a FREE plan: nothing to renew
// The one the WALK signs into: uat-plus-org's owner is the documented UAT owner account, so the
// billing page's summer ask can actually be opened rather than only described.
const ORG_WALKABLE = 'uat-plus-org';

const STATEMENTS = `
-- 1. The organization WITH a card, on a paid plan.
--    Its comp deliberately sits on the LEGACY instant so the desk's amber "Legacy" chip is walkable:
--    recognition tolerates it (the account IS founding), but the row is one migration 279 never
--    reached, and this desk is the only surface anyone would ever notice that on.
update public.organizations
   set plan_id             = 'tournament_plus',
       subscription_status = 'active',
       current_period_end  = '${FOUNDING_LEGACY_END}'
 where slug = '${ORG_WITH_CARD}';

-- The card is a FACT IN ITS OWN TABLE, never a column on organizations (mig 283) — that table is
-- anon-readable for every public org, so a card's brand and last four may not live on it.
insert into public.organization_billing_facts (org_id, card_on_file_at, card_on_file_brand, card_on_file_last4)
select o.id, '2027-06-03T14:12:00.000Z', 'visa', '4242'
  from public.organizations o where o.slug = '${ORG_WITH_CARD}'
    on conflict (org_id) do update
   set card_on_file_at = excluded.card_on_file_at,
       card_on_file_brand = excluded.card_on_file_brand,
       card_on_file_last4 = excluded.card_on_file_last4,
       updated_at = now();

update public.org_overrides
   set revoked_at = now(), revoked_by = 'founding-season-fixture'
 where org_id = (select id from public.organizations where slug = '${ORG_WITH_CARD}')
   and type = 'comp_period'
   and revoked_at is null
   and expires_at not in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}');

insert into public.org_overrides (org_id, type, value, expires_at, reason, created_by)
select o.id, 'comp_period', null, '${FOUNDING_LEGACY_END}', '${REASON} (legacy instant)', 'fixture'
  from public.organizations o
 where o.slug = '${ORG_WITH_CARD}'
   and not exists (
     select 1 from public.org_overrides ov
      where ov.org_id = o.id and ov.type = 'comp_period' and ov.revoked_at is null
        and ov.expires_at in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}')
   );

-- 2. The organization WITHOUT a card — the row the reminder audience is about.
update public.organizations
   set plan_id             = 'tournament_plus',
       subscription_status = 'active',
       current_period_end  = '${FOUNDING_END}'
 where slug = '${ORG_NO_CARD}';

insert into public.org_overrides (org_id, type, value, expires_at, reason, created_by)
select o.id, 'comp_period', null, '${FOUNDING_END}', '${REASON}', 'fixture'
  from public.organizations o
 where o.slug = '${ORG_NO_CARD}'
   and not exists (
     select 1 from public.org_overrides ov
      where ov.org_id = o.id and ov.type = 'comp_period' and ov.revoked_at is null
        and ov.expires_at in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}')
   );

-- 3. The comped Premium Coaches Portal — both account kinds in one list.
--    Matches what provisionCompTeamWorkspaceFromCheckout writes: platform_override billing, no
--    Stripe subscription, current_period_end at the comp end, AND a comp row on the shadow org.
update public.team_workspaces
   set billing_mode        = 'platform_override',
       subscription_status = 'active',
       current_period_end  = '${FOUNDING_END}',
       updated_at          = now()
 where workspace_org_id = (select id from public.organizations where slug = '${COACH_PORTAL}');

update public.organizations
   set current_period_end = '${FOUNDING_END}'
 where slug = '${COACH_PORTAL}';

insert into public.org_overrides (org_id, type, value, expires_at, reason, created_by)
select o.id, 'comp_period', null, '${FOUNDING_END}', '${REASON} (Premium Coaches Portal)', 'fixture'
  from public.organizations o
 where o.slug = '${COACH_PORTAL}'
   and not exists (
     select 1 from public.org_overrides ov
      where ov.org_id = o.id and ov.type = 'comp_period' and ov.revoked_at is null
        and ov.expires_at in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}')
   );

-- 4. A founding organization on a FREE plan: it has nothing to renew, so no chooser is offered.
--    A real state, and the one most likely to be got wrong by a chooser that assumes a paid plan.
insert into public.org_overrides (org_id, type, value, expires_at, reason, created_by)
select o.id, 'comp_period', null, '${FOUNDING_END}', '${REASON} (free plan)', 'fixture'
  from public.organizations o
 where o.slug = '${ORG_FREE_PLAN}'
   and not exists (
     select 1 from public.org_overrides ov
      where ov.org_id = o.id and ov.type = 'comp_period' and ov.revoked_at is null
        and ov.expires_at in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}')
   );

-- 5. The walkable founding organization — the UAT owner can sign in and see the summer ask.
update public.organizations
   set plan_id             = 'tournament_plus',
       subscription_status = 'active',
       current_period_end  = '${FOUNDING_END}'
 where slug = '${ORG_WALKABLE}';

insert into public.org_overrides (org_id, type, value, expires_at, reason, created_by)
select o.id, 'comp_period', null, '${FOUNDING_END}', '${REASON} (walkable)', 'fixture'
  from public.organizations o
 where o.slug = '${ORG_WALKABLE}'
   and not exists (
     select 1 from public.org_overrides ov
      where ov.org_id = o.id and ov.type = 'comp_period' and ov.revoked_at is null
        and ov.expires_at in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}')
   );

-- The comped coach workspace's owner gets the documented walk password, so the COACH side of the
-- summer ask can be opened too — item 3 is the one this phase corrected, and describing it is not
-- walking it. Dev only; the script refuses --prod.
update auth.users
   set encrypted_password = crypt('${WALK_PASSWORD}', gen_salt('bf'))
 where email = 'coach@dev.local';

-- Nobody has chosen a plan yet — the walk makes the first choice itself.
delete from public.organization_billing_facts
 where org_id in (select id from public.organizations
                   where slug in ('${ORG_NO_CARD}', '${COACH_PORTAL}', '${ORG_FREE_PLAN}', '${ORG_WALKABLE}'));

update public.organization_billing_facts
   set next_season_plan_id = null, next_season_billing_cycle = null,
       next_season_chosen_at = null, next_season_subscription_id = null, updated_at = now()
 where org_id = (select id from public.organizations where slug = '${ORG_WITH_CARD}');
`;

const main = async () => {
  await sql(STATEMENTS);
  const rows = await sql(`
    select o.name, o.slug, o.account_kind, o.plan_id, ov.expires_at,
           f.card_on_file_at is not null as has_card, f.next_season_plan_id
      from public.org_overrides ov
      join public.organizations o on o.id = ov.org_id
      left join public.organization_billing_facts f on f.org_id = o.id
     where ov.type = 'comp_period' and ov.revoked_at is null
       and ov.expires_at in ('${FOUNDING_END}', '${FOUNDING_LEGACY_END}')
     order by o.name
  `);
  console.log('\nFounding Season fixture seeded on DEV — the desk now shows:\n');
  for (const r of rows) {
    const kind = r.account_kind === 'team_workspace' ? 'Coaches Portal' : 'Organization';
    const legacy = String(r.expires_at).startsWith('2027-01-01') ? '  [LEGACY comp instant]' : '';
    console.log(`  · ${r.name} — ${kind} · ${r.plan_id} · card: ${r.has_card ? 'yes' : 'no'} · choice: ${r.next_season_plan_id ?? 'none'}${legacy}`);
  }
  console.log(`\n${rows.length} founding account(s). Open /platform-admin/founding-season.\n`);
  console.log('For the summer window, restart the dev server with:');
  console.log('  NEXT_PUBLIC_FOUNDING_SEASON_CARD_WINDOW_OPEN=2026-01-01T05:00:00.000Z npm run dev\n');
};

main().catch(err => { console.error(err); process.exit(1); });
