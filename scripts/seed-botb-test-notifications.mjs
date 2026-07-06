/**
 * seed-botb-test-notifications.mjs  (DEV ONLY)
 *
 * Seeds a realistic spread of notifications on the mirrored Battle of the Bats so the
 * Notification Center Rework (P1) bell can be tested end-to-end:
 *   • 4 "act" items (unread) → populate the pinned "Needs attention" section, incl. one
 *     from yesterday to show act items stay pinned regardless of age.
 *   • 7 "know" items spread across Today / Yesterday / Earlier (mix of read/unread) →
 *     the grouped Activity feed.
 *   • 1 chat ("talk") item → shows chat still lands in the bell (P3 moves it out later).
 *
 * Targets the BOTB test admin (botb-admin@dev.local, per scripts/reset-botb-champions-moment.mjs);
 * override with a different member email as the first CLI arg. Idempotent: deletes its own
 * prior seed (tagged metadata.seed = 'botb-test') before re-inserting, so re-runs never pile up.
 *
 * Run:  node scripts/seed-botb-test-notifications.mjs [member-email]
 * Then: log in as that admin and open the bell on Battle of the Bats.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const TOURNAMENT_ID = '7ab0c79e-f29a-4512-9ac1-16aa661b324d'; // Battle of the Bats (prod mirror)
const TARGET_EMAIL  = (process.argv[2] || 'botb-admin@dev.local').toLowerCase();

const HOUR = 3_600_000;
const iso  = (ageMs) => new Date(Date.now() - ageMs).toISOString();

async function resolveTargetUser(orgId) {
  // Prefer the requested email (default: the BOTB test admin).
  let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = (data?.users ?? []).find(u => (u.email || '').toLowerCase() === TARGET_EMAIL);
    if (hit) return { userId: hit.id, email: hit.email };
    if (!data || data.users.length < 1000) break;
    page += 1;
  }
  // Fallback: the org's owner.
  const { data: owner } = await sb
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!owner) throw new Error(`No user found for ${TARGET_EMAIL} and no org owner to fall back to.`);
  const { data: authUser } = await sb.auth.admin.getUserById(owner.user_id);
  return { userId: owner.user_id, email: authUser?.user?.email ?? '(owner)' };
}

async function main() {
  // Org for the tournament (notifications are scoped by org_id, not tournament_id).
  const { data: t, error: tErr } = await sb
    .from('tournaments')
    .select('id, name, org_id')
    .eq('id', TOURNAMENT_ID)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!t) { console.error('❌ Battle of the Bats not found. Run scripts/mirror-battle-of-the-bats.mjs first.'); process.exit(1); }

  const { data: org } = await sb.from('organizations').select('slug').eq('id', t.org_id).maybeSingle();
  const slug = org?.slug ?? 'milton-softball-organization';
  const A = `/${slug}/admin/tournaments`; // admin tournament pages (selected tournament held in context)

  const { userId, email } = await resolveTargetUser(t.org_id);

  // ── The seed set — (event_type, title, body, link, ageMs, read) ─────────────
  const rows = [
    // Act (unread) → "Needs attention" (never bundled — each needs its own decision)
    ['payment_failed',   'Payment failed — Waterloo Ghosts', 'Their card was declined for the $450 entry fee.', `${A}/registrations`, 2 * HOUR,  false],
    ['coach_access_requested', 'Coach access requested', 'A coach is asking for access to your Coaches Portal.', `${A}/dashboard`, 4 * HOUR, false],
    ['score_disputed',   'Score disputed — U11 QF2', 'A coach flagged the submitted score for review.', `${A}/schedule`, 7 * HOUR, false],
    ['team_no_show',     'Team marked no-show — EG Rise', 'Recorded as a no-show at gate check-in.', `${A}/check-in`, 26 * HOUR, false], // yesterday, still pinned

    // Know → Activity feed (Today) — 5 unread registrations → "5 new registrations" BUNDLE
    ['registration_new', 'New registration: Halton Hawks', 'U11 · Added manually', `${A}/registrations`, 1 * HOUR, false],
    ['registration_new', 'New registration: Waterloo Ghosts', 'U11 · Added manually', `${A}/registrations`, 2 * HOUR, false],
    ['registration_new', 'New registration: Brampton Blazers', 'U11 · Added manually', `${A}/registrations`, 3 * HOUR, false],
    ['registration_new', 'New registration: Mississauga Lightning', 'U11 · Added manually', `${A}/registrations`, 4 * HOUR, false],
    ['registration_new', 'New registration: Oakville Storm', 'U11 · Added manually', `${A}/registrations`, 5 * HOUR, false],
    // Today — 2 unread payments → "2 payments received" BUNDLE
    ['payment_received', 'Payment received — Milton Magic', '$450 entry fee confirmed.', `${A}/registrations`, 3 * HOUR, false],
    ['payment_received', 'Payment received — Guelph Gators', '$450 entry fee confirmed.', `${A}/registrations`, 6 * HOUR, false],
    // Today — chat (individual; not bundled — moves to Chat tab in P3)
    ['chat_message',     'New message in All coaches', 'See everyone at the diamonds tomorrow!', `${A}/chat`, 90 * 60_000, false],

    // (Yesterday) — read items, revealed by flipping the toggle to "All"
    ['score_submitted',  'Score submitted — Game #6', 'Halton Hawks 8 – Waterloo Ghosts 5', `${A}/schedule`, 27 * HOUR, true],
    ['playoffs_set',     'Playoffs are set', 'The playoff bracket has been published.', `${A}/schedule`, 30 * HOUR, true],
    // (Earlier) — read
    ['registration_status_changed', 'Registration accepted — Mississauga Ladybugs', 'Their spot is confirmed.', `${A}/registrations`, 3 * 24 * HOUR, true],
    ['champions_crowned', 'Champions crowned', 'Brampton Blazers Gold are your champions.', `${A}/dashboard`, 5 * 24 * HOUR, true],
  ];

  // Idempotent: clear any prior seed for this user+org before re-inserting.
  const { error: delErr } = await sb
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('org_id', t.org_id)
    .contains('metadata', { seed: 'botb-test' });
  if (delErr) throw delErr;

  const payload = rows.map(([event_type, title, body, link, ageMs, read]) => ({
    org_id:     t.org_id,
    user_id:    userId,
    event_type,
    title,
    body,
    link,
    created_at: iso(ageMs),
    read_at:    read ? iso(ageMs - 5 * 60_000) : null, // read a few minutes after arrival
    metadata:   { seed: 'botb-test' },
  }));

  const { error: insErr } = await sb.from('notifications').insert(payload);
  if (insErr) throw insErr;

  const unread = payload.filter(p => !p.read_at).length;
  console.log('\n=== BOTB TEST NOTIFICATIONS SEEDED ===');
  console.log('Tournament : ', t.name);
  console.log('Recipient  : ', email, `(${userId})`);
  console.log('Inserted   : ', payload.length, 'notifications —', unread, 'unread');
  console.log('  • Needs attention (4 unread act): payment failed, coach access, disputed score, no-show');
  console.log('  • Today → BUNDLES: "5 new registrations" + "2 payments received", plus 1 chat (individual)');
  console.log('  • Yesterday / Earlier: read items — flip the "All" toggle to reveal them dimmed');
  console.log(`\nLog in as ${email} → open ${slug} → click the bell.`);
  console.log('Test: default "Unread" view shows the bundles; tap a bundle → all clear + opens the list.');
  console.log('Re-run this script any time to reset the test set.');
}

main().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
