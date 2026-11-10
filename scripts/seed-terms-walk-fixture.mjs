#!/usr/bin/env node
/**
 * THE TERMS-ACCEPTANCE OWNER WALK FIXTURE (GST/HST Stage 6 step 6.3 — the one walk of Chunks A–C). Dev Supabase + Stripe TEST only.
 *
 * Acceptance rows are APPEND-ONLY (migration 455), so an account that has agreed can never be made "never agreed" again. The
 * walk therefore uses FRESH accounts (made here, through the shared fixture creator) and moves existing ones with a DATED row
 * ("agreed an earlier version" — in the dev preview the current version is the word `draft`, and a date never satisfies it):
 *
 *   walk-never@walk-terms.local    never agreed. Admin of uat-rep-club, volunteer (official) of uat-plus-org, so one sign-in
 *                                  reaches the family app, the club admin, both Coaches Portal shells, the scorekeeper and check-in.
 *   walk-earlier@walk-terms.local  agreed an earlier version (2026-01-01): "We've updated our Terms". Same places.
 *   walk-buyer@walk-terms.local    agreed (draft), owns nothing: makes a tournament organization during the walk.
 *   walk-buyer2@walk-terms.local   the same, for the second organization (a person with an organization is sent away from /start/tournament).
 *   uat-owner@uat-test-org.local   the standing owner of UAT Test Org (Tournament Plus on a live test subscription — the "paid
 *                                  owner"). Not created here: `unagree` / `agree` move its standing, `teardown` puts it back.
 *
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs setup
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs status
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs unagree <email>   (a dated row + mirror: the Terms "changed" for them)
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs agree <email>     (records the current version, as a tick would)
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs freeplan <org-slug>   (puts an organization a walk account owns back on the free Tournament plan)
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs switch on|off     (LEGAL_PAGES_PREVIEW in .env.local; restart the dev server)
 *   node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs teardown          (deletes the walk's accounts and the organizations
 *                                                                                   they made; puts the standing owner back to agreed)
 *
 * The acceptance ROWS cannot be deleted (append-only). Deleting an account clears the row's link to it (the email stays as
 * text) — that is the record's own rule, and the only residue.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { ensureFixtureUser } from './lib/fixture-user.mjs';
import { writeFixtureAcceptance } from './lib/record-legal-acceptance.mjs';
import { refusal } from './lib/billing-walk-fixture.mjs';
import { ACCEPTANCE_BOX_TEXT, TERMS_ACCEPTED_KEY } from '../lib/legal-acceptance-rules.ts';

const PASSWORD = 'UATPassword2026!';
const EARLIER = '2026-01-01';
const NEVER = 'walk-never@walk-terms.local';
const EARLIER_EMAIL = 'walk-earlier@walk-terms.local';
const BUYER = 'walk-buyer@walk-terms.local';
const BUYER2 = 'walk-buyer2@walk-terms.local';
const STANDING_OWNER = 'uat-owner@uat-test-org.local';
const WALK_EMAILS = [NEVER, EARLIER_EMAIL, BUYER, BUYER2];
const MOVABLE = new Set([...WALK_EMAILS, STANDING_OWNER]);
const HL_SEASON = '2026-fall-house-league';
const PLACES = [
  { slug: 'uat-rep-club', role: 'admin' },
  { slug: 'uat-plus-org', role: 'official' },
];

const usage = 'Usage: node --env-file=.env.local scripts/seed-terms-walk-fixture.mjs setup | status | agree <email> | unagree <email> | freeplan <org-slug> | switch on|off | teardown';
const [command, arg] = process.argv.slice(2);
if (!['setup', 'status', 'agree', 'unagree', 'freeplan', 'switch', 'teardown'].includes(command ?? '')) { console.error(usage); process.exit(2); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const refused = refusal({ stripeKey: process.env.STRIPE_SECRET_KEY, supabaseUrl: url });
if (refused) { console.error(refused); process.exit(2); }
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = msg => console.log(`  ✓ ${msg}`);
const die = (what, error) => { if (error) { console.error(`  ✗ ${what}: ${error.message ?? error}`); process.exit(1); } };

async function findUser(email) {
  for (let page = 1; page <= 40; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    die('listUsers', error);
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** A dated acceptance (an "earlier version"): the row, then the mirror — the order the app's own writer uses. */
async function writeEarlier(user) {
  die(`row ${user.email}`, (await db.from('legal_acceptances').insert({
    user_id: user.id, user_email: user.email, terms_version: EARLIER, privacy_version: EARLIER, box_text: ACCEPTANCE_BOX_TEXT, door: 'fixture',
  })).error);
  die(`mirror ${user.email}`, (await db.auth.admin.updateUserById(user.id, { app_metadata: { [TERMS_ACCEPTED_KEY]: EARLIER } })).error);
}

async function state(user) {
  const mirror = user.app_metadata?.[TERMS_ACCEPTED_KEY] ?? null;
  const { data } = await db.from('legal_acceptances').select('terms_version, door, accepted_at').eq('user_id', user.id).order('accepted_at', { ascending: false }).limit(1);
  const latest = data?.[0] ?? null;
  return `mirror=${mirror ?? '—'}  latest row=${latest ? `${latest.terms_version} (${latest.door})` : 'none'}`;
}

async function member(slug, user, role) {
  const org = (await db.from('organizations').select('id').eq('slug', slug).maybeSingle()).data;
  if (!org) { console.error(`  ✗ organization ${slug} not found on dev`); process.exit(1); }
  const have = (await db.from('organization_members').select('id, role').eq('organization_id', org.id).eq('user_id', user.id).maybeSingle()).data;
  if (have) return;
  die(`member ${slug}`, (await db.from('organization_members').insert({
    organization_id: org.id, user_id: user.id, role, status: 'active', accepted_at: new Date().toISOString(),
  })).error);
}

if (command === 'setup') {
  console.log('Setting up the Terms walk accounts…');
  // env {} = "the pages are off" for the creator, so it records NOTHING: these two start unagreed on purpose.
  const never = (await ensureFixtureUser(db, { email: NEVER, password: PASSWORD, userMetadata: { full_name: 'Walk Never' }, env: {} })).user;
  const earlier = (await ensureFixtureUser(db, { email: EARLIER_EMAIL, password: PASSWORD, userMetadata: { full_name: 'Walk Earlier' }, env: {} })).user;
  const buyer = (await ensureFixtureUser(db, { email: BUYER, password: PASSWORD, userMetadata: { full_name: 'Walk Buyer' } })).user; // records `draft`
  for (const u of [never, earlier]) for (const p of PLACES) await member(p.slug, u, p.role);
  // the house-league coach team page needs a coach row on a team: Reds for the never-agreed sign-in, Blues for the other
  const season = (await db.from('league_seasons').select('id, org_id, slug').eq('slug', HL_SEASON).limit(1).maybeSingle()).data;
  if (!season) { console.error(`  ✗ house-league season ${HL_SEASON} not found on dev`); process.exit(1); }
  for (const [u, teamName] of [[never, 'Reds'], [earlier, 'Blues']]) {
    const team = (await db.from('league_teams').select('id').eq('season_id', season.id).eq('name', teamName).limit(1).maybeSingle()).data;
    if (!team) { console.error(`  ✗ team ${teamName} not found`); process.exit(1); }
    const have = (await db.from('league_team_coaches').select('id').eq('team_id', team.id).eq('user_id', u.id).maybeSingle()).data;
    if (!have) {
      die(`coach row ${teamName}`, (await db.from('league_team_coaches').insert({
        org_id: season.org_id, season_id: season.id, team_id: team.id, name: u.user_metadata?.full_name ?? u.email, email: u.email,
        user_id: u.id, accepted_at: new Date().toISOString(),
      })).error);
    }
    console.log(`  · house-league coach page for ${u.email}: /uat-rep-club/league/${HL_SEASON}/team/${team.id}`);
  }
  const fresh = await findUser(EARLIER_EMAIL);
  if ((await state(fresh)).includes('latest row=none')) await writeEarlier(fresh);
  ok(`${NEVER} — never agreed`);
  ok(`${EARLIER_EMAIL} — agreed ${EARLIER} (the Terms have changed since)`);
  await ensureFixtureUser(db, { email: BUYER2, password: PASSWORD, userMetadata: { full_name: 'Walk Buyer Two' } });
  ok(`${BUYER} and ${BUYER2} — agreed (draft); own nothing yet`);
  console.log(`  password for all four: ${PASSWORD}`);
} else if (command === 'status') {
  for (const email of [...WALK_EMAILS, STANDING_OWNER]) {
    const u = await findUser(email);
    console.log(`${email.padEnd(32)} ${u ? await state(u) : 'no such account'}`);
  }
} else if (command === 'agree' || command === 'unagree') {
  if (!arg || !MOVABLE.has(arg.toLowerCase())) { console.error(`Only these accounts: ${[...MOVABLE].join(', ')}`); process.exit(2); }
  const u = await findUser(arg);
  if (!u) { console.error(`${arg} does not exist (run setup)`); process.exit(1); }
  if (command === 'agree') await writeFixtureAcceptance(db, u); else await writeEarlier(u);
  ok(`${arg}: ${await state(await findUser(arg))}`);
} else if (command === 'freeplan') {
  if (!arg) { console.error(usage); process.exit(2); }
  const org = (await db.from('organizations').select('id, slug, plan_id').eq('slug', arg).maybeSingle()).data;
  if (!org) { console.error(`No organization ${arg}`); process.exit(1); }
  // only an organization a walk account owns — never a standing one
  const walkIds = [];
  for (const e of WALK_EMAILS) { const u = await findUser(e); if (u) walkIds.push(u.id); }
  const own = (await db.from('organization_members').select('id').eq('organization_id', org.id).eq('role', 'owner').in('user_id', walkIds).limit(1)).data;
  if (!own?.length) { console.error(`${arg} is not owned by a walk account — refusing.`); process.exit(1); }
  die('plan', (await db.from('organizations').update({ plan_id: 'tournament', subscription_status: 'active', stripe_subscription_id: null }).eq('id', org.id)).error);
  ok(`${arg} is back on the free Tournament plan`);
} else if (command === 'switch') {
  if (arg !== 'on' && arg !== 'off') { console.error(usage); process.exit(2); }
  const file = new URL('../.env.local', import.meta.url);
  const text = readFileSync(file, 'utf8');
  if (!/^LEGAL_PAGES_PREVIEW=.*$/m.test(text)) { console.error('.env.local has no LEGAL_PAGES_PREVIEW line'); process.exit(1); }
  writeFileSync(file, text.replace(/^LEGAL_PAGES_PREVIEW=.*$/m, `LEGAL_PAGES_PREVIEW=${arg === 'on' ? 'true' : 'false'}`));
  ok(`.env.local: LEGAL_PAGES_PREVIEW=${arg === 'on' ? 'true' : 'false'} — now restart the dev server (stop it, then npm run dev)`);
} else if (command === 'teardown') {
  console.log('Tearing the Terms walk down…');
  for (const email of WALK_EMAILS) {
    const u = await findUser(email);
    if (!u) { console.log(`  · ${email} — not there`); continue; }
    // organizations this account owns (made during the walk): remove them first, then the memberships, then the sign-in
    const owned = (await db.from('organization_members').select('organization_id, role').eq('user_id', u.id)).data ?? [];
    for (const m of owned) {
      const org = (await db.from('organizations').select('id, slug').eq('id', m.organization_id).maybeSingle()).data;
      if (org && !PLACES.some(p => p.slug === org.slug) && m.role === 'owner') {
        const { error } = await db.from('organizations').delete().eq('id', org.id);
        if (error) console.log(`  ! could not delete organization ${org.slug} (${error.message}) — remove it in platform admin`); else ok(`deleted organization ${org.slug}`);
      }
    }
    await db.from('league_team_coaches').delete().eq('user_id', u.id);
    await db.from('organization_members').delete().eq('user_id', u.id);
    const { error } = await db.auth.admin.deleteUser(u.id);
    if (error) console.log(`  ! ${email}: ${error.message}`); else ok(`deleted ${email}`);
  }
  const owner = await findUser(STANDING_OWNER);
  if (owner) { await writeFixtureAcceptance(db, owner); ok(`${STANDING_OWNER} put back to agreed — ${await state(await findUser(STANDING_OWNER))}`); }
  console.log('  The acceptance rows stay (append-only); their link to the deleted accounts is cleared, the email stays as text.');
}
