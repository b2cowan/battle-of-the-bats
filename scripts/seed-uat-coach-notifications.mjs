/**
 * seed-uat-coach-notifications.mjs  (DEV ONLY)
 *
 * Seeds a realistic BUSY notification feed for the UAT coach (uat-coach@uat-test-org.local) so the
 * coach "See all" page and the layout sweep measure the state a coach actually gets, not three
 * weekly digests. Written for the 2026-09-03 coach-notifications review
 * (docs/projects/active/COACH_NOTIFICATIONS_REVIEW.md): the thin fixture had hidden every defect on
 * this screen, and "Mark all read" only renders when something is unread.
 *
 * What it seeds (64 rows, 16 unread): the three "act" events a coach can actually receive (all admin
 * decisions), today/yesterday/earlier activity, bundleable runs (scores, registrations, payments), the
 * coach-only rows (digest, assistant joined), a family "Game moved" and public-site tournament rows —
 * with the SAME links the product writes today, admin-scoped ones included, so the review's
 * "where a row takes a coach" table stays reproducible.
 *
 * Idempotent: tagged metadata.seed = 'notif-review' and deletes its own prior rows first.
 * Remove:  delete from notifications where metadata->>'seed' = 'notif-review'
 * Run:     node scripts/seed-uat-coach-notifications.mjs
 * Sibling: scripts/seed-botb-test-notifications.mjs (the admin bell's equivalent).
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
/* ⚠⚠ THE PRODUCTION REFUSAL, AND IT IS NOT CEREMONY (`/review`, 2026-09-04). This file's first cut
   read `.env.local` and went straight into a service-role delete + insert against whatever project
   those two lines happened to name — while `seed-uat-coach-fixture.mjs`, in this same folder, has
   carried exactly this check for months. The header says DEV ONLY; nothing enforced it.
   ⚠ There WAS an accidental backstop — the `uat-test-org` lookup below returns null on prod and the
   next line throws before any write. That is a lookup that happens to fail, not a guard: it holds
   only while that org does not exist on prod, which is not a property anyone maintains. */
if (/\.supabase\.co/.test(url) && url.includes('qcttcboqysynwcdyghil')) {
  console.error('✗ Refusing to run: that is the PRODUCTION project.');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const { data: org } = await sb.from('organizations').select('id,slug').eq('slug','uat-test-org').single();
const { data: users } = await sb.auth.admin.listUsers({ page:1, perPage:1000 });
const coach = users.users.find(u => u.email === 'uat-coach@uat-test-org.local');
const { data: existing } = await sb.from('notifications').select('link').eq('user_id', coach.id).eq('org_id', org.id).like('link','%/coaches/teams/%').limit(1);
const teamId = existing?.[0]?.link?.match(/teams\/([0-9a-f-]{36})/)?.[1];
if (!teamId) throw new Error('no team id');
await sb.from('notifications').delete().eq('user_id', coach.id).eq('org_id', org.id).contains('metadata', { seed: 'notif-review' });
const H = 3_600_000, D = 24*H; const ago = ms => new Date(Date.now() - ms).toISOString();
const slug = org.slug; const rows = [];
const add = (event_type, title, body, link, ageMs, read) => rows.push({ user_id: coach.id, org_id: org.id, event_type, title, body, link, created_at: ago(ageMs), read_at: read ? ago(ageMs - 20*60_000) : null, metadata: { seed: 'notif-review' } });
// Needs attention — every act event a coach can actually receive (all org-wide admin decisions)
add('assistant_coach_approval_requested', 'Assistant coach invite awaiting approval', 'Dana Whitfield invited m.okafor@example.com to U13 Hawks.', `/${slug}/admin/rep-teams`, 2*H, false);
add('team_no_show', 'Team marked no-show', 'Riverside Rockets did not check in for game 14.', `/${slug}/admin/tournaments/check-in`, 26*H, false);
add('payment_failed', 'Payment failed', 'The club’s subscription payment could not be processed.', `/${slug}/admin/org/billing`, 3*D, false);
// Today
add('family_game_update', 'Game moved: U13 Hawks vs Northside Thunder', 'Was 2:00 p.m. at Diamond 2 — now 3:15 p.m. at Diamond 4.', `/family/teams/${teamId}`, 1*H, false);
add('tournament_announcement', 'Rain delay — all 4:00 p.m. games pushed 45 minutes', 'Fields are being dragged. Check the schedule before you leave.', `/${slug}/spring-classic`, 3*H, false);
for (let i = 0; i < 6; i++) add('score_submitted', 'Score submitted', `Game ${20+i} final entered by the scorekeeper.`, `/${slug}/admin/tournaments/results?tournamentId=x&gameId=${i}`, 4*H + i*20*60_000, i > 3);
for (let i = 0; i < 4; i++) add('registration_new', `New registration: ${['Lakeside Lightning','Prairie Storm','Harbour Heat','Valley Vipers'][i]}`, 'Registered for Spring Classic.', `/${slug}/admin/tournaments/registrations?tournamentId=x`, 6*H + i*15*60_000, false);
// Yesterday
add('assistant_coach_joined', 'Assistant coach joined', 'Priya Natarajan accepted your invite to U13 Hawks.', `/${slug}/coaches/teams/${teamId}/settings`, 1*D + 2*H, false);
add('playoffs_set', '🏆 Playoffs are set', 'The playoff bracket has been published — the seeding is locked and the knockout stage is on.', `/${slug}/spring-classic/playoffs`, 1*D + 5*H, true);
for (let i = 0; i < 5; i++) add('registration_status_changed', `Registration accepted: ${['Lakeside Lightning','Prairie Storm','Harbour Heat','Valley Vipers','Delta Dragons'][i]}`, null, `/${slug}/admin/tournaments/registrations?tournamentId=x`, 1*D + 6*H + i*10*60_000, true);
for (let i = 0; i < 3; i++) add('payment_received', `Payment received: ${['Lakeside Lightning','Prairie Storm','Harbour Heat'][i]}`, '$450.00 recorded.', `/${slug}/admin/tournaments/registrations?tournamentId=x`, 1*D + 8*H + i*10*60_000, true);
// Earlier — weeks of digests, champions, more registrations, a few unread
add('champions_crowned', '🏆 Champions crowned', 'U13 Hawks — see the final results', `/${slug}/spring-classic/champions`, 3*D + 4*H, false);
for (let w = 1; w <= 8; w++) add('coach_insights_digest', `Your week in review — U13 Hawks`, 'Attendance slipped to 68% and two players sat under 40% of innings.', `/${slug}/coaches/teams/${teamId}/history`, w*7*D + 3*H, w > 1);
for (let i = 0; i < 20; i++) add('score_submitted', 'Score submitted', `Game ${i+1} final entered.`, `/${slug}/admin/tournaments/results?tournamentId=x&gameId=e${i}`, 4*D + i*5*H, true);
for (let i = 0; i < 10; i++) add('registration_new', `New registration: Team ${i+1}`, 'Registered for Fall Cup.', `/${slug}/admin/tournaments/registrations?tournamentId=y`, 12*D + i*6*H, true);
const { error } = await sb.from('notifications').insert(rows);
if (error) throw error;
console.log('seeded', rows.length, 'rows for UAT coach;', rows.filter(r=>!r.read_at).length, 'unread; team', teamId);
