#!/usr/bin/env node
/**
 * GST/HST STAGE 6 · THE TWO 6.6 FIXES · OWNER WALK FIXTURE (the yearly reminder's fixed block; the details email for a move up
 * during a free trial). Dev Supabase + Stripe TEST mode only (the shared guard in scripts/lib/billing-walk-fixture.mjs refuses
 * anything else). The walk is docs/projects/active/GST_HST_STAGE6_6_FIXES_WALK.html (ledger §534). Model:
 * scripts/seed-gst-6-4-walk-fixture.mjs.
 *
 * Every sign-in is your inbox with a +tag (so the emails really arrive), password UATPassword2026!, Terms already agreed:
 *   +w66r / +w66s   the two owners of "Walk66 Reminder Club" (Tournament Plus, yearly, renews in 33 days) — Part B
 *   +w66a / +w66b   the two owners of "Walk66 Trial Club" (Club, monthly, a REAL 30-day free trial in Stripe) — Part C
 *
 *   node --env-file=.env.local scripts/seed-gst-6-6-fixes-walk-fixture.mjs setup --inbox you@example.com
 *   … status                 what exists, the emails sent to the walk's addresses, the tax records, the reminder stamp
 *   … run-daily [--base URL] runs the daily job on THIS dev site (default http://localhost:3000) and prints its three steps
 *   … teardown               removes the walk's organizations, sign-ins and Stripe objects
 * A --inbox ending in .local sends no mail (the address is not deliverable): that is how this script was tested.
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { ensureUser, fireJob, refusal } from './lib/billing-walk-fixture.mjs';

const MARKER = 'gst-6-6-fixes-walk-fixture';
const TAG = '+w66';
const PASSWORD = 'UATPassword2026!';
const DAY = 86_400_000;
const TRIAL_DAYS = 30;
const COMMANDS = ['setup', 'status', 'run-daily', 'teardown'];
const usage = `Usage: node --env-file=.env.local scripts/seed-gst-6-6-fixes-walk-fixture.mjs <${COMMANDS.join('|')}> [--inbox you@example.com] [--base URL]`;

const argv = process.argv.slice(2);
const command = argv[0];
if (!COMMANDS.includes(command)) { console.error(usage); process.exit(2); }
const flag = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const INBOX = flag('--inbox');
const BASE = flag('--base') ?? 'http://localhost:3000';

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
// The walk reads dates as the product writes them (Ontario time, long month).
const day = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'long', day: 'numeric' });
const cad = cents => `$${(cents / 100).toFixed(2)}`;

const PEOPLE = [
  { tag: 'w66r', name: 'Walk66 Reminder Owner A' }, { tag: 'w66s', name: 'Walk66 Reminder Owner B' },
  { tag: 'w66a', name: 'Walk66 Trial Owner A' }, { tag: 'w66b', name: 'Walk66 Trial Owner B' },
];
const CLUBS = [
  { key: 'reminder', name: 'Walk66 Reminder Club', slug: 'walk66-reminder-club', plan: 'tournament_plus', cycle: 'annual', kind: 'anchor33', owners: ['w66r', 'w66s'] },
  // The move UP from Club is Club · Association (club_large), same cycle. An Ontario billing address on file, as a club that
  // started its trial at checkout has (the move's tax quote reads the customer's address).
  { key: 'trial', name: 'Walk66 Trial Club', slug: 'walk66-trial-club', plan: 'club', cycle: 'monthly', kind: 'trial', owners: ['w66a', 'w66b'], address: true },
];
const ONTARIO = { line1: '100 Queen St W', city: 'Toronto', state: 'ON', postal_code: 'M5H 2N2', country: 'CA' };

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
async function walkCustomers() {
  const ids = new Set();
  for await (const c of stripe.customers.list({ limit: 100 })) if (c.metadata?.walk === MARKER || (c.email ?? '').includes(TAG)) ids.add(c.id);
  return [...ids];
}

// ── status ──────────────────────────────────────────────────────────────────────────────────────────────────────
async function status() {
  const users = await walkUsers();
  head(`Sign-ins (${users.length} of ${PEOPLE.length})`);
  for (const p of PEOPLE) {
    const u = users.find(x => (x.email ?? '').toLowerCase().includes(`+${p.tag}@`));
    console.log(`  ${u ? '✓' : '·'} +${p.tag}  ${u?.email ?? '— not there'}`);
  }
  head('The walk\'s clubs');
  const orgs = await walkOrgs();
  for (const o of orgs) console.log(`  ${o.slug.padEnd(22)} ${String(o.plan_id).padEnd(16)} ${String(o.subscription_status).padEnd(9)} ${String(o.subscription_period ?? '—').padEnd(8)} period_end=${o.current_period_end?.slice(0, 10) ?? '—'} reminded_for=${o.renewal_reminded_for?.slice(0, 10) ?? '—'} ${o.stripe_subscription_id ?? 'no subscription'}`);
  if (!orgs.length) console.log('  (none — run setup)');
  head('Stripe subscriptions');
  const customers = await walkCustomers();
  for (const c of customers) {
    for (const s of (await stripe.subscriptions.list({ customer: c, status: 'all', limit: 10 })).data) {
      const it = s.items.data[0];
      console.log(`  ${s.id}  ${s.status}  ${it?.price?.nickname ?? it?.price?.id}  ${cad(it?.price?.unit_amount ?? 0)}/${it?.price?.recurring?.interval}${s.trial_end ? `  trial ends ${day(s.trial_end * 1000)}` : ''}`);
    }
  }
  const emails = users.map(u => u.email.toLowerCase());
  head('Emails the app logged for the walk\'s addresses (newest first)');
  const rows = emails.length ? await one('email log', db.from('platform_account_emails').select('kind, recipient_email, state, created_at').in('recipient_email', emails).order('created_at', { ascending: false }).limit(20)) : [];
  for (const r of rows) console.log(`  ${r.created_at.slice(11, 19)}  ${String(r.kind).padEnd(24)} ${r.recipient_email.padEnd(40)} ${r.state ?? 'sent'}`);
  if (!rows.length) console.log('  (none)');
  head('Tax records (what the purchase email reads)');
  const recs = customers.length ? await one('tax records', db.from('platform_charge_tax_records').select('invoice_number, billing_reason, total_cents, status, purchase_email_at, org_id').in('stripe_customer_id', customers).order('created_at', { ascending: false }).limit(20)) : [];
  for (const r of recs) console.log(`  ${String(r.invoice_number ?? '—').padEnd(16)} ${String(r.billing_reason ?? 'null').padEnd(20)} total=${r.total_cents} ${r.status} email=${r.purchase_email_at ? r.purchase_email_at.slice(11, 19) : 'not sent'}${r.org_id ? '' : ' (no club on the record: setup\'s own, never emailed)'}`);
  if (!recs.length) console.log('  (none)');
}

// ── setup ───────────────────────────────────────────────────────────────────────────────────────────────────────
async function setup() {
  if (!INBOX || !/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(INBOX)) { console.error('--inbox needs a plain address with no + part (the script adds +w66r … +w66b).'); process.exit(2); }
  if ((await walkOrgs()).length) { console.error('The walk clubs already exist. Run teardown first.'); process.exit(1); }
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
    const params = { customer: customer.id, items: [{ price: c.price.id }], automatic_tax: { enabled: true }, metadata: { walk: MARKER, orgSlug: c.slug } };
    if (c.kind === 'anchor33') { params.billing_cycle_anchor = Math.floor((now + 33 * DAY) / 1000); params.proration_behavior = 'none'; }
    if (c.kind === 'trial') params.trial_period_days = TRIAL_DAYS;
    const sub = await stripe.subscriptions.create(params);
    c.subId = sub.id;
    c.status = sub.status;
    const end = c.kind === 'trial' ? sub.trial_end : sub.items.data[0]?.current_period_end;
    c.periodEnd = end ? iso(end * 1000) : null;
    ok(`${c.name}: ${sub.id} (${sub.status}), ${c.kind === 'trial' ? 'trial ends' : 'renews'} ${c.periodEnd ? day(Date.parse(c.periodEnd)) : '—'}`);
  }

  head('Waiting 25 seconds so Stripe\'s own messages pass the dev site before the clubs are tied to them');
  await sleep(25_000);

  head('Clubs and their owners');
  for (const c of CLUBS) {
    const org = await one(`org ${c.name}`, db.from('organizations').insert({
      name: c.name, slug: c.slug, plan_id: c.plan, subscription_status: c.status, account_kind: 'organization',
      is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
      tournament_limit: 9999, team_limit: null, onboarding_completed_at: iso(now),
      stripe_customer_id: c.customerId, stripe_subscription_id: c.subId, subscription_period: c.cycle,
      current_period_end: c.periodEnd, subscription_amount_cents: c.price.unit_amount, subscription_currency: c.price.currency,
    }).select('id').single());
    c.orgId = org.id;
    if (c.address) {
      die(`address ${c.name}`, (await db.from('billing_locations').insert({
        org_id: org.id, country: 'CA', region_code: 'ON', line1: ONTARIO.line1, city: ONTARIO.city, postal_code: ONTARIO.postal_code, confirmed_at: iso(now),
      })).error);
    }
    for (const tag of c.owners) {
      die(`owner ${tag}`, (await db.from('organization_members').insert({
        organization_id: org.id, user_id: user[tag].id, role: 'owner', status: 'active',
        display_name: PEOPLE.find(p => p.tag === tag).name, invited_at: iso(now), accepted_at: iso(now),
      })).error);
    }
    ok(`${c.name} (${c.slug}) · ${c.owners.map(t => user[t].email).join(' + ')}`);
  }

  // What the walk reads, worked out now so its figures are this run's (Stripe's own preview of the move up).
  const trial = CLUBS.find(c => c.key === 'trial');
  const up = await priceFor('club_large', trial.cycle);
  const sub = await stripe.subscriptions.retrieve(trial.subId);
  const preview = await stripe.invoices.createPreview({
    customer: trial.customerId, subscription: trial.subId,
    subscription_details: { items: [{ id: sub.items.data[0].id, price: up.id }], proration_behavior: 'always_invoice' }, automatic_tax: { enabled: true },
  });
  const tax = Math.round(up.unit_amount * 0.13);
  const reminder = CLUBS.find(c => c.key === 'reminder');
  head('What the walk will read (write these on the walk if you like)');
  console.log(`  Part B · Walk66 Reminder Club renews on ${day(Date.parse(reminder.periodEnd))} at ${cad(reminder.price.unit_amount)} plus applicable taxes (HST 13% ${cad(Math.round(reminder.price.unit_amount * 0.13))}).`);
  console.log(`  Part C · the move window should say ${cad(preview.amount_due)} due today.`);
  console.log(`  Part C · first payment ${cad(up.unit_amount)} plus applicable taxes on ${day(sub.trial_end * 1000)}; estimated HST 13% about ${cad(tax)}, total about ${cad(up.unit_amount + tax)} CAD.`);
  console.log(`\nDone. All sign-ins use ${PASSWORD}. Run "status" any time to see what the walk has made.`);
}

// ── run-daily ───────────────────────────────────────────────────────────────────────────────────────────────────
// Stripe's test webhooks go to the DEPLOYED dev site, which runs whatever was last pushed. If its code is older than 6.4 it
// leaves `billing_reason` empty on a purchase's tax record, and a record is never rewritten, so this copies the reason from
// Stripe onto the walk's records that lack it (what 6.4's own code writes), then runs the daily job on THIS dev site.
async function settle() {
  let n = 0;
  for (const cid of await walkCustomers()) {
    const c = await stripe.customers.retrieve(cid);
    for await (const inv of stripe.invoices.list({ customer: cid, limit: 20 })) {
      if (!['subscription_create', 'subscription_update'].includes(inv.billing_reason ?? '')) continue;
      if (inv.created - c.created < 300) continue; // setup's own starting subscriptions are not purchases the walk is about
      const { data, error } = await db.from('platform_charge_tax_records').update({ billing_reason: inv.billing_reason })
        .eq('stripe_invoice_id', inv.id).is('billing_reason', null).select('invoice_number');
      if (error && /keeps what it recorded/.test(error.message)) continue;
      die('settle', error);
      for (const r of data ?? []) { n++; ok(`${r.invoice_number ?? inv.id}: billing reason ${inv.billing_reason} filled`); }
    }
  }
  return n;
}
async function runDaily() {
  await settle();
  const secret = process.env.CRON_SECRET;
  if (!secret) { console.error('CRON_SECRET is not set in .env.local.'); process.exit(1); }
  head(`Running the daily job on ${BASE} (the secret is read from .env.local and never printed)`);
  const res = await fireJob(db, { base: BASE, path: '/api/platform-admin/stripe-fees-daily', jobName: 'stripe_fees_tick', secret }).catch(e => die('request (is the dev server running?)', e));
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { console.error(`✗ HTTP ${res.status}: ${text.slice(0, 300)}`); process.exit(1); }
  console.log(`  HTTP ${res.status}, ok=${body.ok}`);
  const MINE = ['tax_records', 'purchase_emails', 'renewal_reminders'];
  for (const s of body.steps ?? []) if (MINE.includes(s.step)) console.log(`  ${s.step.padEnd(18)} ok=${s.ok}  ${JSON.stringify(s.result ?? s.error)}`);
  const failed = (body.steps ?? []).filter(s => !s.ok && !MINE.includes(s.step));
  if (failed.length) console.log(`  (other steps that did not finish: ${failed.map(s => s.step).join(', ')} — not this walk's)`);
}

// ── teardown ────────────────────────────────────────────────────────────────────────────────────────────────────
async function teardown() {
  head('Tearing the 6.6 fixes walk down');
  const orgs = await walkOrgs();
  const customers = new Set([...orgs.map(o => o.stripe_customer_id).filter(Boolean), ...await walkCustomers()]);
  // Organizations first (a subscription ended while its organization exists would let Stripe's message end it and email the owner).
  for (const o of orgs) {
    for (const t of ['billing_retention_intents', 'billing_retained_records']) await db.from(t).delete().eq('org_id', o.id);
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
  for (const u of await walkUsers()) {
    await db.from('organization_members').delete().eq('user_id', u.id);
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.log(`  ! ${u.email}: ${error.message}`); else ok(`deleted ${u.email}`);
  }
  console.log('\n  Left on purpose: the "Sent emails" log rows (kept 90 days) and the test-mode tax records (a record is kept by design).');
}

if (command === 'setup') await setup();
else if (command === 'status') await status();
else if (command === 'run-daily') await runDaily();
else if (command === 'teardown') await teardown();
