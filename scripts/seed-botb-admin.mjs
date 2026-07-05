/**
 * seed-botb-admin.mjs  (DEV ONLY)
 *
 * Creates a login that can access the ADMIN portal of the org that runs the
 * mirrored "Battle of the Bats" tournament (Milton Softball Organization), so the
 * game-day dashboard (Now Playing / Up Next / Needs a Score) can be tested.
 *
 * Idempotent: removes any prior copy of this account + its membership first.
 * Requires the org to already exist in dev (run scripts/mirror-battle-of-the-bats.mjs
 * first). NOTE: re-running the mirror deletes + re-inserts the org, which cascades
 * away this membership — just re-run this script afterward.
 *
 * Run: node scripts/seed-botb-admin.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const ORG_ID = '42871b5b-5f96-44ab-afac-6f9ede1cdaed';           // Milton Softball Organization
const TOURNAMENT_ID = '7ab0c79e-f29a-4512-9ac1-16aa661b324d';    // Battle of the Bats (prod mirror)
const EMAIL = 'botb-admin@dev.local';
const PASSWORD = 'devpass123';
const DISPLAY = 'BOTB Admin';

async function main() {
  // ── Org must exist (mirror script must have run) ──
  const { data: orgRow } = await sb.from('organizations').select('slug, name, plan_id').eq('id', ORG_ID).maybeSingle();
  if (!orgRow) {
    console.error('❌ Org not found in dev. Run: node scripts/mirror-battle-of-the-bats.mjs  first.');
    process.exit(1);
  }

  // ── Clean any prior copy of this account ──
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find(u => (u.email || '').toLowerCase() === EMAIL);
  if (existing) {
    await sb.from('organization_members').delete().eq('organization_id', ORG_ID).eq('user_id', existing.id);
    await sb.auth.admin.deleteUser(existing.id);
    console.log('Cleaned prior seed for', EMAIL);
  }

  // ── Auth user (confirmed, password set) ──
  const { data: created, error: uErr } = await sb.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
    user_metadata: { first_name: 'BOTB', last_name: 'Admin', full_name: DISPLAY },
  });
  if (uErr) throw uErr;
  const userId = created.user.id;

  // ── Owner membership (full admin access) ──
  const { error: mErr } = await sb.from('organization_members').insert({
    organization_id: ORG_ID, user_id: userId, role: 'owner', status: 'active',
    accepted_at: new Date().toISOString(), display_name: DISPLAY,
  });
  if (mErr) throw mErr;

  // ── Report game-date spread so we know if the dashboard sections will populate ──
  const { data: games } = await sb
    .from('games')
    .select('game_date, status')
    .eq('tournament_id', TOURNAMENT_ID);
  const byDate = {};
  for (const g of games || []) {
    const d = g.game_date || '(no date)';
    byDate[d] = (byDate[d] || 0) + 1;
  }
  const statusCounts = {};
  for (const g of games || []) statusCounts[g.status || '(null)'] = (statusCounts[g.status || '(null)'] || 0) + 1;

  console.log('\n=== BOTB ADMIN SEED COMPLETE ===');
  console.log('Org:      ', orgRow.name, `(plan: ${orgRow.plan_id})`);
  console.log('Login:    ', EMAIL, '/', PASSWORD);
  console.log('Admin URL: /' + orgRow.slug + '/admin/tournaments/dashboard');
  console.log('\nGames by date:', JSON.stringify(byDate, null, 0));
  console.log('Games by status:', JSON.stringify(statusCounts, null, 0));
}

main().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
