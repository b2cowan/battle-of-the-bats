/**
 * seed-uat-treasurer-notifications.mjs  (DEV ONLY)
 *
 * One FRESH notification for the UAT Rep Club treasurer (uat-club-treasurer@uat-rep-club.local),
 * written for Notifications Open in Place step 3 (2026-10-06) — the admin's Notifications page opens a
 * notification instead of loading a page. The treasurer's real rows are two money notices, both read, the
 * holding-up one sent before step 1 (so it names the list, not its request). A walk of "a fresh unread
 * notice opens its one request" needs a row written the way the product writes one today.
 *
 * What it seeds (1 row, unread), its title, body and link as the product's own sender writes them: a
 * team_request_filed notice (Needs attention) for the newest WAITING payment request in the club, linked with
 * `?request=` (`clubMoneyLinks.requests`), so its button reads "Open the request". Only that: a treasurer
 * receives the club's three money notices and nothing else (all three wait in Needs attention), so an
 * Activity row here would be one this account never gets. Deleting it is the walk's proof that a delete
 * leaves the request it was about where it was.
 *
 * Idempotent: tagged metadata.seed = 'nop3-walk' and deletes its own prior rows first (the treasurer's
 * real notifications are never touched). Re-run = reset.
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

// The newest request still waiting on the club — the one a fresh "filed a request" notice opens.
const { data: waiting, error: reqErr } = await sb.from('rep_team_payment_requests')
  .select('id, team_id, amount, description, request_type')
  .eq('org_id', org.id).eq('status', 'pending')
  .order('created_at', { ascending: false }).limit(1).maybeSingle();
if (reqErr) throw reqErr;
if (!waiting) throw new Error('UAT Rep Club has no waiting payment request to point a notice at');
const { data: team } = await sb.from('rep_teams').select('name').eq('id', waiting.team_id).maybeSingle();

// The product's own words, from the product's own builder — never a hand-kept copy that drifts when the notice
// changes. The repo's test resolver (registered here, so the run line stays plain `node`) lets Node load the
// app's TypeScript with its extensionless relative imports.
await import('../tests/ts-resolver.mjs');
const { CLUB_MONEY_NOTICE } = await import('../lib/club-money-words.ts');
const notice = CLUB_MONEY_NOTICE.newRequest({
  teamName: team?.name ?? 'A team', amount: Number(waiting.amount), what: waiting.description,
  toClub: waiting.request_type === 'payment_to_org',
});

await sb.from('notifications').delete().eq('user_id', treasurer.id).eq('org_id', org.id).contains('metadata', { seed: SEED });
const M = 60_000;
const ago = ms => new Date(Date.now() - ms).toISOString();
const rows = [
  {
    event_type: 'team_request_filed',
    ...notice,
    link: `/${org.slug}/admin/accounting/payment-requests?request=${waiting.id}`,
    created_at: ago(20 * M), read_at: null,
    metadata: { seed: SEED, requestId: waiting.id },
  },
].map(r => ({ ...r, user_id: treasurer.id, org_id: org.id }));
const { error: insErr } = await sb.from('notifications').insert(rows);
if (insErr) throw insErr;

console.log('\n=== UAT TREASURER NOTIFICATIONS SEEDED (Notifications Open in Place step 3) ===');
for (const r of rows) console.log(`  ${r.read_at ? 'read  ' : 'UNREAD'} ${r.event_type.padEnd(20)} ${r.title}  →  ${r.link}`);
console.log(`\nSign in as ${EMAIL}, then More › Notifications on a phone (or /${org.slug}/admin/notifications).`);
console.log('Re-run this script any time to reset the walk.');
