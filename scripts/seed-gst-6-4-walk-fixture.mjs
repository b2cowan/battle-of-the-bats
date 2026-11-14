#!/usr/bin/env node
/**
 * GST/HST STEP 6.4 · OWNER WALK FIXTURE (the purchase email, the yearly reminder, no purchase from Québec).
 * Dev Supabase + Stripe TEST mode only (the shared guard in scripts/lib/billing-walk-fixture.mjs refuses anything else).
 * The walk is docs/projects/active/GST_HST_STAGE6_4_WALK.html. Model: scripts/seed-plan-move-walk.mjs.
 *
 * Every sign-in is your inbox with a +tag (so the emails really arrive), password UATPassword2026!, Terms already agreed:
 *   +w64c  coach        buys Premium (Part B), then starts a club from it (Part E)    owns nothing at the start
 *   +w64l  league       starts a League Plus trial on an organization of their own (Part C)   owns nothing at the start
 *   +w64q  quebec buyer is refused at every purchase door (Part G)                      owns nothing at the start
 *   +w64a / +w64b   the two owners of "Walk64 Upgrade Club" (Tournament Plus, monthly, live test subscription) — Part D
 *   +w64r / +w64s   the two owners of "Walk64 Reminder Club" (Tournament Plus, yearly, renews in 33 days, a queued fee) — Part F
 *   +w64x  owner of "Walk64 Cancelled Reminder" (yearly, renews in 33 days, a cancel set in Stripe)  — Part F
 *   +w64m  owner of "Walk64 Monthly Reminder" (monthly, renews in about a month)                     — Part F
 *   +w64o  owner of "Walk64 Quebec Club" (Club · Association, monthly, live test subscription)         — Part G
 *   +w64k  owner of "Walk64 Comeback Club" (cancelled; Stripe still knows its old subscription)        — Part H
 *
 *   node --env-file=.env.local scripts/seed-gst-6-4-walk-fixture.mjs setup --inbox you@example.com
 *   … status                 what exists, the emails sent to the walk's addresses, the tax records, the reminder stamps
 *   … settle                 dev only: fills the "billing reason" the deployed dev site's older code leaves empty on a purchase's tax record
 *   … run-daily [--base URL] runs the daily job on THIS dev site (default http://localhost:3000) and prints its two steps
 *   … trial-preview          reads the next-invoice preview of every trialing walk subscription (build prompt §6's question)
 *   … switch on|off          LEGAL_PAGES_PREVIEW in .env.local (restart the dev server after)
 *   … window on|off          the next-season card window (NEXT_PUBLIC_FOUNDING_SEASON_CARD_WINDOW_OPEN) in .env.local (restart)
 *   … nextseason-undo        Part I only: withdraws the next-season choice the walk made on uat-plus-org
 *   … teardown               removes the walk's organizations, sign-ins and Stripe objects
 * A --inbox ending in .local sends no mail (the address is not deliverable): that is how this script was tested.
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { readFileSync, writeFileSync } from 'node:fs';
import { ensureUser, refusal } from './lib/billing-walk-fixture.mjs';
import { findUserByEmail } from './lib/fixture-user.mjs';

const MARKER = 'gst-6-4-walk-fixture';
const NEXT_SEASON_OWNER = 'uat-owner@uat-test-org.local'; // Part I's account (uat-plus-org); its mail is never delivered
const PASSWORD = 'UATPassword2026!';
const DAY = 86_400_000;
const COMMANDS = ['setup', 'status', 'settle', 'run-daily', 'trial-preview', 'switch', 'window', 'nextseason-undo', 'teardown'];
const usage = `Usage: node --env-file=.env.local scripts/seed-gst-6-4-walk-fixture.mjs <${COMMANDS.join('|')}> [--inbox you@example.com] [on|off] [--base URL]`;

const argv = process.argv.slice(2);
const command = argv[0];
if (!COMMANDS.includes(command)) { console.error(usage); process.exit(2); }
const flag = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const INBOX = flag('--inbox');
const BASE = flag('--base') ?? 'http://localhost:3000';
const toggle = argv[1];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const refused = refusal({ stripeKey: process.env.STRIPE_SECRET_KEY, supabaseUrl: url });
if (refused) { console.error(refused); process.exit(2); }
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const ok = msg => console.log(`  ✓ ${msg}`);
const head = msg => console.log(`\n${msg}`);
const die = (what, error) => { if (error) { console.error(`✗ ${what}: ${error.message ?? error}`); process.exit(1); } };
const one = async (what, q) => { const { data, error } = await q; die(what, error); return data; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = ms => new Date(ms).toISOString();
const plus = (address, tag) => address.replace('@', `+${tag}@`);

// ── the cast ────────────────────────────────────────────────────────────────────────────────────────────────────
const PEOPLE = [
  { tag: 'w64c', name: 'Walk64 Coach' }, { tag: 'w64l', name: 'Walk64 League Buyer' }, { tag: 'w64q', name: 'Walk64 Quebec Buyer' },
  { tag: 'w64a', name: 'Walk64 Upgrade Owner A' }, { tag: 'w64b', name: 'Walk64 Upgrade Owner B' },
  { tag: 'w64r', name: 'Walk64 Reminder Owner A' }, { tag: 'w64s', name: 'Walk64 Reminder Owner B' },
  { tag: 'w64x', name: 'Walk64 Cancelled Reminder Owner' }, { tag: 'w64m', name: 'Walk64 Monthly Reminder Owner' },
  { tag: 'w64o', name: 'Walk64 Quebec Club Owner' }, { tag: 'w64k', name: 'Walk64 Comeback Owner' },
];
// kind: how the club's Stripe subscription is made. owners: the tags that own it (the first one's address is the customer's).
const CLUBS = [
  { key: 'upgrade', name: 'Walk64 Upgrade Club', slug: 'walk64-upgrade-club', plan: 'tournament_plus', cycle: 'monthly', kind: 'live', owners: ['w64a', 'w64b'] },
  { key: 'reminder', name: 'Walk64 Reminder Club', slug: 'walk64-reminder-club', plan: 'tournament_plus', cycle: 'annual', kind: 'anchor33', fee: true, owners: ['w64r', 'w64s'] },
  { key: 'cancelled', name: 'Walk64 Cancelled Reminder', slug: 'walk64-cancelled-reminder', plan: 'tournament_plus', cycle: 'annual', kind: 'anchor33', cancelSet: true, owners: ['w64x'] },
  { key: 'monthly', name: 'Walk64 Monthly Reminder', slug: 'walk64-monthly-reminder', plan: 'tournament_plus', cycle: 'monthly', kind: 'live', owners: ['w64m'] },
  { key: 'quebec', name: 'Walk64 Quebec Club', slug: 'walk64-quebec-club', plan: 'club_large', cycle: 'monthly', kind: 'live', owners: ['w64o'] },
  { key: 'comeback', name: 'Walk64 Comeback Club', slug: 'walk64-comeback-club', plan: 'tournament_plus', cycle: 'monthly', kind: 'ended', owners: ['w64k'] },
];
const ONTARIO = { line1: '100 Queen St W', city: 'Toronto', state: 'ON', postal_code: 'M5H 2N2', country: 'CA' };

// Everyone the walk may have made, found by the tag on the address (works with any inbox once `setup` has been run).
async function walkUsers() {
  const found = [];
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    die('listUsers', error);
    for (const u of data.users) if (PEOPLE.some(p => (u.email ?? '').toLowerCase().includes(`+${p.tag}@`))) found.push(u);
    if (data.users.length < 200) break;
  }
  return found;
}
const walkOrgs = () => one('walk organizations', db.from('organizations').select('id, name, slug, plan_id, subscription_status, subscription_period, current_period_end, renewal_reminded_for, stripe_customer_id, stripe_subscription_id').eq('internal_notes', MARKER));

// ── status ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function status() {
  const users = await walkUsers();
  head(`Sign-ins (${users.length} of ${PEOPLE.length})`);
  for (const p of PEOPLE) {
    const u = users.find(x => (x.email ?? '').toLowerCase().includes(`+${p.tag}@`));
    console.log(`  ${u ? '✓' : '·'} +${p.tag}  ${u?.email ?? '— not there'}`);
  }
  const ids = users.map(u => u.id);
  head('Organizations the walk owns (made by setup, or by you in the walk)');
  const owned = ids.length ? await one('memberships', db.from('organization_members').select('organization_id, role, user_id').in('user_id', ids).eq('role', 'owner')) : [];
  const orgIds = [...new Set(owned.map(m => m.organization_id))];
  const orgs = orgIds.length ? await one('orgs', db.from('organizations').select('id, name, slug, plan_id, account_kind, subscription_status, subscription_period, current_period_end, renewal_reminded_for, stripe_subscription_id').in('id', orgIds)) : [];
  for (const o of orgs) {
    const n = owned.filter(m => m.organization_id === o.id).length;
    console.log(`  ${o.slug.padEnd(30)} ${String(o.plan_id).padEnd(16)} ${String(o.subscription_status).padEnd(9)} ${String(o.subscription_period ?? '—').padEnd(8)} owners=${n} period_end=${o.current_period_end?.slice(0, 10) ?? '—'} reminded_for=${o.renewal_reminded_for?.slice(0, 10) ?? '—'} ${o.stripe_subscription_id ?? 'no subscription'}`);
  }
  if (!orgs.length) console.log('  (none)');
  head('Stripe subscriptions of the walk\'s customers');
  const customerIds = new Set();
  for await (const c of stripe.customers.list({ limit: 100 })) {
    if (c.metadata?.walk === MARKER || ids.length && (c.email ?? '').includes('+w64')) customerIds.add(c.id);
  }
  for (const c of customerIds) {
    const subs = await stripe.subscriptions.list({ customer: c, status: 'all', limit: 10 });
    for (const s of subs.data) {
      const it = s.items.data[0];
      console.log(`  ${c}  ${s.id}  ${s.status}${s.cancel_at_period_end ? ' (cancel set)' : ''}  ${it?.price?.recurring?.interval ?? '?'}  period_end=${it?.current_period_end ? iso(it.current_period_end * 1000).slice(0, 10) : '—'}${s.trial_end ? `  trial_end=${iso(s.trial_end * 1000).slice(0, 10)}` : ''}`);
    }
  }
  if (!customerIds.size) console.log('  (none)');
  const emails = users.map(u => u.email.toLowerCase());
  head('Emails the app logged for the walk\'s addresses (newest first; a .local address is logged but never mailed)');
  const rows = emails.length ? await one('email log', db.from('platform_account_emails').select('kind, recipient_email, state, created_at').in('recipient_email', emails).order('created_at', { ascending: false }).limit(40)) : [];
  for (const r of rows) console.log(`  ${r.created_at.slice(11, 19)}  ${String(r.kind).padEnd(24)} ${r.recipient_email.padEnd(40)} ${r.state ?? 'sent'}`);
  if (!rows.length) console.log('  (none)');
  head('Tax records of the walk\'s customers (what the purchase email reads)');
  const cids = [...customerIds];
  const recs = cids.length ? await one('tax records', db.from('platform_charge_tax_records').select('invoice_number, billing_reason, amount_before_tax_cents, tax_total_cents, total_cents, status, purchase_email_at, stripe_customer_id, org_id').in('stripe_customer_id', cids).order('created_at', { ascending: false }).limit(30)) : [];
  for (const r of recs) console.log(`  ${String(r.invoice_number ?? '—').padEnd(16)} ${String(r.billing_reason ?? 'null').padEnd(20)} before=${r.amount_before_tax_cents} tax=${r.tax_total_cents} total=${r.total_cents} ${r.status} email=${r.purchase_email_at ? r.purchase_email_at.slice(11, 19) : 'not sent'}${r.org_id ? '' : ' (no org on the record)'}`);
  if (!recs.length) console.log('  (none)');
  head('Billing addresses saved for the walk (an org row or a person row)');
  const locs = orgIds.length || ids.length ? await one('locations', db.from('billing_locations').select('org_id, user_id, country, region_code, city, postal_code').or([orgIds.length ? `org_id.in.(${orgIds.join(',')})` : null, ids.length ? `user_id.in.(${ids.join(',')})` : null].filter(Boolean).join(','))) : [];
  for (const l of locs) console.log(`  ${l.org_id ? `org ${orgs.find(o => o.id === l.org_id)?.slug ?? l.org_id}` : `person ${users.find(u => u.id === l.user_id)?.email}`}  ${l.country}-${l.region_code}  ${l.city ?? ''} ${l.postal_code ?? ''}`);
  if (!locs.length) console.log('  (none)');
}

// ── setup ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function setup() {
  if (!INBOX || !/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(INBOX)) { console.error('--inbox needs a plain address with no + part (the script adds +w64c … +w64k).'); process.exit(2); }
  if ((await walkOrgs()).length) { console.error('The walk organizations already exist. Run teardown first.'); process.exit(1); }
  head('Sign-ins');
  const user = {};
  for (const p of PEOPLE) {
    const email = plus(INBOX, p.tag);
    const { user: u, created } = await ensureUser(db, { email, password: PASSWORD, fullName: p.name }).catch(e => die(`sign-in ${email}`, e));
    user[p.tag] = { id: u.id, email };
    ok(`${created ? 'made' : 'reset'} ${email}`);
  }

  const priceFor = async (plan, cycle) => {
    const row = await one(`price ${plan} ${cycle}`, db.from('stripe_prices').select('price_id').eq('environment', 'sandbox').eq('billing_cycle', cycle).eq('plan_id', plan).maybeSingle());
    if (!row?.price_id) die(`price ${plan} ${cycle}`, 'no sandbox price on file');
    return stripe.prices.retrieve(row.price_id);
  };

  head('Stripe (test mode): a customer and a subscription per club');
  const now = Date.now();
  for (const c of CLUBS) {
    const owner = user[c.owners[0]];
    c.price = await priceFor(c.plan, c.cycle);
    const customer = await stripe.customers.create({
      email: owner.email, name: c.name, address: ONTARIO, payment_method: 'pm_card_visa',
      invoice_settings: { default_payment_method: 'pm_card_visa' }, metadata: { walk: MARKER },
    });
    c.customerId = customer.id;
    const params = { customer: customer.id, items: [{ price: c.price.id }], automatic_tax: { enabled: true }, metadata: { walk: MARKER } };
    if (c.kind === 'anchor33') { params.billing_cycle_anchor = Math.floor((now + 33 * DAY) / 1000); params.proration_behavior = 'none'; }
    const sub = await stripe.subscriptions.create(params);
    c.subId = sub.id;
    const end = sub.items.data[0]?.current_period_end;
    c.periodEnd = end ? iso(end * 1000) : null;
    if (c.fee) {
      // A club's recovered fee rides the subscription's next invoice (lib/platform-stripe-fees.ts); the reminder must ignore it.
      await stripe.invoiceItems.create({ customer: customer.id, subscription: sub.id, amount: 12345, currency: 'cad', description: 'Walk fixture: a queued fee', tax_behavior: 'exclusive', tax_code: 'txcd_90050001' });
      ok(`${c.name}: a queued fee item of $123.45 on ${sub.id}`);
    }
    if (c.cancelSet) await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
    if (c.kind === 'ended') await stripe.subscriptions.cancel(sub.id);
    ok(`${c.name}: ${sub.id} (${sub.status}${c.cancelSet ? ', cancel set' : ''}${c.kind === 'ended' ? ', ended' : ''}), next period ends ${c.periodEnd?.slice(0, 10)}`);
  }

  head('Waiting 25 seconds so Stripe\'s own messages pass the dev site before the clubs are tied to them');
  await sleep(25_000);

  head('Clubs and their owners');
  for (const c of CLUBS) {
    const ended = c.kind === 'ended';
    const org = await one(`org ${c.name}`, db.from('organizations').insert({
      name: c.name, slug: c.slug, plan_id: c.plan, subscription_status: ended ? 'canceled' : 'active', account_kind: 'organization',
      is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
      tournament_limit: 9999, team_limit: null, onboarding_completed_at: iso(now),
      stripe_customer_id: c.customerId, stripe_subscription_id: ended ? null : c.subId, subscription_period: c.cycle,
      current_period_end: ended ? iso(now - 2 * DAY) : c.periodEnd,
      subscription_amount_cents: c.price.unit_amount, subscription_currency: c.price.currency,
    }).select('id').single());
    c.orgId = org.id;
    for (const tag of c.owners) {
      die(`owner ${tag}`, (await db.from('organization_members').insert({
        organization_id: org.id, user_id: user[tag].id, role: 'owner', status: 'active',
        display_name: PEOPLE.find(p => p.tag === tag).name, invited_at: iso(now), accepted_at: iso(now),
      })).error);
    }
    ok(`${c.name} (${c.slug}) · ${c.owners.map(t => user[t].email).join(' + ')}`);
  }
  console.log(`\nDone. All sign-ins use ${PASSWORD}. Run "status" any time to see what the walk has made.`);
}

// ── settle ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Stripe's test webhooks go to the DEPLOYED dev site, which runs whatever was last pushed. Older code writes a purchase's tax
// record first and leaves `billing_reason` empty; a record is never rewritten, so the purchase email (which needs the reason)
// would never qualify. This copies the reason from Stripe onto the walk's records that lack it, which is what 6.4's own code
// writes when it wins that race. Dev walk only; skips the starting subscriptions setup itself makes.
async function settle() {
  head('Filling the billing reason on the walk\'s tax records');
  let n = 0;
  for await (const c of stripe.customers.list({ limit: 100 })) {
    const mine = c.metadata?.walk === MARKER;
    if (!mine && !(c.email ?? '').includes('+w64') && (c.email ?? '').toLowerCase() !== NEXT_SEASON_OWNER) continue;
    for await (const inv of stripe.invoices.list({ customer: c.id, limit: 20 })) {
      if (!['subscription_create', 'subscription_update'].includes(inv.billing_reason ?? '')) continue;
      // Setup's own starting subscriptions are not purchases the walk is about: they are made seconds after their customer.
      if (mine && inv.created - c.created < 300) continue;
      const { data, error } = await db.from('platform_charge_tax_records').update({ billing_reason: inv.billing_reason })
        .eq('stripe_invoice_id', inv.id).is('billing_reason', null).select('invoice_number');
      die('settle', error);
      for (const r of data ?? []) { n++; ok(`${r.invoice_number ?? inv.id}: ${inv.billing_reason}`); }
    }
  }
  if (!n) console.log('  nothing to fill (every record with an organization already has its reason)');
}

// ── run-daily ───────────────────────────────────────────────────────────────────────────────────────────────────
async function runDaily() {
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.error('CRON_SECRET is not set in .env.local.'); process.exit(1); }
  head(`Running the daily job on ${BASE} (all its steps; the secret is read from .env.local and never printed)`);
  const res = await fetch(`${BASE}/api/platform-admin/stripe-fees-daily`, { method: 'POST', headers: { 'x-cron-secret': secret } }).catch(e => die('request', e));
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { console.error(`✗ HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }
  console.log(`  HTTP ${res.status}, ok=${body.ok}`);
  for (const s of body.steps ?? []) {
    if (['tax_records', 'purchase_emails', 'renewal_reminders'].includes(s.step)) console.log(`  ${s.step.padEnd(18)} ok=${s.ok}  ${JSON.stringify(s.result ?? s.error)}`);
  }
  const failed = (body.steps ?? []).filter(s => !s.ok && !['tax_records', 'purchase_emails', 'renewal_reminders'].includes(s.step));
  if (failed.length) console.log(`  (other steps that did not finish: ${failed.map(s => s.step).join(', ')} — not this walk's)`);
}

// ── trial-preview ───────────────────────────────────────────────────────────────────────────────────────────────
async function trialPreview() {
  head('Trialing subscriptions of the walk\'s customers: does the next-invoice preview carry tax lines?');
  let n = 0;
  for await (const c of stripe.customers.list({ limit: 100 })) {
    if (!(c.email ?? '').includes('+w64')) continue;
    for (const s of (await stripe.subscriptions.list({ customer: c.id, status: 'trialing', limit: 5 })).data) {
      n++;
      const p = await stripe.invoices.createPreview({ subscription: s.id });
      const lineTaxes = (p.lines?.data ?? []).flatMap(l => l.taxes ?? []);
      console.log(`  ${s.id}  trial_end=${iso(s.trial_end * 1000).slice(0, 10)}  automatic_tax=${s.automatic_tax?.enabled}  interval=${s.items.data[0]?.price?.recurring?.interval}`);
      console.log(`    preview: subtotal=${p.subtotal} total=${p.total} currency=${p.currency}  total_taxes=${(p.total_taxes ?? []).length} line_taxes=${lineTaxes.length}  tax amounts=${[...(p.total_taxes ?? []), ...lineTaxes].map(t => t.amount).join(',') || 'none'}`);
      console.log(`    ANSWER: the trial preview ${(p.total_taxes ?? []).length || lineTaxes.length ? 'DOES' : 'does NOT'} carry tax lines.`);
    }
  }
  if (!n) console.log('  none yet — start the League Plus trial in Part C first.');
}

// ── switches ────────────────────────────────────────────────────────────────────────────────────────────────────
function envLine(name, value) {
  const file = new URL('../.env.local', import.meta.url);
  const text = readFileSync(file, 'utf8');
  const re = new RegExp(`^${name}=.*$`, 'm');
  writeFileSync(file, re.test(text) ? text.replace(re, `${name}=${value}`) : `${text.replace(/\s*$/, '\n')}${name}=${value}\n`);
}
function removeEnvLine(name) {
  const file = new URL('../.env.local', import.meta.url);
  writeFileSync(file, readFileSync(file, 'utf8').replace(new RegExp(`^${name}=.*\\r?\\n?`, 'm'), ''));
}

// ── nextseason-undo ─────────────────────────────────────────────────────────────────────────────────────────────
async function nextSeasonUndo() {
  const org = await one('uat-plus-org', db.from('organizations').select('id, slug').eq('slug', 'uat-plus-org').maybeSingle());
  if (!org) { console.error('No uat-plus-org here.'); process.exit(1); }
  const f = await one('facts', db.from('organization_billing_facts').select('next_season_subscription_id').eq('org_id', org.id).maybeSingle());
  head('Withdrawing the next-season choice on uat-plus-org');
  // The choice is cleared FIRST, as lib/billing-setup.ts clearNextSeasonChoice says: a subscription ended while the choice is
  // on file would be read as the account cancelling.
  die('clear', (await db.from('organization_billing_facts').update({ next_season_plan_id: null, next_season_billing_cycle: null, next_season_chosen_at: null, next_season_subscription_id: null, updated_at: iso(Date.now()) }).eq('org_id', org.id)).error);
  ok('choice cleared');
  if (f?.next_season_subscription_id) { await stripe.subscriptions.cancel(f.next_season_subscription_id); ok(`${f.next_season_subscription_id} ended in Stripe`); } else ok('no choice subscription was on file');
}

// ── teardown ────────────────────────────────────────────────────────────────────────────────────────────────────
async function teardown() {
  head('Tearing the 6.4 walk down');
  const users = await walkUsers();
  const ids = users.map(u => u.id);
  const members = ids.length ? await one('memberships', db.from('organization_members').select('organization_id, role').in('user_id', ids)) : [];
  const orgIds = [...new Set(members.filter(m => m.role === 'owner').map(m => m.organization_id))];
  const orgs = orgIds.length ? await one('orgs', db.from('organizations').select('id, name, slug, stripe_customer_id, internal_notes').in('id', orgIds)) : [];
  // Stripe customers: the walk's own (tagged), those on the walk organizations, and those the walk's buyers made at Checkout.
  const customers = new Set(orgs.map(o => o.stripe_customer_id).filter(Boolean));
  for await (const c of stripe.customers.list({ limit: 100 })) {
    if (c.metadata?.walk === MARKER || (c.email ?? '').includes('+w64')) customers.add(c.id);
  }
  // Organizations first (a subscription ended while its organization exists would let Stripe's message end it and email the owner).
  for (const o of orgs) {
    for (const t of ['billing_retention_intents', 'billing_retained_records']) await db.from(t).delete().eq('org_id', o.id);
    await db.from('tournaments').delete().eq('org_id', o.id);
    await db.from('team_workspaces').delete().eq('workspace_org_id', o.id);
    await db.from('billing_locations').delete().eq('org_id', o.id);
    await db.from('organization_members').delete().eq('organization_id', o.id);
    const { error } = await db.from('organizations').delete().eq('id', o.id);
    if (error) console.log(`  ! ${o.slug} could not be removed (${error.message}) — remove it in platform admin`); else ok(`removed ${o.slug}`);
  }
  for (const c of customers) {
    for (const s of (await stripe.subscriptions.list({ customer: c, status: 'all', limit: 20 })).data) {
      if (!['canceled', 'incomplete_expired'].includes(s.status)) { await stripe.subscriptions.cancel(s.id); ok(`stopped ${s.id}`); }
    }
    await stripe.customers.del(c).then(() => ok(`deleted Stripe customer ${c}`), e => console.log(`  ! customer ${c}: ${e.message}`));
  }
  for (const u of users) {
    await db.from('billing_locations').delete().eq('user_id', u.id);
    await db.from('organization_members').delete().eq('user_id', u.id);
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.log(`  ! ${u.email}: ${error.message}`); else ok(`deleted ${u.email}`);
  }
  console.log('\n  Left on purpose: the Terms acceptance rows (append-only), the "Sent emails" log rows (kept 90 days), and the test-mode charge records');
  console.log('  in Bookkeeping that the walk\'s purchases made (they are Stripe test charges). Say so if you want those cleared too.');
}

if (command === 'setup') await setup();
else if (command === 'status') await status();
else if (command === 'settle') await settle();
else if (command === 'run-daily') await runDaily();
else if (command === 'trial-preview') await trialPreview();
else if (command === 'switch') {
  if (toggle !== 'on' && toggle !== 'off') { console.error(usage); process.exit(2); }
  envLine('LEGAL_PAGES_PREVIEW', toggle === 'on' ? 'true' : 'false');
  ok(`.env.local: LEGAL_PAGES_PREVIEW=${toggle === 'on' ? 'true' : 'false'} — now restart the dev server (stop it, then npm run dev)`);
} else if (command === 'window') {
  if (toggle !== 'on' && toggle !== 'off') { console.error(usage); process.exit(2); }
  if (toggle === 'on') envLine('NEXT_PUBLIC_FOUNDING_SEASON_CARD_WINDOW_OPEN', '2026-01-01T05:00:00.000Z'); else removeEnvLine('NEXT_PUBLIC_FOUNDING_SEASON_CARD_WINDOW_OPEN');
  ok(`.env.local: next-season card window ${toggle === 'on' ? 'opened (from 2026-01-01)' : 'back to its real date'} — now restart the dev server`);
} else if (command === 'nextseason-undo') await nextSeasonUndo();
else if (command === 'teardown') await teardown();
