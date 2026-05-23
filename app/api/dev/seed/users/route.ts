import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireDevToolPlatformAdmin } from '@/lib/platform-auth';

const DEV_PASSWORD = 'devpass123';

// All possible seed users
const ALL_SEED_USERS: { email: string; name: string; role: string }[] = [
  { email: 'admin@dev.local',        name: 'Dev Admin',        role: 'admin'        },
  { email: 'staff@dev.local',        name: 'Dev Staff',        role: 'staff'        },
  { email: 'coach@dev.local',        name: 'Dev Coach',        role: 'coach'        },
  { email: 'league-admin@dev.local', name: 'Dev League Admin', role: 'league_admin' },
  { email: 'treasurer@dev.local',    name: 'Dev Treasurer',    role: 'treasurer'    },
];

// Which roles are appropriate for each plan tier
const PLAN_ROLES: Record<string, string[]> = {
  tournament:      ['admin', 'staff', 'coach'],
  tournament_plus: ['admin', 'staff', 'coach'],
  league:          ['admin', 'staff', 'coach', 'league_admin', 'treasurer'],
  club:            ['admin', 'staff', 'coach', 'league_admin', 'treasurer'],
};

export async function POST() {
  const auth = await requireDevToolPlatformAdmin();
  if (auth.response) return auth.response;

  // Target all standard (non-team-workspace, non-protected) orgs
  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('id, slug, plan_id, internal_notes, account_kind')
    .order('created_at', { ascending: true });

  const targetOrgs = (orgs ?? []).filter(o => {
    const isProtected     = String(o.internal_notes ?? '').includes('[UAT_PROTECTED]');
    const isTeamWorkspace = (o as { account_kind?: string | null }).account_kind === 'team_workspace';
    return !isProtected && !isTeamWorkspace;
  });

  if (targetOrgs.length === 0) {
    return NextResponse.json({ error: 'No orgs found. Seed an org first.' }, { status: 400 });
  }

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const log: string[] = [];

  // Ensure every auth user exists (create once, shared across orgs)
  const authUserIds: Record<string, string> = {};

  for (const u of ALL_SEED_USERS) {
    let authUser = userList?.users.find(x => x.email === u.email);

    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: DEV_PASSWORD,
        email_confirm: true,
      });
      if (error) { log.push(`ERROR creating ${u.email}: ${error.message}`); continue; }
      authUser = data.user;
      log.push(`Created auth user: ${u.email}`);
    }

    authUserIds[u.email] = authUser.id;
  }

  // Link plan-appropriate users to each org
  for (const org of targetOrgs) {
    const planId      = org.plan_id ?? 'tournament';
    const allowedRoles = PLAN_ROLES[planId] ?? PLAN_ROLES['tournament'];
    const usersForOrg  = ALL_SEED_USERS.filter(u => allowedRoles.includes(u.role));

    log.push(`\nOrg: ${org.slug} (${planId})`);

    for (const u of usersForOrg) {
      const userId = authUserIds[u.email];
      if (!userId) continue;

      const { data: existing } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', org.id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabaseAdmin.from('organization_members').insert({
          organization_id: org.id,
          user_id:         userId,
          role:            u.role,
          display_name:    u.name,
          status:          'active',
          accepted_at:     new Date().toISOString(),
        });
        if (error) {
          log.push(`  ERROR linking ${u.email}: ${error.message}`);
        } else {
          log.push(`  → linked ${u.email} as ${u.role}`);
        }
      } else {
        log.push(`  → ${u.email} already linked`);
      }
    }
  }

  return NextResponse.json({ ok: true, log });
}
