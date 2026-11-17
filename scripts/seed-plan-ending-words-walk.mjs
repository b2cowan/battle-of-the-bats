#!/usr/bin/env node
/**
 * THE PLAN-ENDING WORDS, FROM THE OWNER'S CHAIR · OWNER WALK FIXTURE. Dev Supabase + Stripe TEST mode only.
 *
 *   node --env-file=.env.local scripts/seed-plan-ending-words-walk.mjs setup
 *   node --env-file=.env.local scripts/seed-plan-ending-words-walk.mjs status
 *   node --env-file=.env.local scripts/seed-plan-ending-words-walk.mjs teardown
 *
 * Six accounts, each with its own owner sign-in. Every address is `words+pwN@fieldlogichq-walk.local` — a `.local` host,
 * so NO real mail can be delivered and no real address is ever used. Password UATPassword2026!.
 *
 *   pw1 Words Walk Paying Club        League Plus, monthly, live Stripe-test subscription, active, nothing waiting.
 *   pw2 Words Walk Trial Club         Tournament Plus on a real Stripe TEST trial (14 days, pm_card_visa), status trialing,
 *                                     renewal date = the trial's end.
 *   pw3 Words Walk Past Due Club      Tournament Plus, live subscription, the RECORD flipped to past_due (Stripe is not made to
 *                                     fail a payment: the Cancel wording reads the record's status).
 *   pw4 Words Walk Downgrade Club     Tournament Plus, monthly, live subscription, active, with TWO live tournaments (one draft,
 *                                     one active) — the free Tournament plan holds one, so the downgrade window must ask which
 *                                     to keep.
 *   pw5 Words Walk Premium            A STANDALONE Premium Coaches Portal (shadow org `team_workspace`, billing_mode team_direct,
 *                                     entitlement source team_plan) on a live Stripe-test subscription, the sandbox `team` price.
 *   pw6 Words Walk Premium Past Due   The same, its record flipped to past_due.
 *
 * HOW THE TWO PORTALS ARE BUILT. lib/team-workspace-provisioning.ts (provisionStandaloneTeamWorkspace) cannot be imported
 * from a node script (TypeScript + server-only imports), and scripts/seed-uat-standalone-coach.mjs clones a whole UAT team
 * through the Management API. This script instead mirrors the provisioner's own writes with the service-role client, the
 * minimum that opens the portal and its Plan & billing page: the shadow org, the owner membership, the rep team, the active
 * season, the head-coach staff membership + its season row, the two ledgers, the team_workspaces row, the free-team shadow and
 * the team_entitlements row. If the provisioner changes shape, change the block marked PROVISIONER MIRROR below.
 *
 * ORDER (the plan-ending walk's): Stripe objects are made FIRST and Stripe's own messages about creating them pass the dev
 * site (25 seconds) BEFORE any club or portal is tied to a Stripe id, so the site's webhook finds nothing to act on and cannot
 * move the dates or statuses written here. Teardown goes the other way: our rows first, then the Stripe subscriptions.
 *
 * Tags: Stripe customers carry metadata.walk = MARKER; clubs and portals carry internal_notes = MARKER; the sign-ins carry
 * user_metadata.walk = MARKER (teardown removes ONLY those, never a pre-existing user). Setup refuses when any marker row,
 * or any of the six addresses, already exists.
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { ensureUser as ensureSignIn, refusal } from './lib/billing-walk-fixture.mjs';
import { findUserByEmail } from './lib/fixture-user.mjs';

const MARKER = 'plan-ending-words-walk';
const PASSWORD = 'UATPassword2026!';
const ADDRESS = 'words@fieldlogichq-walk.local'; // + `+pwN` before the @
const SITE = process.env.WALK_SITE ?? 'http://localhost:3000';
const OPERATOR_RECORD = id => `${SITE}/platform-admin/orgs/${id}`;
const PLAN_LABEL = { league: 'League Plus', tournament_plus: 'Tournament Plus', team: 'Premium Coaches Portal' };

const usage = 'Usage: node --env-file=.env.local scripts/seed-plan-ending-words-walk.mjs setup | status | teardown';
const command = process.argv[2];
if (process.argv.length !== 3 || !['setup', 'status', 'teardown'].includes(command)) { console.error(usage); process.exit(2); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const refused = refusal({ stripeKey: process.env.STRIPE_SECRET_KEY, supabaseUrl: url });
if (refused) { console.error(refused); process.exit(2); }

const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const ok = msg => console.log(`  ✓ ${msg}`);
const head = msg => console.log(`\n${msg}`);
function die(what, error) { if (error) { console.error(`✗ ${what}: ${error.message ?? error}`); process.exit(1); } }
async function one(what, q) { const { data, error } = await q; die(what, error); return data; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = ms => new Date(ms).toISOString();
const emailOf = tag => ADDRESS.replace('@', `+${tag}@`);

// kind: club | portal. `period`: what Stripe is made with. `recordStatus`: what the record is flipped to afterwards.
const ACCOUNTS = [
  { tag: 'pw1', kind: 'club', name: 'Words Walk Paying Club', slug: 'words-walk-paying-club', plan: 'league' },
  { tag: 'pw2', kind: 'club', name: 'Words Walk Trial Club', slug: 'words-walk-trial-club', plan: 'tournament_plus', trial: true },
  { tag: 'pw3', kind: 'club', name: 'Words Walk Past Due Club', slug: 'words-walk-past-due-club', plan: 'tournament_plus', recordStatus: 'past_due' },
  { tag: 'pw4', kind: 'club', name: 'Words Walk Downgrade Club', slug: 'words-walk-downgrade-club', plan: 'tournament_plus', tournaments: 2 },
  { tag: 'pw5', kind: 'portal', name: 'Words Walk Premium', slug: 'words-walk-premium', plan: 'team' },
  { tag: 'pw6', kind: 'portal', name: 'Words Walk Premium Past Due', slug: 'words-walk-premium-past-due', plan: 'team', recordStatus: 'past_due' },
];

/** Where the owner reads Plan & billing — `getBillingHref` (lib/billing-urls.ts): a Coaches Portal in its own portal, a
 *  Tournament-tier org on the tournament side, everyone else under Organization. */
function billingPath(a) {
  if (a.kind === 'portal') return `/${a.slug}/coaches/billing`;
  return ['tournament', 'tournament_plus'].includes(a.plan) ? `/${a.slug}/admin/tournaments/settings/subscription` : `/${a.slug}/admin/org/billing`;
}

async function walkOrgs() {
  return one('walk orgs', db.from('organizations').select('id, name, slug, plan_id, account_kind, subscription_status, stripe_customer_id, stripe_subscription_id, current_period_end').eq('internal_notes', MARKER));
}

// ── status ───────────────────────────────────────────────────────────────────────────────────────────────────────
if (command === 'status') {
  const orgs = await walkOrgs();
  if (!orgs.length) { console.log('No walk accounts exist. Run setup.'); process.exit(0); }
  head('The plan-ending words walk — accounts');
  for (const a of ACCOUNTS) {
    const o = orgs.find(x => x.slug === a.slug);
    if (!o) { console.log(`\n${a.tag}  ${a.name}: MISSING`); continue; }
    const intents = await one(`waiting ${a.name}`, db.from('billing_retention_intents').select('intent_type, status, effective_at, target_plan').eq('org_id', o.id));
    console.log(`
${a.tag}  ${a.name}
    slug:        ${a.slug}
    plan:        ${PLAN_LABEL[o.plan_id] ?? o.plan_id}  (${o.plan_id})
    status:      ${o.subscription_status}   renews/ends: ${o.current_period_end?.slice(0, 10) ?? '—'}   subscription: ${o.stripe_subscription_id ?? 'none'}
    owner:       ${emailOf(a.tag)}   (password ${PASSWORD})
    billing:     ${SITE}${billingPath(a)}
    record:      ${OPERATOR_RECORD(o.id)}
    waiting:     ${intents.length ? intents.map(i => `${i.intent_type}${i.target_plan ? '→' + i.target_plan : ''} ${i.status} ${i.effective_at?.slice(0, 10) ?? ''}`).join('; ') : 'nothing'}`);
  }
  console.log(`\nOperator: sign in as uat-platform@fieldlogichq.ca (the existing UAT staff sign-in) for the record URLs.`);
  process.exit(0);
}

// ── teardown ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function stopStripe(customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  for (const s of subs.data) {
    if (!['canceled', 'incomplete_expired'].includes(s.status)) { await stripe.subscriptions.cancel(s.id); ok(`stopped ${s.id}`); }
  }
}
async function del(what, q) { const { error } = await q; if (error) { console.error(`✗ ${what}: ${error.message}`); process.exit(1); } }

if (command === 'teardown') {
  head('Removing the words-walk accounts');
  const orgs = await walkOrgs();
  const customers = new Set(orgs.map(o => o.stripe_customer_id).filter(Boolean));
  for await (const c of stripe.customers.list({ limit: 100 })) if (c.metadata?.walk === MARKER) customers.add(c.id);

  // Our rows first: a subscription stopped while its club exists would let Stripe's "ended" message end the club on the
  // dev site and email its owner.
  for (const org of orgs) {
    await del(`intents ${org.name}`, db.from('billing_retention_intents').delete().eq('org_id', org.id));
    await del(`retained ${org.name}`, db.from('billing_retained_records').delete().eq('org_id', org.id));
    if (org.account_kind === 'team_workspace') {
      const ws = await one(`workspace ${org.name}`, db.from('team_workspaces').select('id, rep_team_id').eq('workspace_org_id', org.id));
      const wsIds = ws.map(w => w.id);
      if (wsIds.length) {
        // The free-team shadows first: deleting the workspace would null their link and strand them.
        const shadows = await one('shadows', db.from('basic_coach_teams').select('id').in('team_workspace_id', wsIds));
        const shadowIds = shadows.map(s => s.id);
        if (shadowIds.length) {
          await del('shadow users', db.from('basic_coach_team_users').delete().in('basic_coach_team_id', shadowIds));
          await del('workspace shadow link', db.from('team_workspaces').update({ basic_coach_team_id: null }).in('id', wsIds));
          await del('shadow', db.from('basic_coach_teams').delete().in('id', shadowIds));
        }
        await del('entitlements', db.from('team_entitlements').delete().in('team_workspace_id', wsIds));
        await del('workspace', db.from('team_workspaces').delete().in('id', wsIds));
      }
      await del('season rows', db.from('rep_team_coaches').delete().eq('org_id', org.id));
      await del('staff', db.from('rep_team_staff_memberships').delete().eq('org_id', org.id));
      await del('ledgers', db.from('accounting_ledgers').delete().eq('org_id', org.id));
      await del('program years', db.from('rep_program_years').delete().eq('org_id', org.id));
      await del('award types', db.from('rep_team_award_types').delete().eq('org_id', org.id));
      await del('teams', db.from('rep_teams').delete().eq('org_id', org.id));
    } else {
      await del(`tournaments ${org.name}`, db.from('tournaments').delete().eq('org_id', org.id));
    }
    await del(`members ${org.name}`, db.from('organization_members').delete().eq('organization_id', org.id));
    await del(`${org.name} could not be removed`, db.from('organizations').delete().eq('id', org.id));
    ok(`removed ${org.name}`);
  }
  if (!orgs.length) ok('no walk accounts to remove');

  for (const c of customers) await stopStripe(c);
  for (const c of customers) { await stripe.customers.del(c); ok(`deleted Stripe test customer ${c}`); }

  // The sign-ins: ONLY the ones this script made (user_metadata.walk = MARKER), never a pre-existing user.
  for (const a of ACCOUNTS) {
    const user = await findUserByEmail(db, emailOf(a.tag)).catch(e => die('find user', e));
    if (!user) continue;
    if (user.user_metadata?.walk !== MARKER) { console.log(`  · kept ${emailOf(a.tag)} (not made by this script)`); continue; }
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) { console.error(`✗ delete user ${emailOf(a.tag)}: ${error.message}`); process.exit(1); }
    ok(`removed sign-in ${emailOf(a.tag)}`);
  }
  process.exit(0);
}

// ── setup ────────────────────────────────────────────────────────────────────────────────────────────────────────
if ((await walkOrgs()).length) { console.error('The words-walk accounts already exist. Run teardown first.'); process.exit(1); }
for (const a of ACCOUNTS) {
  if (await findUserByEmail(db, emailOf(a.tag))) { console.error(`${emailOf(a.tag)} already exists as a sign-in. Run teardown first (or remove it by hand): this script never resets an existing password.`); process.exit(1); }
}

const prices = await one('prices', db.from('stripe_prices').select('plan_id, price_id').eq('environment', 'sandbox').eq('billing_cycle', 'monthly').in('plan_id', ['league', 'tournament_plus', 'team']));
const priceOf = plan => prices.find(p => p.plan_id === plan)?.price_id ?? die(`price ${plan}`, 'no sandbox monthly price');

head('Sign-ins');
for (const a of ACCOUNTS) {
  a.email = emailOf(a.tag);
  const { user } = await ensureSignIn(db, { email: a.email, password: PASSWORD, fullName: `${a.name} Owner` }).catch(e => die(`sign-in ${a.email}`, e));
  const { error } = await db.auth.admin.updateUserById(user.id, { user_metadata: { ...user.user_metadata, walk: MARKER } });
  die(`tag ${a.email}`, error);
  a.user = user;
  ok(`${a.email}`);
}

head('Stripe (test mode): one customer and one subscription per account');
for (const a of ACCOUNTS) {
  const customer = await stripe.customers.create({
    email: a.email, name: a.name, payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' }, metadata: { walk: MARKER, tag: a.tag },
  });
  const price = await stripe.prices.retrieve(priceOf(a.plan));
  const sub = await stripe.subscriptions.create({
    customer: customer.id, items: [{ price: price.id }], metadata: { walk: MARKER, tag: a.tag },
    ...(a.trial ? { trial_period_days: 14 } : {}),
  });
  const item = sub.items.data[0];
  a.customerId = customer.id; a.subId = sub.id; a.itemId = item?.id ?? null;
  a.amount = price.unit_amount; a.currency = price.currency;
  a.periodEnd = a.trial && sub.trial_end ? iso(sub.trial_end * 1000) : item?.current_period_end ? iso(item.current_period_end * 1000) : null;
  a.stripeStatus = sub.status;
  if (a.trial && sub.status !== 'trialing') die(`${a.name} trial`, `Stripe made it ${sub.status}, not trialing`);
  ok(`${a.name}: ${sub.id} (${sub.status}), ${a.trial ? 'trial ends' : 'renews'} ${a.periodEnd?.slice(0, 10)}`);
}

head("Waiting 25 seconds so Stripe's own messages pass the dev site before the accounts are tied to them");
await sleep(25_000);

const now = Date.now();
const status = a => a.recordStatus ?? (a.trial ? 'trialing' : 'active');

head('Clubs');
for (const a of ACCOUNTS.filter(x => x.kind === 'club')) {
  const org = await one(`org ${a.name}`, db.from('organizations').insert({
    name: a.name, slug: a.slug, plan_id: a.plan, subscription_status: status(a), account_kind: 'organization',
    is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
    tournament_limit: 9999, team_limit: 9999, onboarding_completed_at: iso(now),
    stripe_customer_id: a.customerId, stripe_subscription_id: a.subId, subscription_period: 'monthly',
    current_period_end: a.periodEnd, subscription_amount_cents: a.amount, subscription_currency: a.currency,
  }).select('id').single());
  a.orgId = org.id;
  die(`owner ${a.name}`, (await db.from('organization_members').insert({
    organization_id: org.id, user_id: a.user.id, role: 'owner', status: 'active',
    display_name: `${a.name} Owner`, invited_at: iso(now), accepted_at: iso(now),
  })).error);
  for (let n = 1; n <= (a.tournaments ?? 0); n += 1) {
    const year = new Date().getUTCFullYear() + 1;
    const name = `${a.name.replace(' Club', '')} Classic ${n}`;
    const live = n === 1; // one active, the rest draft: both hold a slot on the free plan's single one
    die(`tournament ${name}`, (await db.from('tournaments').insert({
      org_id: org.id, year, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), status: live ? 'active' : 'draft', is_active: live,
      start_date: `${year}-0${5 + n}-01`, end_date: `${year}-0${5 + n}-03`, sport: 'baseball', list_in_directory: false,
    })).error);
  }
  ok(`${a.name} (${a.slug}) · ${a.plan} · ${status(a)}${a.tournaments ? ` · ${a.tournaments} tournaments` : ''}`);
}

head('Coaches Portals (PROVISIONER MIRROR — lib/team-workspace-provisioning.ts)');
for (const a of ACCOUNTS.filter(x => x.kind === 'portal')) {
  const st = status(a);
  const year = new Date().getFullYear();
  const org = await one(`org ${a.name}`, db.from('organizations').insert({
    name: a.name, slug: a.slug, plan_id: 'team', tournament_limit: 1, account_kind: 'team_workspace', team_workspace_status: 'active',
    is_discoverable: false, free_floor: null, internal_notes: MARKER,
    // The webhook's own sync (syncTeamWorkspaceSubscription) writes these onto the shadow org of a paid portal.
    subscription_status: st, stripe_customer_id: a.customerId, stripe_subscription_id: a.subId, subscription_period: 'monthly',
    current_period_end: a.periodEnd, subscription_amount_cents: a.amount, subscription_currency: a.currency,
  }).select('id').single());
  a.orgId = org.id;
  die(`owner ${a.name}`, (await db.from('organization_members').insert({ organization_id: org.id, user_id: a.user.id, role: 'owner', accepted_at: iso(now) })).error);
  const team = await one(`team ${a.name}`, db.from('rep_teams').insert({
    org_id: org.id, name: `${a.name} Team`, slug: `${a.slug}-team`, sport: 'baseball',
  }).select('id').single());
  const py = await one(`season ${a.name}`, db.from('rep_program_years').insert({
    org_id: org.id, team_id: team.id, name: `${a.name} Team ${year}`, year, status: 'active', tryout_open: false,
  }).select('id').single());
  // addStaffMember: the membership, and the live season's projection row it writes with it.
  die(`staff ${a.name}`, (await db.from('rep_team_staff_memberships').upsert({
    org_id: org.id, team_id: team.id, user_id: a.user.id, coach_role: 'head_coach', status: 'active', revoked_at: null, revoked_by: null, staff_kind: null,
  }, { onConflict: 'team_id,user_id' })).error);
  die(`season row ${a.name}`, (await db.from('rep_team_coaches').insert({
    program_year_id: py.id, team_id: team.id, org_id: org.id, user_id: a.user.id, coach_role: 'head_coach', capabilities: null,
  })).error);
  die(`org ledger ${a.name}`, (await db.rpc('club_general_ledger', { p_org: org.id })).error);
  die(`team ledger ${a.name}`, (await db.rpc('club_team_ledger', { p_org: org.id, p_team: team.id })).error);
  const ws = await one(`workspace ${a.name}`, db.from('team_workspaces').insert({
    workspace_org_id: org.id, rep_team_id: team.id, active_program_year_id: py.id, primary_owner_user_id: a.user.id,
    source: 'direct_signup', workspace_state: 'independent', billing_mode: 'team_direct', billing_owner_user_id: a.user.id,
    stripe_customer_id: a.customerId, stripe_subscription_id: a.subId, subscription_status: st, current_period_end: a.periodEnd,
  }).select('id').single());
  // The free-team shadow every paid portal carries (resolveBasicCoachTeamIdForWorkspace would mint it on first read).
  const shadow = await one(`shadow ${a.name}`, db.from('basic_coach_teams').insert({
    name: `${a.name} Team`, normalized_name: `${a.name} Team`.trim().toLowerCase(), primary_coach_name: null,
    primary_coach_email: a.email.toLowerCase(), sport: 'baseball', source: 'premium_upgrade', team_workspace_id: ws.id,
  }).select('id').single());
  die(`shadow link ${a.name}`, (await db.from('team_workspaces').update({ basic_coach_team_id: shadow.id }).eq('id', ws.id)).error);
  die(`shadow owner ${a.name}`, (await db.from('basic_coach_team_users').insert({ basic_coach_team_id: shadow.id, user_id: a.user.id, role: 'owner', status: 'active' })).error);
  die(`entitlement ${a.name}`, (await db.from('team_entitlements').insert({
    team_workspace_id: ws.id, org_id: org.id, rep_team_id: team.id, source: 'team_plan',
    status: st === 'past_due' ? 'past_due' : 'active', stripe_subscription_item_id: a.itemId,
  })).error);
  ok(`${a.name} (${a.slug}) · team · ${st}`);
}

head('Done. Run `status` for the accounts, their URLs and what is waiting.');
console.log(`Owners sign in with ${PASSWORD}. Nothing is waiting on any account: the walk makes the cancels and the downgrade itself.`);
