import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEV_ORG_SLUG = 'dev-test-org';
const DEV_PASSWORD = 'devpass123';

const SEED_USERS: { email: string; name: string; role: string }[] = [
  { email: 'admin@dev.local',        name: 'Dev Admin',        role: 'admin'            },
  { email: 'staff@dev.local',        name: 'Dev Staff',        role: 'staff'            },
  { email: 'coach@dev.local',        name: 'Dev Coach',        role: 'coach'            },
  { email: 'league-admin@dev.local', name: 'Dev League Admin', role: 'league_admin'     },
  { email: 'treasurer@dev.local',    name: 'Dev Treasurer',    role: 'treasurer'        },
];

export async function POST() {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('slug', DEV_ORG_SLUG)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Seed an org first.' }, { status: 400 });
  }

  const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
  const log: string[] = [];

  for (const u of SEED_USERS) {
    let authUser = userList?.users.find(x => x.email === u.email);

    if (!authUser) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: DEV_PASSWORD,
        email_confirm: true,
      });
      if (error) { log.push(`ERROR ${u.email}: ${error.message}`); continue; }
      authUser = data.user;
      log.push(`Created auth user: ${u.email}`);
    } else {
      log.push(`Auth user exists: ${u.email}`);
    }

    const { data: existing } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', org.id)
      .eq('user_id', authUser!.id)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from('organization_members').insert({
        organization_id: org.id,
        user_id: authUser!.id,
        role: u.role,
        display_name: u.name,
        status: 'active',
        accepted_at: new Date().toISOString(),
      });
      log.push(`  → linked as ${u.role}`);
    } else {
      log.push(`  → membership exists`);
    }
  }

  return NextResponse.json({ ok: true, log });
}
