import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isPlatformAdminEmail } from '@/lib/platform-auth';

type OrgRelation = {
  id?: string;
  slug?: string;
  plan_id?: string;
  enabled_addons?: string[] | null;
} | null;

function isMissingStartupTasksColumn(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42703' || error.code === 'PGRST204' || message.includes('startup_tasks');
}

function hasSkippedTournamentSetup(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const task = (value as Record<string, { status?: unknown }>).tournament;
  return task?.status === 'skipped';
}

async function hasNonArchivedTournament(orgId: string) {
  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .eq('organization_id', orgId)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle();

  return !!data;
}

async function hasSkippedFirstTournamentWizard(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .select('startup_tasks')
    .eq('id', orgId)
    .single();

  if (isMissingStartupTasksColumn(error)) return false;
  if (error) return false;
  return hasSkippedTournamentSetup(data?.startup_tasks);
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ destination: '/auth/login' });
  }

  if (await isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ destination: '/platform-admin' });
  }

  const { data: member } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id, organizations(id, slug, plan_id, enabled_addons)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  const orgRelation = (member as {
    organizations?: OrgRelation | OrgRelation[] | null;
  } | null)?.organizations;
  const slug = Array.isArray(orgRelation) ? orgRelation[0]?.slug : orgRelation?.slug;
  const org = Array.isArray(orgRelation) ? orgRelation[0] : orgRelation;
  if (slug) {
    const orgId = org?.id ?? member?.organization_id;
    const planId = org?.plan_id;
    const enabledAddons = org?.enabled_addons ?? [];
    const hasOnlyTournamentWorkspace =
      (planId === 'tournament' || planId === 'tournament_plus') &&
      !enabledAddons.some(addon => [
        'module_public_site',
        'module_accounting',
        'module_house_league',
        'module_rep_teams',
      ].includes(addon));

    if (orgId && hasOnlyTournamentWorkspace) {
      if (await hasNonArchivedTournament(orgId)) {
        return NextResponse.json({ destination: `/${slug}/admin/tournaments/dashboard` });
      }

      if (await hasSkippedFirstTournamentWizard(orgId)) {
        return NextResponse.json({ destination: `/${slug}/admin/tournaments` });
      }

      return NextResponse.json({ destination: `/${slug}/admin/onboarding?continueSetup=1` });
    }

    return NextResponse.json({ destination: `/${slug}/admin` });
  }

  return NextResponse.json({ destination: '/auth/signup' });
}
