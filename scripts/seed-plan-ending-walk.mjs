#!/usr/bin/env node
/**
 * PLANS END AT THE RENEWAL DATE · STAGE 1 OWNER WALK FIXTURE (§444). Dev Supabase + Stripe TEST mode only.
 *
 * Builds four clubs, each with its own owner — your inbox with a +tag, password UATPassword2026!:
 *   Ending Walk Club    (+pe1) League monthly on a live Stripe test subscription: the owner's and the operator's doors.
 *   Reminder Walk Club  (+pe2) Tournament Plus, a cancel that ends in 6 days, clicked 20 days ago: the seven-day reminder.
 *   Overdue Walk Ended  (+pe3) Tournament Plus, a cancel 5 days past its date; Stripe ended the subscription, its message
 *                              "never arrived": Finish this ending now, the ended outcome.
 *   Overdue Walk Live   (+pe4) Tournament Plus, a cancel 4 days past its date that Stripe still bills: the live outcome.
 *
 * Every club is tied to its Stripe objects only AFTER Stripe's own messages about creating (and, for one, ending) them
 * have gone by, so the dev site's webhook finds no club to act on — that is how a missed message looks. The cancels are
 * written straight into the record with the dates the walk needs (the reminder club has no Stripe subscription at all,
 * so no Stripe message can move its 6-day date).
 *
 *   node --env-file=.env.local scripts/seed-plan-ending-walk.mjs --inbox you@example.com
 *   node --env-file=.env.local scripts/seed-plan-ending-walk.mjs --reset     (stops the walk's Stripe subscriptions,
 *                                                                              removes the four clubs; sign-ins are kept)
 *   node --env-file=.env.local scripts/seed-plan-ending-walk.mjs --daily     (runs the daily job on the dev site now)
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { ensureUser as ensureSignIn, refusal } from './lib/billing-walk-fixture.mjs';

const MARKER = 'plan-ending-walk-fixture';
const PASSWORD = 'UATPassword2026!';
const DAY = 86_400_000;
const RETENTION_DAYS = 90; // BILLING_RETENTION_DAYS (lib/billing-cancellation-policy.ts) — a club, not a Coaches Portal

const usage = 'Usage: node --env-file=.env.local scripts/seed-plan-ending-walk.mjs --inbox <your address> | --reset | --daily';
const argv = process.argv.slice(2);
const RESET = argv.includes('--reset');
const DAILY = argv.includes('--daily');
const inboxAt = argv.indexOf('--inbox');
const INBOX = inboxAt >= 0 ? argv[inboxAt + 1] : null;
const known = new Set(['--reset', '--daily', '--inbox']);
for (const [i, a] of argv.entries()) {
  if (a.startsWith('--') && !known.has(a)) { console.error(`Unknown option ${a}\n${usage}`); process.exit(2); }
  if (!a.startsWith('--') && argv[i - 1] !== '--inbox') { console.error(`Unexpected ${a}\n${usage}`); process.exit(2); }
}
if ([RESET, DAILY, !!INBOX].filter(Boolean).length !== 1) { console.error(usage); process.exit(2); }
if (INBOX && !/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(INBOX)) {
  console.error('--inbox needs a plain address with no + part (the script adds +pe1 … +pe4).'); process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// The billing walk fixtures' one guard (scripts/lib/billing-walk-fixture.mjs): a Stripe TEST key, decided only by
// lib/stripe-mode.ts, and the dev project by its host name.
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
const plus = (address, tag) => address.replace('@', `+${tag}@`);

const CLUBS = [
  { key: 'main', tag: 'pe1', name: 'Ending Walk Club', slug: 'ending-walk-club', plan: 'league' },
  { key: 'reminder', tag: 'pe2', name: 'Reminder Walk Club', slug: 'reminder-walk-club', plan: 'tournament_plus' },
  { key: 'ended', tag: 'pe3', name: 'Overdue Walk Ended', slug: 'overdue-walk-ended', plan: 'tournament_plus' },
  { key: 'live', tag: 'pe4', name: 'Overdue Walk Live', slug: 'overdue-walk-live', plan: 'tournament_plus' },
];

// ── --daily: the same call pg_cron makes at 6:15 a.m. (the dev site, its own secret) ─────────────────────────────
if (DAILY) {
  head('Running the daily job on the dev site');
  die('daily job', (await db.rpc('app_cron_http_tick', { p_job_name: 'stripe_fees_tick', p_path: '/api/platform-admin/stripe-fees-daily' })).error);
  ok('sent. The job takes up to half a minute; the reminder email follows.');
  process.exit(0);
}

// ── --reset ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function walkOrgs() {
  return one('walk clubs', db.from('organizations').select('id, name, stripe_customer_id').eq('internal_notes', MARKER));
}
async function stopStripe(customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  for (const s of subs.data) {
    if (!['canceled', 'incomplete_expired'].includes(s.status)) { await stripe.subscriptions.cancel(s.id); ok(`stopped ${s.id}`); }
  }
}
if (RESET) {
  head('Removing the plan-ending walk clubs');
  const orgs = await walkOrgs();
  // A finished ending clears the club's Stripe fields, so the customers are found by their walk tag as well.
  const customers = new Set(orgs.map(o => o.stripe_customer_id).filter(Boolean));
  for await (const c of stripe.customers.list({ limit: 100 })) {
    if (c.metadata?.walk === MARKER) customers.add(c.id);
  }
  // The clubs go first: a subscription stopped while its club still exists would let Stripe's "ended" message end the
  // club on the dev site and email its owner.
  for (const org of orgs) {
    die(`intents ${org.name}`, (await db.from('billing_retention_intents').delete().eq('org_id', org.id)).error);
    die(`retained ${org.name}`, (await db.from('billing_retained_records').delete().eq('org_id', org.id)).error);
    die(`members ${org.name}`, (await db.from('organization_members').delete().eq('organization_id', org.id)).error);
    const { error } = await db.from('organizations').delete().eq('id', org.id);
    if (error) { console.error(`✗ ${org.name} could not be removed: ${error.message}`); process.exit(1); }
    ok(`removed ${org.name}`);
  }
  if (!orgs.length) ok('no walk clubs to remove');
  for (const c of customers) await stopStripe(c);
  process.exit(0);
}

// ── Build ───────────────────────────────────────────────────────────────────────────────────────────────────────
const existing = await walkOrgs();
if (existing.length) { console.error('The walk clubs already exist. Run with --reset first.'); process.exit(1); }

async function ensureUser(email, fullName) {
  const { user, created } = await ensureSignIn(db, { email, password: PASSWORD, fullName }).catch(error => die('sign-in', error));
  if (created) ok(`sign-in created ${email}`);
  return user;
}

const prices = await one('prices', db.from('stripe_prices').select('plan_id, price_id')
  .eq('environment', 'sandbox').eq('billing_cycle', 'monthly').in('plan_id', ['league', 'tournament_plus']));
const priceOf = plan => prices.find(p => p.plan_id === plan)?.price_id ?? die(`price ${plan}`, 'no sandbox monthly price');

head('Stripe (test mode): a customer and a subscription per club, except the reminder club');
const now = Date.now();
for (const c of CLUBS) {
  c.email = plus(INBOX, c.tag);
  c.user = await ensureUser(c.email, `${c.name} Owner`);
  if (c.key === 'reminder') continue;
  const customer = await stripe.customers.create({
    email: c.email, name: c.name, payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' }, metadata: { walk: MARKER },
  });
  const price = await stripe.prices.retrieve(priceOf(c.plan));
  const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: price.id }], metadata: { walk: MARKER } });
  c.customerId = customer.id; c.subId = sub.id; c.amount = price.unit_amount; c.currency = price.currency;
  c.periodEnd = sub.items.data[0]?.current_period_end ? iso(sub.items.data[0].current_period_end * 1000) : null;
  if (c.key === 'ended') { await stripe.subscriptions.cancel(sub.id); ok(`${c.name}: ${sub.id} created and ended in Stripe`); }
  else ok(`${c.name}: ${sub.id} (${sub.status}), renews ${c.periodEnd?.slice(0, 10)}`);
}
const reminderPrice = await stripe.prices.retrieve(priceOf('tournament_plus'));

head('Waiting 25 seconds so Stripe\'s own messages pass the dev site before the clubs are tied to them');
await sleep(25_000);

// The record's dates: a real period end falls at the subscription's own hour; these sit at 4 a.m. UTC like one.
const at4 = ms => { const d = new Date(ms); d.setUTCHours(4, 0, 0, 0); return d.getTime(); };
const dates = {
  reminder: { end: at4(now + 6 * DAY), clicked: now - 20 * DAY },
  ended: { end: at4(now - 5 * DAY), clicked: now - 35 * DAY },
  live: { end: at4(now - 4 * DAY), clicked: now - 34 * DAY },
};

head('Clubs');
for (const c of CLUBS) {
  const d = dates[c.key];
  const org = await one(`org ${c.name}`, db.from('organizations').insert({
    name: c.name, slug: c.slug, plan_id: c.plan, subscription_status: 'active', account_kind: 'organization',
    is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
    tournament_limit: 9999, team_limit: 9999, onboarding_completed_at: iso(now),
    stripe_customer_id: c.customerId ?? null, stripe_subscription_id: c.subId ?? null, subscription_period: 'monthly',
    current_period_end: d ? iso(d.end) : c.periodEnd,
    subscription_amount_cents: c.amount ?? reminderPrice.unit_amount, subscription_currency: c.currency ?? reminderPrice.currency,
  }).select('id').single());
  c.orgId = org.id;
  die(`owner ${c.name}`, (await db.from('organization_members').insert({
    organization_id: org.id, user_id: c.user.id, role: 'owner', status: 'active',
    display_name: `${c.name} Owner`, invited_at: iso(now), accepted_at: iso(now),
  })).error);
  ok(`${c.name} (${c.slug}) · owner ${c.email}`);
}

head('The waiting cancels');
const byOperator = 'uat-platform@fieldlogichq.ca';
for (const c of CLUBS.filter(x => dates[x.key])) {
  const d = dates[c.key];
  const door = c.key === 'live' ? 'operator' : 'owner';
  const by = door === 'operator' ? byOperator : c.email;
  die(`cancel ${c.name}`, (await db.from('billing_retention_intents').insert({
    org_id: c.orgId, intent_type: 'cancellation', status: 'pending', from_plan: c.plan, target_plan: null, keep_tournament_ids: [],
    effective_at: iso(d.end), retention_until: iso(d.end + RETENTION_DAYS * DAY),
    reason: 'Walk fixture', created_by: door === 'owner' ? c.user.id : null, created_by_email: by,
    stripe_subscription_id: c.subId ?? null, notify_owner: c.key !== 'live',
    // The click's own email went out at the click; the reminder club's reminder is the one still owed.
    ends_on_email_sent_at: iso(d.clicked), reminder_email_sent_at: c.key === 'reminder' ? null : iso(d.end - 7 * DAY),
    created_at: iso(d.clicked), change_log: [{ at: iso(d.clicked), action: 'scheduled', door, by }],
  })).error);
  ok(`${c.name}: ends ${iso(d.end).slice(0, 10)}, asked by ${door}`);
}

head('Done. Records (sign in as uat-platform@fieldlogichq.ca):');
for (const c of CLUBS) console.log(`  ${c.name.padEnd(20)} https://dev.fieldlogichq.ca/platform-admin/orgs/${c.orgId}`);
console.log(`\nOwners sign in with ${PASSWORD}; billing page: https://dev.fieldlogichq.ca/<slug>/admin/org/billing`);
