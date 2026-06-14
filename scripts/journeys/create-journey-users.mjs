/**
 * Journey-audit harness users: single-org owners for the league/club orgs.
 * Needed because most non-tournament admin APIs resolve org context from the
 * caller's FIRST membership row (no orgSlug scoping) — multi-org owner@dev.local
 * resolves to dev-test-org and gets 403/wrong-org on house-league/accounting.
 * (That defect is itself a journey finding; these users are the harness workaround.)
 *
 * Creates: league-owner@dev.local -> owner of dev-league-org ONLY
 *          club-owner@dev.local   -> owner of dev-club-org ONLY
 * Password: devpass123. Idempotent.
 *
 * Run: node --env-file=.env.local scripts/journeys/create-journey-users.mjs
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const USERS = [
  { email: 'league-owner@dev.local', orgSlug: 'dev-league-org' },
  { email: 'club-owner@dev.local', orgSlug: 'dev-club-org' },
];

const { data: userList } = await db.auth.admin.listUsers();

for (const u of USERS) {
  const { data: org } = await db.from('organizations').select('id').eq('slug', u.orgSlug).single();
  if (!org) { console.error(`${u.orgSlug} missing`); process.exit(1); }

  let authUser = userList?.users.find(x => x.email === u.email);
  if (!authUser) {
    const { data, error } = await db.auth.admin.createUser({ email: u.email, password: 'devpass123', email_confirm: true });
    if (error) { console.error(`createUser ${u.email}:`, error.message); process.exit(1); }
    authUser = data.user;
    console.log(`created auth user ${u.email}`);
  } else {
    console.log(`auth user exists ${u.email}`);
  }

  const { data: member } = await db.from('organization_members').select('id').eq('organization_id', org.id).eq('user_id', authUser.id).maybeSingle();
  if (!member) {
    const { error } = await db.from('organization_members').insert({
      organization_id: org.id,
      user_id: authUser.id,
      role: 'owner',
      status: 'active',
      accepted_at: new Date().toISOString(),
    });
    if (error) { console.error(`member ${u.email}:`, error.message); process.exit(1); }
    console.log(`linked ${u.email} as owner of ${u.orgSlug}`);
  } else {
    console.log(`membership exists ${u.email} -> ${u.orgSlug}`);
  }
}
console.log('OK');
