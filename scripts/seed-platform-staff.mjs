/**
 * Seed scoped-role PLATFORM STAFF accounts for the Platform-Admin Employee Audit.
 *
 * The bootstrap dev seed (app/api/dev/seed/platform-user) only creates ONE
 * super_admin (platform@dev.local). The production invite path
 * (POST /api/platform-admin/company-users) creates auth users WITHOUT a password
 * (magic-link only) — unusable for a scripted dev login. This script closes that
 * gap: it creates a real, password-backed auth user + an active platform_users
 * row for each scoped role, so we can log into /platform-admin AS each role and
 * walk least-privilege as the employee actually sees it (nav + page guards).
 *
 * Creates (idempotent — safe to re-run; reuses existing auth users + rows):
 *   support@dev.local   role=support
 *   billing@dev.local   role=billing
 *   product@dev.local   role=product
 *   growth@dev.local    role=growth
 *   readonly@dev.local  role=read_only
 *   (all password devpass123, email confirmed, is_active=true)
 *
 * platform_users schema verified against the live dev snapshot 2026-06-13
 * (docs/agents/db/schema-snapshots/schema-dump-columns-dev.json): columns
 * email, display_name, role, is_active. Roles verified from lib/platform-auth.ts.
 *
 * DEV ONLY. RLS is enabled on platform_users with no policies, so these writes
 * require the service-role key.
 *
 * Run: node --env-file=.env.local scripts/seed-platform-staff.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/seed-platform-staff.mjs');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = 'devpass123';

// email → { role, display_name }. Roles must match lib/platform-auth.ts PlatformRole.
const STAFF = [
  { email: 'support@dev.local',  role: 'support',    name: 'Dev Support'   },
  { email: 'billing@dev.local',  role: 'billing',    name: 'Dev Billing'   },
  { email: 'product@dev.local',  role: 'product',    name: 'Dev Product'   },
  { email: 'growth@dev.local',   role: 'growth',     name: 'Dev Growth'    },
  { email: 'readonly@dev.local', role: 'read_only',  name: 'Dev ReadOnly'  },
];

async function findAuthUser(email) {
  // listUsers is paginated (default 50/page); page until found or exhausted.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error(`❌ listUsers:`, error.message); process.exit(1); }
    const hit = data.users.find(u => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

for (const { email, role, name } of STAFF) {
  // 1. Auth user (with a real password so we can log in).
  let authUser = await findAuthUser(email);
  if (!authUser) {
    const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) { console.error(`❌ createUser ${email}:`, error.message); process.exit(1); }
    authUser = data.user;
    console.log(`✓ created auth user  ${email}`);
  } else {
    // Ensure the password is the known dev one (in case it was an invite-only user).
    await db.auth.admin.updateUserById(authUser.id, { password: PASSWORD, email_confirm: true });
    console.log(`• auth user exists   ${email} (password reset to devpass123)`);
  }

  // 2. platform_users row (active, with the scoped role).
  const { data: existing } = await db.from('platform_users').select('id, role, is_active').eq('email', email).maybeSingle();
  if (!existing) {
    const { error } = await db.from('platform_users').insert({ email, display_name: name, role, is_active: true });
    if (error) { console.error(`❌ insert platform_users ${email}:`, error.message); process.exit(1); }
    console.log(`✓ created platform_users  ${email}  role=${role}`);
  } else if (existing.role !== role || existing.is_active !== true) {
    const { error } = await db.from('platform_users').update({ role, is_active: true, display_name: name }).eq('email', email);
    if (error) { console.error(`❌ update platform_users ${email}:`, error.message); process.exit(1); }
    console.log(`✓ updated platform_users  ${email}  role=${role} (was role=${existing.role}, active=${existing.is_active})`);
  } else {
    console.log(`• platform_users ok  ${email}  role=${role}`);
  }
}

console.log('\nDone. Log in at /platform-admin/login with any of the above + devpass123.');
