#!/usr/bin/env node
/**
 * PLANS END AT THE RENEWAL DATE · STAGE 3 — the Stripe test-clock rehearsal (G10) and the portal-settings check (G13 a).
 * Stripe TEST mode and the DEV database only; refuses anything else before a single call.
 *
 * Each case makes one club on its own Stripe test clock, owned by your inbox with a +tag (+pr1 … +pr12b; password
 * UATPassword2026!), drives it through the DEV SITE's own routes (signed in as that owner, or as the UAT platform operator for
 * End now), moves the clock past the renewal, waits for Stripe's messages to land on the dev site, and compares what our dev
 * database and Stripe hold with the case's EXPECTED state (written in scripts/lib/plan-ending-rehearsal.mjs before any run).
 *
 *   node --env-file=.env.local scripts/rehearse-plan-ending.mjs --run --inbox you@example.com [--case 1,2] [--keep]
 *   node --env-file=.env.local scripts/rehearse-plan-ending.mjs --reset [--case 6b,7]  (our clubs FIRST, then the clocks)
 *   node --env-file=.env.local scripts/rehearse-plan-ending.mjs --list                  (the cases and what each expects)
 *
 *   --site <url>           where Stripe's messages land (default https://dev.fieldlogichq.ca; a local server needs
 *                          `stripe listen --forward-to localhost:3000/api/billing/webhook` and a matching secret)
 *   --skip-build-check     run although the dev site's build differs from this checkout (say why in the report)
 *   --keep                 leave the cases' clubs in dev for the owner walk (reset within ~3 weeks: Stripe deletes a test
 *                          clock 30 days after it was made and stops its subscriptions itself)
 *
 * Evidence: .probe/plan-ending-rehearsal/<time>/results.json + report.md, written after every case.
 * The run never changes product code; a defect it finds is a finding for the owner (plan Stage 3, findings policy).
 */
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  CASES, MARKER, DAY, refusal, classify, notYet, portalGate, resetSelection, renderReport, clubName, clockPrefix, stepLabel,
} from './lib/plan-ending-rehearsal.mjs';
import { ensureUser, signInCookie } from './lib/billing-walk-fixture.mjs';
import { auditPortal } from './lib/stripe-portal-audit.mjs';
import { STRIPE_API_VERSION } from '../lib/stripe.ts';

const usage = 'Usage: node --env-file=.env.local scripts/rehearse-plan-ending.mjs --run --inbox <address> [--case 1,2] [--keep] [--site <url>] [--skip-build-check] | --reset [--case …] | --list';
const argv = process.argv.slice(2);
const flag = name => argv.includes(name);
const value = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const TAKES = new Set(['--inbox', '--case', '--site']);
const KNOWN = new Set([...TAKES, '--run', '--reset', '--list', '--keep', '--skip-build-check']);
for (const [i, a] of argv.entries()) {
  if (a.startsWith('--') && !KNOWN.has(a)) { console.error(`Unknown option ${a}\n${usage}`); process.exit(2); }
  if (!a.startsWith('--') && !TAKES.has(argv[i - 1])) { console.error(`Unexpected ${a}\n${usage}`); process.exit(2); }
}
const RUN = flag('--run'), RESET = flag('--reset'), LIST = flag('--list');
if ([RUN, RESET, LIST].filter(Boolean).length !== 1) { console.error(usage); process.exit(2); }

if (LIST) {
  for (const c of CASES) {
    console.log(`\n${c.id} · ${c.title}`);
    for (const s of c.steps) console.log(`    ${stepLabel(s)}`);
    for (const e of c.expect) console.log(`  ${e.level === 'must' ? 'must   ' : 'assumed'} ${e.label}`);
  }
  process.exit(0);
}

// ── The refusal: before any Stripe or database call ───────────────────────────────────────────────────────────────
const refused = refusal({ stripeKey: process.env.STRIPE_SECRET_KEY, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
if (refused) { console.error(refused); process.exit(2); }

const INBOX = value('--inbox')?.toLowerCase() ?? null; // the email log stores addresses in lower case
if (RUN && (!INBOX || !/^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(INBOX))) {
  console.error('--run needs --inbox with a plain address and no + part (the script adds +pr1 … +pr12b).'); process.exit(2);
}
const DEV_SITE = 'https://dev.fieldlogichq.ca';
const SITE = (value('--site') ?? DEV_SITE).replace(/\/$/, '');
// The dev site, or a local server: owner and operator sign-ins and a signed webhook go to it, so nothing else.
if (SITE !== DEV_SITE && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SITE)) {
  console.error(`Refusing: --site must be ${DEV_SITE} or a local http://localhost:<port>.`); process.exit(2);
}
const wanted = value('--case')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
if (wanted) {
  const unknown = wanted.filter(id => !CASES.some(c => c.id === id));
  if (unknown.length) { console.error(`Unknown case ${unknown.join(', ')}. Cases: ${CASES.map(c => c.id).join(', ')}`); process.exit(2); }
}

const PASSWORD = 'UATPassword2026!';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = msOrNull => (msOrNull == null ? null : new Date(msOrNull).toISOString());
const fromUnix = s => (s == null ? null : iso(s * 1000));
const toUnix = ms => Math.floor(ms / 1000);
const log = msg => console.log(msg);
async function rows(what, q) { const { data, error } = await q; if (error) throw new Error(`${what}: ${error.message}`); return data; }
async function until(test, timeoutMs, everyMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await test()) return true;
    if (Date.now() > deadline) return false;
    await sleep(everyMs);
  }
}

// ── Reset (also the end of a run without --keep): our rows FIRST, then the clocks ─────────────────────────────────
async function rehearsalOrgs() {
  return rows('rehearsal clubs', db.from('organizations').select('id, name, slug, internal_notes, stripe_customer_id').eq('internal_notes', MARKER));
}

async function reset(caseIds = null) {
  const lines = [];
  const clocks = [];
  for await (const c of stripe.testHelpers.testClocks.list({ limit: 100 })) clocks.push(c);
  const { orgIds, clockIds } = resetSelection({ orgs: await rehearsalOrgs(), clocks, caseIds });
  const customers = [];
  for (const id of clockIds) {
    for await (const c of stripe.customers.list({ test_clock: id, limit: 10 })) customers.push(c.id);
  }
  // The clubs go first: deleting a clock DOES send "subscription deleted" to the dev site (observed 2026-11-05), and it
  // would end a club that still existed and email its owner.
  for (const id of orgIds) {
    for (const [table, column] of [['billing_retention_intents', 'org_id'], ['billing_retained_records', 'org_id'], ['tournaments', 'org_id'], ['organization_members', 'organization_id']]) {
      await rows(`${table} ${id}`, db.from(table).delete().eq(column, id));
    }
    await rows(`club ${id}`, db.from('organizations').delete().eq('id', id));
  }
  lines.push(`removed ${orgIds.length} rehearsal club(s) (sign-ins kept)`);
  const deletedAt = new Date();
  for (const id of clockIds) await stripe.testHelpers.testClocks.del(id);
  lines.push(`deleted ${clockIds.length} test clock(s) and their ${customers.length} customer(s)`);
  if (customers.length) {
    await sleep(45_000);
    const late = await rows('ledger after delete', db.from('stripe_billing_events').select('type')
      .in('customer_id', customers).gte('received_at', deletedAt.toISOString()));
    lines.push(late.length
      ? `deleting the clocks sent ${late.length} message(s) to the dev site afterwards: ${[...new Set(late.map(r => r.type))].join(', ')}`
      : 'deleting the clocks sent no message to the dev site within 45 seconds');
  }
  return lines;
}

if (RESET) {
  for (const l of await reset(wanted)) log(`  ✓ ${l}`);
  process.exit(0);
}

// ── Preflight ───────────────────────────────────────────────────────────────────────────────────────────────────
// What the expectations read from: the ending, the move, the webhook and its log, retention, the emails, the portal settings.
const PLAN_ENDING_PATHS = ['lib/plan-ending.ts', 'lib/plan-ending-server.ts', 'lib/plan-ending-store.ts', 'lib/plan-ending-emails.ts',
  'lib/plan-move.ts', 'lib/stripe-billing-events.ts', 'lib/stripe-billing-state.ts', 'lib/billing-retention.ts', 'lib/billing-cancellation-policy.ts',
  'lib/email.ts', 'lib/email-log.ts', 'lib/platform-email-templates.ts', 'lib/stripe-portal-settings.ts', 'lib/stripe-portal-config.ts',
  'app/api/billing', 'app/api/platform-admin/orgs'];

function buildCheck() {
  if (SITE !== DEV_SITE) return 'a local site: compare it with this checkout yourself';
  // No shell (Windows' cmd would eat the query's quotes); without .env.local's AWS_PROFILE, which names the bookkeeping
  // profile (no Amplify access) — the machine's own default sign-in reads the builds. Newest first: the first SUCCEED runs.
  const jobs = spawnSync('aws', ['amplify', 'list-jobs', '--app-id', 'd3ld0l2bgmmlga', '--branch-name', 'dev', '--max-items', '10',
    '--query', "jobSummaries[?status=='SUCCEED'].commitId", '--output', 'text'],
  { encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'AWS_PROFILE')) });
  const commit = jobs.status === 0 ? jobs.stdout.trim().split(/\s+/)[0] : '';
  if (!/^[0-9a-f]{40}$/.test(commit)) return { error: 'could not read the dev site\'s last successful build (aws cli)' };
  // Against the working copy, not HEAD: an uncommitted edit to the plan-ending code is not on the dev site either.
  const diff = spawnSync('git', ['diff', '--quiet', commit, '--', ...PLAN_ENDING_PATHS]);
  if (diff.status === 1) return { error: `the dev site runs ${commit.slice(0, 9)}, whose plan-ending code differs from this checkout` };
  if (diff.status !== 0) return { error: `could not compare ${commit.slice(0, 9)} with this checkout` };
  return `the dev site runs ${commit.slice(0, 9)}; its plan-ending code equals this checkout`;
}

const startedAt = new Date();
const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = join('.probe', 'plan-ending-rehearsal', stamp);
const run = { startedAt: startedAt.toISOString(), site: SITE, preflight: [], portal: null, cases: [], cleanup: null };
function save() {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'results.json'), JSON.stringify(run, null, 2));
  writeFileSync(join(outDir, 'report.md'), renderReport(run));
}

log(`Plans end at renewal · Stage 3 rehearsal → ${SITE}`);
const runIds = [...(wanted ?? CASES.map(c => c.id)), '0'];
const clash = (await rehearsalOrgs()).filter(o => runIds.some(id => o.name === clubName(id)));
if (clash.length) {
  console.error(`Rehearsal clubs for these cases already exist in dev: ${clash.map(o => o.name).join(', ')}. Run --reset${wanted ? ` --case ${wanted.join(',')}` : ''} first (they may be a --keep for the walk).`);
  process.exit(1);
}

const build = buildCheck();
if (typeof build !== 'string') {
  if (!flag('--skip-build-check')) { console.error(`Refusing: ${build.error}. A stale dev site makes every result meaningless (--skip-build-check to run anyway).`); process.exit(1); }
  run.preflight.push(`build check skipped: ${build.error}`);
} else run.preflight.push(build);

const endpoint = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find(e => e.url === `${SITE}/api/billing/webhook` && e.status === 'enabled');
if (!endpoint && SITE === DEV_SITE) { console.error(`Refusing: Stripe test mode has no enabled webhook to ${SITE}/api/billing/webhook.`); process.exit(1); }
run.preflight.push(endpoint ? `Stripe test webhook ${endpoint.id} → ${endpoint.url}` : 'no Stripe webhook endpoint for this site (a local `stripe listen` must forward)');

const priceRows = await rows('prices', db.from('stripe_prices').select('plan_id, billing_cycle, price_id').eq('environment', 'sandbox'));
const priceOf = (plan, cycle) => {
  const row = priceRows.find(r => r.plan_id === plan && r.billing_cycle === cycle);
  if (!row) throw new Error(`no sandbox ${cycle} price for ${plan}`);
  return row.price_id;
};
const planOfPrice = Object.fromEntries(priceRows.map(r => [r.price_id, r.plan_id]));
const priceCents = Object.fromEntries(await Promise.all(['tournament_plus', 'club', 'club_large']
  .map(async plan => [plan, (await stripe.prices.retrieve(priceOf(plan, 'monthly'))).unit_amount])));
for (const l of run.preflight) log(`  · ${l}`);

// ── The site's own routes, signed in without a browser ──────────────────────────────────────────────────────────
const cookieFor = (email, password) => signInCookie({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, email, password,
});
let operatorCookie = null;
async function operator() {
  operatorCookie ??= await cookieFor(process.env.UAT_PLATFORM_ADMIN_EMAIL, process.env.UAT_PLATFORM_ADMIN_PASSWORD);
  return operatorCookie;
}
/** POST to the site; a refusal (any non-2xx) throws, naming the step. */
async function post(cookie, path, body, label) {
  const res = await fetch(`${SITE}${path}`, {
    method: 'POST', headers: { Cookie: cookie, Origin: SITE, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (res.status < 200 || res.status >= 300) throw new Error(`${label}: HTTP ${res.status} ${json?.error ?? text.slice(0, 300)}`);
  return `${res.status} ${json?.outcome ?? 'ok'}`;
}

// ── One club on its own clock ───────────────────────────────────────────────────────────────────────────────────
async function insertTournament(orgId, name, { status = 'active', month = 6, createdAt } = {}) {
  const year = new Date().getUTCFullYear() + 1;
  const start = `${year}-${String(month).padStart(2, '0')}`;
  return (await rows(`tournament ${name}`, db.from('tournaments').insert({
    org_id: orgId, year, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), status, is_active: status === 'active',
    start_date: `${start}-01`, end_date: `${start}-03`, sport: 'baseball', list_in_directory: false,
    ...(createdAt ? { created_at: createdAt } : {}),
  }).select('id').single())).id;
}

async function makeClub(id, setup, { subscribe = true } = {}) {
  const email = INBOX.replace('@', `+pr${id}@`);
  const name = clubName(id);
  const slug = `rehearsal-${id}-${stamp.slice(5, 16).replace(/[^0-9]/g, '')}`.toLowerCase();
  const { user } = await ensureUser(db, { email, password: PASSWORD, fullName: `Rehearsal ${id} Owner` });
  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: toUnix(Date.now()), name: `${clockPrefix(id)}${stamp}` });
  const customer = await stripe.customers.create({
    email, name, test_clock: clock.id, payment_method: 'pm_card_visa',
    invoice_settings: { default_payment_method: 'pm_card_visa' }, metadata: { rehearsal: MARKER, case: id },
  });
  // The club is tied to the customer BEFORE the subscription exists, so every Stripe message about it finds the club.
  const org = await rows(`club ${name}`, db.from('organizations').insert({
    name, slug, plan_id: setup.plan, subscription_status: setup.trialDays ? 'trialing' : 'active', account_kind: 'organization',
    is_public: false, is_discoverable: false, theme_preset: 'platform', internal_notes: MARKER,
    tournament_limit: 9999, team_limit: 9999, onboarding_completed_at: iso(Date.now()),
    stripe_customer_id: customer.id, subscription_period: setup.cycle,
  }).select('id').single());
  await rows(`owner ${name}`, db.from('organization_members').insert({
    organization_id: org.id, user_id: user.id, role: 'owner', status: 'active', display_name: `${name} Owner`,
    invited_at: iso(Date.now()), accepted_at: iso(Date.now()),
  }));
  const tournamentIds = {};
  for (const [i, [tName, status]] of (setup.tournaments ?? []).entries()) {
    // Made in the order given, a day apart: "the newest" (the date's fallback) is the last in the list.
    tournamentIds[tName] = await insertTournament(org.id, tName, { status, createdAt: iso(Date.now() - (60 - i) * DAY) });
  }
  const club = { id, email, name, slug, orgId: org.id, clockId: clock.id, customerId: customer.id, tournamentIds,
    startMs: clock.frozen_time * 1000, subId: null, setup: null, cookie: await cookieFor(email, PASSWORD) };
  if (!subscribe) return club;

  const sub = await stripe.subscriptions.create({
    customer: customer.id, items: [{ price: priceOf(setup.plan, setup.cycle) }], metadata: { rehearsal: MARKER, case: id },
    ...(setup.trialDays ? { trial_period_days: setup.trialDays } : {}),
  });
  const item = sub.items.data[0];
  await rows('tie the subscription', db.from('organizations').update({
    stripe_subscription_id: sub.id, current_period_end: fromUnix(item.current_period_end), subscription_status: sub.status,
    subscription_amount_cents: item.price.unit_amount, subscription_currency: item.price.currency,
  }).eq('id', org.id));
  club.subId = sub.id;
  club.setup = { periodEnd: fromUnix(item.current_period_end), trialEnd: fromUnix(sub.trial_end), priceCents };
  // Settle: the dev site must have run Stripe's "subscription created" for this customer, or messages are not reaching it.
  // …and its first invoice (a $0 one for a trial), so that charge sits in the start window, never in the case's own.
  const settled = await until(async () => {
    const rows = await ledger(club);
    return ['customer.subscription.created', 'invoice.payment_succeeded'].every(type => rows.some(r => r.type === type && r.processed));
  }, 150_000);
  if (!settled) throw new Error('the dev site never ran Stripe\'s "subscription created" for this club (are Stripe\'s messages reaching it?)');
  return club;
}

// ── What is true now ────────────────────────────────────────────────────────────────────────────────────────────
async function ledger(club) {
  const data = await rows('ledger', db.from('stripe_billing_events').select('id, type, processed_at, ignored_reason, error, attempts, received_at')
    .eq('customer_id', club.customerId).order('received_at'));
  return data.map(r => ({ id: r.id, type: r.type, processed: !!r.processed_at, ignored: r.ignored_reason, error: r.error, attempts: r.attempts, receivedAt: r.received_at }));
}

/** Every Stripe event for this club's customer since its case began, oldest first. */
async function stripeEventsFor(club) {
  const all = [];
  for await (const e of stripe.events.list({ created: { gte: toUnix(club.startMs) - 120 }, limit: 100 })) {
    const o = e.data.object;
    const customer = typeof o.customer === 'string' ? o.customer : o.customer?.id ?? (o.object === 'customer' ? o.id : null);
    if (customer === club.customerId) all.push(e);
  }
  // Newest first from Stripe; reversed keeps Stripe's own order within the same second.
  return all.reverse().sort((a, b) => a.created - b.created);
}

const PICK = ['intent_type', 'status', 'effective_at', 'retention_until', 'applied_at', 'held_move_plan', 'reason', 'target_plan',
  'ends_on_email_sent_at', 'reminder_email_sent_at', 'kept_email_sent_at', 'ended_email_sent_at', 'stripe_subscription_id', 'notify_owner'];
const tally = (list, key) => list.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] ?? 0) + 1 }), {});

/**
 * The state under a snapshot name. Some fields no expectation reads (the record's flags, Stripe's cancel_at and open
 * invoices, the row's log) are kept as evidence for results.json. `light` (a wait's poll) skips the two heavy reads no wait
 * reads — Stripe's event list and the invoices — and a wait that arrives takes the full snapshot once.
 */
async function observe(club, name, ctx, { light = false } = {}) {
  const [org, intentRows, retainedRows, eventRows, emailRows, tournamentRows, ledgerRows, sub, invoices, seen] = await Promise.all([
    rows('club', db.from('organizations')
      .select('plan_id, subscription_status, billing_suspended_at, current_period_end, stripe_subscription_id, is_public, tournament_limit')
      .eq('id', club.orgId).single()),
    rows('intents', db.from('billing_retention_intents').select('*').eq('org_id', club.orgId).order('created_at')),
    rows('retained', db.from('billing_retained_records').select('record_type').eq('org_id', club.orgId)),
    rows('platform events', db.from('platform_events').select('event_type').eq('org_id', club.orgId).in('event_type', ['subscription_canceled', 'plan_downgraded'])),
    // Only emails that went (or may have): a row is written BEFORE the send, then marked failed / not_sent when it did not.
    rows('emails', db.from('platform_account_emails').select('kind').eq('recipient_email', club.email).gte('created_at', iso(club.startMs - 60_000))
      .not('state', 'in', '(failed,not_sent)')),
    rows('tournaments', db.from('tournaments').select('name, status').eq('org_id', club.orgId)),
    ledger(club),
    club.subId ? stripe.subscriptions.retrieve(club.subId) : null,
    club.subId && !light ? (async () => { const list = []; for await (const i of stripe.invoices.list({ subscription: club.subId, limit: 100 })) list.push(i); return list; })() : null,
    light ? null : stripeEventsFor(club),
  ]);

  const newest = intentRows.at(-1) ?? null;
  let stripeState = null;
  if (sub) {
    const item = sub.items.data[0];
    const paid = (invoices ?? []).filter(i => i.status === 'paid').sort((a, b) => b.created - a.created);
    stripeState = {
      status: sub.status, cancel_at_period_end: sub.cancel_at_period_end, cancel_at: fromUnix(sub.cancel_at), ended_at: fromUnix(sub.ended_at),
      schedule: typeof sub.schedule === 'string' ? sub.schedule : sub.schedule?.id ?? null, plan: planOfPrice[item?.price?.id] ?? item?.price?.id ?? null,
      current_period_end: fromUnix(item?.current_period_end),
      ...(invoices ? { paid_cents: paid.reduce((n, i) => n + i.amount_paid, 0), last_paid_cents: paid[0]?.amount_paid ?? null,
        open_invoices: invoices.filter(i => i.status === 'open').length } : {}),
    };
  }
  // The window: events not yet given to an earlier name (a re-take of the same name keeps adding to its own window).
  if (seen) {
    for (const e of seen) if (!ctx.eventOwner.has(e.id)) ctx.eventOwner.set(e.id, name);
    ctx.lastEvents = seen;
  }
  return {
    org,
    intent: newest ? { ...Object.fromEntries(PICK.map(k => [k, newest[k]])), door: newest.change_log?.[0]?.door ?? null,
      log: (newest.change_log ?? []).map(e => `${e.action}:${e.door ?? ''}`) } : null,
    intents: {
      total: intentRows.length, pending: intentRows.filter(r => r.status === 'pending').length,
      applied: intentRows.filter(r => r.status === 'applied').length,
      cancel: intentRows.filter(r => r.intent_type === 'cancellation').length, downgrade: intentRows.filter(r => r.intent_type === 'downgrade').length,
    },
    retained: tally(retainedRows, 'record_type'), events: tally(eventRows, 'event_type'), emails: tally(emailRows, 'kind'),
    tournaments: Object.fromEntries(tournamentRows.map(t => [t.name, t.status])),
    stripe: stripeState,
    ...(seen ? { stripeEvents: seen.filter(e => ctx.eventOwner.get(e.id) === name).map(e => e.type) } : {}),
    ledger: ledgerRows, ledgerTypes: ledgerRows.map(r => r.type),
  };
}

// ── Steps ───────────────────────────────────────────────────────────────────────────────────────────────────────
const ownerPost = (club, path, body, label) => post(club.cookie, path, { orgSlug: club.slug, ...body }, label);

async function advance(club, step, settle) {
  let base;
  if (step.to === 'start') base = club.startMs;
  else {
    const sub = await stripe.subscriptions.retrieve(club.subId);
    base = step.to === 'trialEnd' ? sub.trial_end * 1000 : sub.items.data[0].current_period_end * 1000;
  }
  const target = toUnix(base + (step.days ?? 0) * DAY + (step.hours ?? 0) * 3_600_000);
  const clock = await stripe.testHelpers.testClocks.retrieve(club.clockId);
  if (target <= clock.frozen_time) throw new Error(`advance: ${iso(target * 1000)} is not after the clock (${iso(clock.frozen_time * 1000)})`);
  await stripe.testHelpers.testClocks.advance(club.clockId, { frozen_time: target });
  const ready = await until(async () => {
    const c = await stripe.testHelpers.testClocks.retrieve(club.clockId);
    if (c.status === 'internal_failure') throw new Error('advance: Stripe reports internal_failure on the clock');
    return c.status === 'ready';
  }, 300_000, 3000);
  if (!ready) throw new Error('advance: the clock did not finish within five minutes');
  // A wait that follows polls for Stripe's messages itself; a snapshot right after an advance gives them time to land.
  if (settle) await sleep(30_000);
  return `clock at ${iso(target * 1000)}`;
}

async function runStep(club, step, next, ctx) {
  switch (step.do) {
    case 'ownerCancel': return ownerPost(club, '/api/billing/cancel/confirm', { reason: 'Rehearsal' }, 'owner cancel');
    case 'ownerKeep': return ownerPost(club, '/api/billing/cancel/keep', {}, 'owner keep');
    case 'ownerDowngrade':
      return ownerPost(club, '/api/billing/downgrade/confirm',
        { targetPlan: 'tournament', keepTournamentIds: step.keep.map(n => club.tournamentIds[n]), reason: 'Rehearsal' }, 'owner downgrade');
    case 'ownerMove': return ownerPost(club, '/api/billing/move', { planKey: step.plan }, 'owner move');
    case 'operatorEndNow':
      return post(await operator(), `/api/platform-admin/orgs/${club.orgId}/cancel-subscription`,
        { endNow: true, reason: step.reason, notifyOwner: true }, 'operator End now');
    case 'stripeFlag':
      await stripe.subscriptions.update(club.subId, { cancel_at_period_end: step.on });
      return `cancel_at_period_end ${step.on} (Stripe API)`;
    case 'rawFlagOnScheduled': {
      try {
        await stripe.subscriptions.update(club.subId, { cancel_at_period_end: true });
      } catch (error) {
        const refused = /managed by the subscription schedule/i.test(error.message);
        ctx.notes.rawFlag = { refused, message: error.message };
        if (!refused) throw new Error(`raw flag: Stripe failed for another reason: ${error.message}`);
        return `Stripe refused: ${error.message}`;
      }
      ctx.notes.rawFlag = { refused: false };
      await stripe.subscriptions.update(club.subId, { cancel_at_period_end: false });
      return 'Stripe ACCEPTED the flag on a scheduled subscription (put back at once)';
    }
    case 'failingCard': {
      const pm = await stripe.paymentMethods.attach('pm_card_chargeCustomerFail', { customer: club.customerId });
      await stripe.customers.update(club.customerId, { invoice_settings: { default_payment_method: pm.id } });
      return 'the default card now declines (pm_card_chargeCustomerFail)';
    }
    case 'createTournament':
      club.tournamentIds[step.name] = await insertTournament(club.orgId, step.name, { month: 7 });
      return `${step.name} written into the record (active)`;
    case 'touchMetadata': {
      const began = new Date().toISOString();
      for (let i = 1; i <= step.times; i++) {
        await stripe.subscriptions.update(club.subId, { metadata: { rehearsal_touch: String(i) } });
        await sleep(1500);
      }
      // Only updates that ARRIVED after the touches began (the cancel's own late echo is not one of them).
      const ran = await until(async () => (await ledger(club))
        .filter(r => r.type === 'customer.subscription.updated' && r.processed && r.receivedAt >= began).length >= step.times, 120_000);
      if (!ran) ctx.timedOut.push(`${step.times} "subscription updated" messages run by the dev site`);
      return `${step.times} metadata-only updates`;
    }
    case 'advance': return advance(club, step, next?.do !== 'wait');
    case 'wait': {
      const names = [...new Set(step.until.map(e => e.path.split('.')[0]))];
      let missing = [];
      const ok = await until(async () => {
        for (const n of names) ctx.observed[n] = await observe(club, n, ctx, { light: true });
        missing = notYet(step.until, view(club, ctx));
        return missing.length === 0;
      }, 240_000);
      for (const n of names) ctx.observed[n] = await observe(club, n, ctx);
      if (!ok) ctx.timedOut.push(...missing);
      return ok ? 'arrived' : `timed out: ${missing.join('; ')}`;
    }
    case 'snapshot':
      ctx.observed[step.as] = await observe(club, step.as, ctx);
      return 'recorded';
    case 'resendEvent': {
      const row = (await ledger(club)).find(r => r.type === step.type);
      if (!row) throw new Error(`resend: no ${step.type} reached the dev site`);
      if (!endpoint) throw new Error('resend: Stripe has no webhook endpoint for this site');
      const res = spawnSync('stripe', ['events', 'resend', row.id, `--webhook-endpoint=${endpoint.id}`], {
        encoding: 'utf8', env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY },
      });
      await sleep(30_000);
      const after = (await ledger(club)).find(r => r.id === row.id);
      ctx.notes.resend = { eventId: row.id, sent: res.status === 0, attemptsBefore: row.attempts, attemptsAfter: after?.attempts ?? null };
      return res.status === 0 ? `re-sent ${row.id}` : `CLI failed: ${(res.stderr || res.stdout || '').trim().slice(0, 200)}`;
    }
    case 'signedReplay': {
      const row = (await ledger(club)).find(r => r.type === step.type);
      if (!row) throw new Error(`replay: no ${step.type} reached the dev site`);
      const event = await stripe.events.retrieve(row.id);
      const id = `evt_rehearsal_${randomBytes(8).toString('hex')}`;
      const payload = JSON.stringify({ ...event, id });
      const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
      const res = await fetch(`${SITE}/api/billing/webhook`, { method: 'POST', headers: { 'stripe-signature': header, 'Content-Type': 'application/json' }, body: payload });
      const text = (await res.text()).slice(0, 200);
      ctx.notes.replay = { eventId: id, copyOf: row.id, status: res.status, answer: text };
      if (res.status === 400) {
        ctx.notes.replay.cut = 'the webhook secret this checkout holds does not match the dev site (signature refused)';
        return 'cut: signature refused';
      }
      ctx.notes.replay.ledgerProcessed = await until(async () => (await rows('replay row', db.from('stripe_billing_events')
        .select('processed_at').eq('id', id))).some(r => r.processed_at), 60_000);
      return `HTTP ${res.status} ${text}`;
    }
    default: throw new Error(`unknown step ${step.do}`);
  }
}

function view(club, ctx) {
  return { ...ctx.observed, setup: club.setup, notes: ctx.notes };
}

// ── Case 0 · the portal (G13 a) ─────────────────────────────────────────────────────────────────────────────────
log('\n0 · Portal settings (G13 a)');
let portalChecks = await auditPortal(stripe);
if (portalGate(portalChecks).missing) {
  // Ours does not exist in test mode yet: the app's own route creates it (lib/stripe-portal-config.ts), never this script.
  const club = await makeClub('0', { plan: 'tournament_plus', cycle: 'monthly' }, { subscribe: false });
  const opened = await post(club.cookie, '/api/billing/portal', { orgSlug: club.slug }, 'open the portal').catch(error => error.message);
  run.preflight.push(`portal opened once through the dev site to create our configuration: ${opened}`);
  portalChecks = await auditPortal(stripe);
}
const gate = portalGate(portalChecks);
run.portal = { ok: gate.ok, checks: portalChecks };
for (const c of portalChecks) log(`  ${c.status} ${c.key}: ${c.detail}`);
save();
if (!gate.ok) { console.error('\nThe portal settings are wrong (or missing): the rehearsal stops here (G13).'); process.exit(1); }

// ── The cases, one at a time; a failure or surprise is reported and the run goes on to the next ──────────────────
for (const c of CASES.filter(x => !wanted || wanted.includes(x.id))) {
  log(`\n${c.id} · ${c.title}`);
  const ctx = { observed: {}, notes: {}, timedOut: [], eventOwner: new Map(), lastEvents: [] };
  const result = { id: c.id, title: c.title, steps: [], verdict: null };
  let stepError = null;
  let club = null;
  try {
    club = await makeClub(c.id, c.setup);
    result.club = { name: club.name, slug: club.slug, email: club.email, orgId: club.orgId, clockId: club.clockId, customerId: club.customerId, subId: club.subId };
    ctx.observed.start = await observe(club, 'start', ctx);
    for (const [i, step] of c.steps.entries()) {
      const outcome = await runStep(club, step, c.steps[i + 1], ctx);
      result.steps.push({ label: stepLabel(step), result: outcome });
      log(`  · ${stepLabel(step)} → ${outcome}`);
    }
    // A message still mid-run would read as "unfinished": give it up to half a minute to finish first.
    await until(async () => (await ledger(club)).every(r => r.processed || r.ignored || r.error), 30_000, 3000);
    ctx.observed.end = await observe(club, 'end', ctx);
  } catch (error) {
    stepError = error.message;
    log(`  ✗ ${stepError}`);
    if (club) { try { ctx.observed.end = await observe(club, 'end', ctx); } catch { /* the evidence we have */ } }
  }
  // Half of case 11 is cut when the dev site refuses our signature: its checks are dropped and the report says why.
  const cut = ctx.notes.replay?.cut;
  const expect = cut ? c.expect.filter(e => e.half !== 'b') : c.expect;
  const verdict = classify({ expectations: expect, observed: club ? view(club, ctx) : {}, timedOut: ctx.timedOut, stepErrors: stepError ? [stepError] : [] });
  Object.assign(result, verdict, {
    cutNote: cut ? `half (b) cut: ${cut}` : null, reasons: verdict.reasons, notes: ctx.notes,
    stripeEvents: ctx.lastEvents.map(e => e.type), observed: ctx.observed, setup: club?.setup ?? null,
  });
  run.cases.push(result);
  save();
  log(`  → ${result.verdict}${result.reasons.length ? `\n    ${result.reasons.join('\n    ')}` : ''}`);
}

if (!flag('--keep')) {
  log('\nCleaning up (our rows first, then the clocks)');
  run.cleanup = await reset(wanted ? [...wanted, '0'] : null);
  for (const l of run.cleanup) log(`  ✓ ${l}`);
} else {
  const by = iso(Date.now() + 21 * DAY).slice(0, 10);
  run.cleanup = [`--keep: the clubs stay in dev for the owner walk. Run --reset by ${by} (Stripe deletes a test clock 30 days after it was made).`];
  log(`\n${run.cleanup[0]}`);
}
save();
log(`\nEvidence: ${join(outDir, 'report.md')}`);
