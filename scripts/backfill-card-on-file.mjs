#!/usr/bin/env node
/**
 * backfill-card-on-file.mjs — teach the app what Stripe already knows about existing accounts.
 *
 * Migration 283 gave every account a billing-facts row, but only the webhook writes it —
 * so every card saved BEFORE the webhook learned to record it is invisible to the Founding Season
 * desk and to the "no card yet" reminder audience. This script reads Stripe (never writes to it)
 * and stamps what it finds.
 *
 * ⚠⚠ DRY RUN IS THE DEFAULT AND THAT IS DELIBERATE. It prints exactly what it would write and
 * changes nothing. `--apply` is the only thing that writes, and against production it is run only
 * after the owner has seen a dry-run output — a card-on-file stamp decides whether somebody gets
 * chased for a card they already gave us.
 *
 * ⚠ It only ever ADDS. An account the app already records as having a card is left alone: the
 * timestamp means "on file since", and a backfill must not restate somebody's history with today's
 * date. Nothing here can clear a stamp.
 *
 * Usage:
 *   node scripts/backfill-card-on-file.mjs                 # dry run against dev
 *   node scripts/backfill-card-on-file.mjs --prod          # dry run against production
 *   node scripts/backfill-card-on-file.mjs --prod --apply  # WRITES (owner-approved runs only)
 *
 * Reads SUPABASE_ACCESS_TOKEN + STRIPE_SECRET_KEY from .env.local. The Stripe key decides which
 * Stripe environment is read, so pair `--prod` with the live key and `--dev` with the sandbox one —
 * the script prints which key mode it is using and refuses to apply on a mismatch it can detect.
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
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const PROJECT_REFS = { dev: 'npgnrxaitgbtbtvvykto', prod: 'qcttcboqysynwcdyghil' };

let target = 'dev';
let apply = false;
for (const a of process.argv.slice(2)) {
  if (a === '--prod') target = 'prod';
  else if (a === '--dev') target = 'dev';
  else if (a === '--apply') apply = true;
  else { console.error(`Unknown arg: ${a}`); process.exit(1); }
}

const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!SUPABASE_TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set in .env.local'); process.exit(1); }
if (!STRIPE_KEY) { console.error('STRIPE_SECRET_KEY not set in .env.local'); process.exit(1); }

const stripeMode = STRIPE_KEY.startsWith('sk_live_') ? 'live' : 'sandbox';
if (apply && target === 'prod' && stripeMode !== 'live') {
  console.error('Refusing to apply: --prod paired with a SANDBOX Stripe key would stamp production rows from test data.');
  process.exit(1);
}

function sql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REFS[target]}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_TOKEN}`,
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

function stripeGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.stripe.com',
      path: pathname,
      method: 'GET',
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`Stripe ${res.statusCode}: ${data}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function esc(value) {
  return String(value).replace(/'/g, "''");
}

const main = async () => {
  console.log(`\nCard-on-file backfill — target: ${target.toUpperCase()} · Stripe: ${stripeMode} · mode: ${apply ? 'APPLY (writes)' : 'DRY RUN (writes nothing)'}\n`);

  // Every account with a Stripe customer that the app does NOT yet record a card for.
  const rows = await sql(`
    select o.id, o.name, o.slug, o.account_kind, o.stripe_customer_id
      from public.organizations o
      left join public.organization_billing_facts f on f.org_id = o.id
     where o.stripe_customer_id is not null
       and f.card_on_file_at is null
     order by o.name
  `);

  if (!rows.length) {
    console.log('Nothing to look at: no account has a Stripe customer without a recorded card.\n');
    return;
  }

  console.log(`${rows.length} account(s) with a Stripe customer and no recorded card. Asking Stripe…\n`);

  const found = [];
  for (const org of rows) {
    let methods;
    try {
      methods = await stripeGet(`/v1/payment_methods?customer=${encodeURIComponent(org.stripe_customer_id)}&type=card&limit=1`);
    } catch (err) {
      console.log(`  ?  ${org.name} — Stripe lookup failed: ${err.message.slice(0, 120)}`);
      continue;
    }
    const pm = methods?.data?.[0];
    if (!pm) {
      console.log(`  ·  ${org.name} — no card in Stripe`);
      continue;
    }
    // `created` is the moment the card was attached — the honest "on file since", not today.
    const savedAt = new Date((pm.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
    found.push({ org, brand: pm.card?.brand ?? null, last4: pm.card?.last4 ?? null, savedAt });
    console.log(`  ✔  ${org.name} — ${pm.card?.brand ?? 'card'} ••${pm.card?.last4 ?? '????'} attached ${savedAt.slice(0, 10)}`);
  }

  console.log(`\n${found.length} account(s) would be stamped.\n`);
  if (found.length === 0) return;

  // Writes the account's own facts row — NEVER a column on `organizations`, which is anon-readable
  // for every public org (mig 283 header). `do update ... where card_on_file_at is null` keeps it
  // idempotent and stops a re-run restating a date somebody already has.
  const statements = found.map(f =>
    `insert into public.organization_billing_facts (org_id, card_on_file_at, card_on_file_brand, card_on_file_last4) values ('${f.org.id}', '${f.savedAt}', ${f.brand ? `'${esc(f.brand)}'` : 'null'}, ${f.last4 ? `'${esc(f.last4)}'` : 'null'}) on conflict (org_id) do update set card_on_file_at = excluded.card_on_file_at, card_on_file_brand = excluded.card_on_file_brand, card_on_file_last4 = excluded.card_on_file_last4, updated_at = now() where public.organization_billing_facts.card_on_file_at is null;`
  );

  if (!apply) {
    console.log('DRY RUN — the statements that WOULD run:\n');
    for (const s of statements) console.log('  ' + s);
    console.log('\nRe-run with --apply to write them. Against production, only after the owner has seen this output.\n');
    return;
  }

  await sql(statements.join('\n'));
  console.log(`Applied ${statements.length} update(s).\n`);
};

main().catch(err => { console.error(err); process.exit(1); });
