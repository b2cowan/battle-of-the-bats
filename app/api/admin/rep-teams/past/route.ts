import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepPastProgramYears } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async () => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  let scopeTeamIds: string[] | undefined;
  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', ctx!.org.id)
      .in('group_id', ctx!.repGroupIds);
    scopeTeamIds = (scopedTeams ?? []).map((t: any) => t.id as string);
  }

  const years = await getRepPastProgramYears(ctx!.org.id, scopeTeamIds);
  return NextResponse.json({ years });
}, { route: '/api/admin/rep-teams/past' });
