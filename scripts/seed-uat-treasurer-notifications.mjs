/**
 * seed-uat-treasurer-notifications.mjs  (DEV ONLY)
 *
 * The UAT Rep Club treasurer's (uat-club-treasurer@uat-rep-club.local) notifications for the Notifications
 * Open in Place step-3 walk (2026-10-06, OQA §272) — the admin's Notifications page opens a notification
 * instead of loading a page.
 *
 * ⚠ IT SEEDS ALL THREE, NOT ONE. Its first cut seeded one fresh notice and leaned on the treasurer's two real,
 * older ones; a rebuild of the UAT Rep Club fixture that same afternoon (a new org row, so every notification
 * and request under the old one went with it) left the walk with an empty page. Everything the walk names is
 * now seeded here, from the club's own records, so re-running this after any rebuild restores the walk.
 *
 * What it seeds — the three notices a treasurer receives (all three wait in Needs attention; nothing else
 * reaches this account, so an Activity row would be fiction), each built with the product's own words
 * (`CLUB_MONEY_NOTICE` in lib/club-money-words.ts) and link, against a real record:
 *   · team_request_filed, UNREAD, 20 minutes ago — the club's newest WAITING payment request, linked with
 *     `?request=` ("Open the request"). The walk opens it, goes to it, marks it Done and deletes it.
 *   · team_request_holding_payout, read, yesterday — another team's waiting request (15U AAA's when it has
 *     one), linked to that one request when it is the team's only one, as the sender does since step 1.
 *   · team_money_sent, read, yesterday — a payment a team marked sent that the club has not confirmed
 *     (`sent_at` set, `paid_at` empty), linked to its bill ("Open the bill").
 * A missing record (no second waiting team, nothing sent) skips that notice and says so.
 *
 * Idempotent: tagged metadata.seed = 'nop3-walk' and deletes its own prior rows first (anything else the
 * treasurer has is never touched). Re-run = reset.
 * Remove:  delete from notifications where metadata->>'seed' = 'nop3-walk'
 * Run:     node scripts/seed-uat-treasurer-notifications.mjs
 * Siblings: scripts/seed-uat-coach-notifications.mjs (the coach's), seed-botb-test-notifications.mjs.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const url = get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !key) {
  console.error('✗ Missing env. Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}
// The production refusal — the coach fixture's, for its reason (a lookup that happens to fail is not a guard).
if (/\.supabase\.co/.test(url) && url.includes('qcttcboqysynwcdyghil')) {
  console.error('✗ Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const SEED = 'nop3-walk';
const EMAIL = 'uat-club-treasurer@uat-rep-club.local';

const { data: org, error: orgErr } = await sb.from('organizations').select('id, slug').eq('slug', 'uat-rep-club').single();
if (orgErr) throw orgErr;
const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
const treasurer = users.users.find(u => (u.email || '').toLowerCase() === EMAIL);
if (!treasurer) throw new Error(`no ${EMAIL}`);
const { data: teams, error: teamErr } = await sb.from('rep_teams').select('id, name').eq('org_id', org.id);
if (teamErr) throw teamErr;
const teamName = id => teams.find(t => t.id === id)?.name ?? 'A team';

// The product's own words, from the product's own builders — never a hand-kept copy that drifts when a notice
// changes. The repo's test resolver (registered here, so the run line stays plain `node`) lets Node load the
// app's TypeScript with its extensionless relative imports.
await import('../tests/ts-resolver.mjs');
const { CLUB_MONEY_NOTICE, howItCame } = await import('../lib/club-money-words.ts');
const requestsLink = id => `/${org.slug}/admin/accounting/payment-requests${id ? `?request=${id}` : ''}`;

const { data: waiting, error: reqErr } = await sb.from('rep_team_payment_requests')
  .select('id, team_id, amount, description, request_type')
  .eq('org_id', org.id).eq('status', 'pending')
  .order('created_at', { ascending: false });
if (reqErr) throw reqErr;
if (!waiting?.length) throw new Error('UAT Rep Club has no waiting payment request to point a notice at');

const M = 60_000, H = 60 * M;
const ago = ms => new Date(Date.now() - ms).toISOString();
const rows = [];

// 1 · The fresh one — the newest waiting request.
const fresh = waiting[0];
rows.push({
  event_type: 'team_request_filed',
  ...CLUB_MONEY_NOTICE.newRequest({
    teamName: teamName(fresh.team_id), amount: Number(fresh.amount), what: fresh.description,
    toClub: fresh.request_type === 'payment_to_org',
  }),
  link: requestsLink(fresh.id),
  created_at: ago(20 * M), read_at: null,
  metadata: { seed: SEED, requestId: fresh.id },
});

// 2 · A request holding up another team's payout (15U AAA's when it has one waiting).
const others = waiting.filter(r => r.team_id !== fresh.team_id);
const holder = others.find(r => teamName(r.team_id) === '15U AAA') ?? others[0];
if (holder) {
  const held = waiting.filter(r => r.team_id === holder.team_id);
  rows.push({
    event_type: 'team_request_holding_payout',
    ...CLUB_MONEY_NOTICE.holdingPayout({ teamName: teamName(holder.team_id), count: held.length }),
    // One request holding it → the notice opens that request; the list only when several are (D4).
    link: requestsLink(held.length === 1 ? held[0].id : undefined),
    created_at: ago(26 * H), read_at: ago(25 * H),
    metadata: { seed: SEED, teamId: holder.team_id, requestIds: held.map(r => r.id) },
  });
} else console.log('  (skipped the holding-up notice: no second team has a waiting request)');

// 3 · A payment a team marked sent that the club has not confirmed.
const { data: sent, error: sentErr } = await sb.from('rep_allocation_installments')
  .select('id, split_id, amount, installment_number, sent_on, sent_method, sent_reference, rep_allocation_splits ( team_id, allocation_id, rep_cost_allocations ( description ) )')
  .eq('org_id', org.id).not('sent_at', 'is', null).is('paid_at', null)
  .order('sent_at', { ascending: false }).limit(1).maybeSingle();
if (sentErr) throw sentErr;
if (sent) {
  const split = sent.rep_allocation_splits;
  const { count } = await sb.from('rep_allocation_installments').select('id', { count: 'exact', head: true }).eq('split_id', sent.split_id);
  // `whatInstallment` in lib/club-money-moves.ts (a server module, so not importable here): "Diamond fees 2026, 1 of 3".
  const what = `${split.rep_cost_allocations?.description ?? 'A bill'}${(count ?? 0) > 1 ? `, ${sent.installment_number} of ${count}` : ''}`;
  rows.push({
    event_type: 'team_money_sent',
    ...CLUB_MONEY_NOTICE.sent({
      teamName: teamName(split.team_id), amount: Number(sent.amount), what, sentOn: sent.sent_on,
      how: howItCame(sent.sent_method, sent.sent_reference),
    }),
    link: `/${org.slug}/admin/accounting/allocations/${split.allocation_id}?bill=${sent.split_id}`,
    created_at: ago(30 * H), read_at: ago(29 * H),
    metadata: { seed: SEED, installmentId: sent.id, splitId: sent.split_id },
  });
} else console.log('  (skipped the "says they sent" notice: no payment is waiting for the club to confirm)');

await sb.from('notifications').delete().eq('user_id', treasurer.id).eq('org_id', org.id).contains('metadata', { seed: SEED });
const { error: insErr } = await sb.from('notifications').insert(rows.map(r => ({ ...r, user_id: treasurer.id, org_id: org.id })));
if (insErr) throw insErr;

console.log('\n=== UAT TREASURER NOTIFICATIONS SEEDED (Notifications Open in Place step 3, OQA §272) ===');
for (const r of rows) console.log(`  ${r.read_at ? 'read  ' : 'UNREAD'} ${r.event_type.padEnd(28)} ${r.title}\n         ${r.body}\n         → ${r.link}`);
console.log(`\nSign in as ${EMAIL}, then More › Notifications on a phone (or /${org.slug}/admin/notifications).`);
console.log('Re-run this script any time to reset the walk.');
