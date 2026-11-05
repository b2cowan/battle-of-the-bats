#!/usr/bin/env node
/**
 * PLANS END AT THE RENEWAL DATE · STAGE 2 OWNER WALK FIXTURE (a move to the free plan that waits). Dev Supabase + Stripe
 * TEST mode only. The Stage 1 walk's fixture is scripts/seed-plan-ending-walk.mjs; this one is its Stage 2 sibling.
 *
 * Builds four Tournament Plus clubs, each with its own owner — your inbox with a +tag, password UATPassword2026!:
 *   Move Walk Club      (+pm1) on a live Stripe test subscription, three tournaments: the owner's move, its emails, Change
 *                              which tournament you keep, Keep, Cancel over a move, and (--date) the date itself.
 *   Move Reminder Club  (+pm2) a move 6 days away, asked 20 days ago, no Stripe subscription; the tournament it picked is
 *                              archived since, so the band and the reminder ask again. Also the staff plan-change refusal.
 *   Move Overdue Club   (+pm3) a move 5 days past its date; Stripe ended the subscription and its message "never arrived":
 *                              the staff refusal while overdue, then Finish this ending now.
 *   Move Spare Club     (+pm4) Tournament Plus on a live Stripe test subscription with one tournament: a move with nothing
 *                              to choose (the window has no choice, the band names the one kept).
 *
 * Every club is tied to its Stripe objects only AFTER Stripe's own messages about creating (and, for one, ending) them have
 * gone by, so the dev site's webhook finds no club to act on — that is how a missed message looks.
 *
 *   node --env-file=.env.local scripts/seed-plan-move-walk.mjs --inbox you@example.com
 *   node --env-file=.env.local scripts/seed-plan-move-walk.mjs --daily   (runs the daily job on the dev site now)
 *   node --env-file=.env.local scripts/seed-plan-move-walk.mjs --date    (ends Move Walk Club's Stripe subscription now:
 *                                                                          Stripe's "ended" message runs the waiting move)
 *   node --env-file=.env.local scripts/seed-plan-move-walk.mjs --reset   (removes the four clubs, then stops their Stripe
 *                                                                          subscriptions; sign-ins are kept)
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { ensureUser as ensureSignIn, refusal } from './lib/billing-walk-fixture.mjs';

const MARKER = 'plan-move-walk-fixture';
const PASSWORD = 'UATPassword2026!';
const DAY = 86_400_000;
const RETENTION_DAYS = 90; // BILLING_RETENTION_DAYS (lib/billing-cancellation-policy.ts) — a club, not a Coaches Portal

const usage = 'Usage: node --env-file=.env.local scripts/seed-plan-move-walk.mjs --inbox <your address> | --daily | --date | --reset';
const argv = process.argv.slice(2);
const RESET = argv.includes('--reset');
const DAILY = argv.includes('--daily');
const DATE = argv.includes('--date');
const inboxAt = argv.indexOf('--inbox');
const INBOX = inboxAt >= 0 ? argv[inboxAt + 1] : null;
const known = new Set(['--reset', '--daily', '--date', '--inbox']);
for (const [i, a] of argv.entries()) {
  if (a.startsWith('--') && !known.has(a)) { console.error(`Unknown option ${a}\n${usage}`); process.exit(2); }
  if (!a.startsWith('--') && argv[i - 1] !== '--inbox') { console.error(`Unexpected ${a}\n${usage}`); process.exit(2); }
}
if ([RESET, DAILY, DATE, !!INBOX].filter(Boolean).length !== 1) { console.error(usage); process.exit(2); }
if (INBOX && !/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(INBOX)) {
  console.error('--inbox needs a plain address with no + part (the script adds +pm1 … +pm4).'); process.exit(2);
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
  { key: 'main', tag: 'pm1', name: 'Move Walk Club', slug: 'move-walk-club', stripe: 'live',
    tournaments: [['Spring Classic', 'active', 90], ['Summer Slam', 'draft', 60], ['Fall Cup', 'active', 30]] },
  { key: 'reminder', tag: 'pm2', name: 'Move Reminder Club', slug: 'move-reminder-club', stripe: null,
    tournaments: [['Old Classic', 'archived', 120], ['Indoor Open', 'draft', 80], ['Winter Cup', 'active', 40]] },
  { key: 'overdue', tag: 'pm3', name: 'Move Overdue Club', slug: 'move-overdue-club', stripe: 'ended',
    tournaments: [['Lakeside Open', 'active', 70], ['Harbour Cup', 'draft', 50]] },
  { key: 'spare', tag: 'pm4', name: 'Move Spare Club', slug: 'move-spare-club', stripe: 'live',
    tournaments: [['Only Cup', 'active', 45]] },
];

async function walkOrgs() {
  return one('walk clubs', db.from('organizations').select('id, name, slug, stripe_customer_id, stripe_subscription_id').eq('internal_notes', MARKER));
}

// ── --daily: the same call pg_cron makes at 6:15 a.m. (the dev site, its own secret) ─────────────────────────────
if (DAILY) {
  head('Running the daily job on the dev site');
  die('daily job', (await db.rpc('app_cron_http_tick', { p_job_name: 'stripe_fees_tick', p_path: '/api/platform-admin/stripe-fees-daily' })).error);
  ok('sent. The job takes up to half a minute; the reminder email follows.');
  process.exit(0);
}

// ── --date: Move Walk Club's renewal date, now (Stripe ends the subscription; its message runs the waiting move) ────
if (DATE) {
  head('Ending Move Walk Club\'s Stripe subscription now');
  const main = (await walkOrgs()).find(o => o.slug === 'move-walk-club');
  if (!main?.stripe_subscription_id) { console.error('✗ Move Walk Club has no Stripe subscription on its record (already moved, or not built).'); process.exit(1); }
  const { data: waiting } = await db.from('billing_retention_intents').select('intent_type').eq('org_id', main.id).eq('status', 'pending').maybeSingle();
  if (waiting?.intent_type !== 'downgrade') {
    console.error(`✗ Move Walk Club has no waiting move (${waiting ? `a waiting ${waiting.intent_type}` : 'nothing waits'}). Schedule the move first, or Stripe's message would end the plan as a cancel.`);
    process.exit(1);
  }
  await stripe.subscriptions.cancel(main.stripe_subscription_id);
  ok(`${main.stripe_subscription_id} ended in Stripe. Its message reaches the dev site within a minute.`);
  process.exit(0);
}

// ── --reset ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function stopStripe(customerId) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  for (const s of subs.data) {
    if (!['canceled', 'incomplete_expired'].includes(s.status)) { await stripe.subscriptions.cancel(s.id); ok(`stopped ${s.id}`); }
  }
}
if (RESET) {
  head('Removing the plan-move walk clubs');
  const orgs = await walkOrgs();
  // A finished move clears the club's Stripe fields, so the customers are found by their walk tag as well.
  const customers = new Set(orgs.map(o => o.stripe_customer_id).filter(Boolean));
  for await (const c of stripe.customers.list({ limit: 100 })) {
    if (c.metadata?.walk === MARKER) customers.add(c.id);
  }
  // The clubs go first: a subscription stopped while its club still exists would let Stripe's "ended" message end (or
  // move) the club on the dev site and email its owner.
  for (const org of orgs) {
    die(`intents ${org.name}`, (await db.from('billing_retention_intents').delete().eq('org_id', org.id)).error);
    die(`retained ${org.name}`, (await db.from('billing_retained_records').delete().eq('org_id', org.id)).error);
    die(`tournaments ${org.name}`, (await db.from('tournaments').delete().eq('org_id', org.id)).error);
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

const priceRow = await one('price', db.from('stripe_prices').select('price_id')
  .eq('environment', 'sandbox').eq('billing_cycle', 'monthly').eq('plan_id', 'tournament_plus').maybeSingle());
if (!priceRow?.price_id) die('price tournament_plus', 'no sandbox monthly price');
const price = await stripe.prices.retrieve(priceRow.price_id);

head('Stripe (test mode): a customer and a subscription per club, except the reminder club');
const now = Date.now();
for (const c of CLUBS) {
  c.email = plus(INBOX, c.tag);
  c.user = await ensureUser(c.email, `${c.name} Owner`);
  if (!c.stripe) continue;
  const customer = await stripe.customers.create({
    email: c.email, name: c.name, payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' }, metadata: { walk: MARKER },
  });
  const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: price.id }], metadata: { walk: MARKER } });
  c.customerId = customer.id; c.subId = sub.id;
  c.periodEnd = sub.items.data[0]?.current_period_end ? iso(sub.items.data[0].current_period_end * 1000) : null;
  if (c.stripe === 'ended') { await stripe.subscriptions.cancel(sub.id); ok(`${c.name}: ${sub.id} created and ended in Stripe`); }
  else ok(`${c.name}: ${sub.id} (${sub.status}), renews ${c.periodEnd?.slice(0, 10)}`);
}

head('Waiting 25 seconds so Stripe\'s own messages pass the dev site before the clubs are tied to them');
await sleep(25_000);

// The record's dates: a real period end falls at the subscription's own hour; these sit at 4 a.m. UTC like one.
const at4 = ms => { const d = new Date(ms); d.setUTCHours(4, 0, 0, 0); return d.getTime(); };
const dates = {
  reminder: { end: at4(now + 6 * DAY), clicked: now - 20 * DAY },
  overdue: { end: at4(now - 5 * DAY), clicked: now - 35 * DAY },
};

head('Clubs and their tournaments');
const year = new Date(now).getUTCFullYear() + 1;
for (const c of CLUBS) {
  const d = dates[c.key];
  const org = await one(`org ${c.name}`, db.from('organizations').insert({
    name: c.name, slug: c.slug, plan_id: 'tournament_plus', subscription_status: 'active', account_kind: 'organization',
    is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
    tournament_limit: 9999, team_limit: 9999, onboarding_completed_at: iso(now),
    stripe_customer_id: c.customerId ?? null, stripe_subscription_id: c.subId ?? null, subscription_period: 'monthly',
    current_period_end: d ? iso(d.end) : c.periodEnd,
    subscription_amount_cents: price.unit_amount, subscription_currency: price.currency,
  }).select('id').single());
  c.orgId = org.id;
  die(`owner ${c.name}`, (await db.from('organization_members').insert({
    organization_id: org.id, user_id: c.user.id, role: 'owner', status: 'active',
    display_name: `${c.name} Owner`, invited_at: iso(now), accepted_at: iso(now),
  })).error);
  c.tournamentIds = {};
  for (const [name, status, daysAgo] of c.tournaments) {
    // Made `daysAgo` days ago, so "the newest" (the date's fallback) is the last in each list that still holds a slot.
    const row = await one(`tournament ${name}`, db.from('tournaments').insert({
      org_id: org.id, year, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), status, is_active: status === 'active',
      start_date: `${year}-06-01`, end_date: `${year}-06-03`, sport: 'baseball', list_in_directory: false, created_at: iso(now - daysAgo * DAY),
    }).select('id').single());
    c.tournamentIds[name] = row.id;
  }
  ok(`${c.name} (${c.slug}) · owner ${c.email} · ${c.tournaments.map(t => `${t[0]} (${t[1]})`).join(', ')}`);
}

head('The waiting moves (written straight into the record with the dates the walk needs)');
const picks = { reminder: 'Old Classic', overdue: 'Lakeside Open' };
for (const c of CLUBS.filter(x => dates[x.key])) {
  const d = dates[c.key];
  die(`move ${c.name}`, (await db.from('billing_retention_intents').insert({
    org_id: c.orgId, intent_type: 'downgrade', status: 'pending', from_plan: 'tournament_plus', target_plan: 'tournament',
    keep_tournament_ids: [c.tournamentIds[picks[c.key]]],
    effective_at: iso(d.end), retention_until: iso(d.end + RETENTION_DAYS * DAY),
    reason: 'Walk fixture', created_by: c.user.id, created_by_email: c.email,
    stripe_subscription_id: c.subId ?? null, notify_owner: true,
    // The click's own email went out at the click; the reminder club's reminder is the one still owed.
    ends_on_email_sent_at: iso(d.clicked), reminder_email_sent_at: c.key === 'reminder' ? null : iso(d.end - 7 * DAY),
    created_at: iso(d.clicked), change_log: [{ at: iso(d.clicked), action: 'scheduled', door: 'owner', by: c.email }],
  })).error);
  ok(`${c.name}: moves to Tournament ${iso(d.end).slice(0, 10)}, picked ${picks[c.key]}`);
}

head('Done. Records (sign in as uat-platform@fieldlogichq.ca):');
for (const c of CLUBS) console.log(`  ${c.name.padEnd(20)} https://dev.fieldlogichq.ca/platform-admin/orgs/${c.orgId}`);
const main = CLUBS.find(c => c.key === 'main');
console.log(`\nMove Walk Club renews ${main.periodEnd?.slice(0, 10)} — the walk calls that "the renewal date".`);
console.log(`Owners sign in with ${PASSWORD}; billing page: https://dev.fieldlogichq.ca/<slug>/admin/org/billing`);
