import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, updateRepTeam, getRepProgramYears } from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { teamId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const programYears = await getRepProgramYears(team.id);

  // Attach roster counts per year
  const yearsWithCounts = await Promise.all(programYears.map(async py => {
    const [{ count: rosterCount }, { count: coachCount }] = await Promise.all([
      supabaseAdmin
        .from('rep_roster_players')
        .select('id', { count: 'exact', head: true })
        .eq('program_year_id', py.id)
        .eq('status', 'active'),
      supabaseAdmin
        .from('rep_team_coaches')
        .select('id', { count: 'exact', head: true })
        .eq('program_year_id', py.id),
    ]);
    return { ...py, rosterCount: rosterCount ?? 0, coachCount: coachCount ?? 0 };
  }));

  return NextResponse.json({ team, programYears: yearsWithCounts });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const groupErr = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErr) return groupErr;

  const body = await req.json();
  const fields: Parameters<typeof updateRepTeam>[1] = {};
  if (typeof body.name === 'string') fields.name = body.name.trim();
  if (typeof body.sport === 'string') fields.sport = body.sport.trim();
  if ('division' in body) fields.division = body.division?.trim() || null;
  if ('description' in body) fields.description = body.description?.trim() || null;
  if ('color' in body) fields.color = body.color?.trim() || null;
  if (typeof body.isArchived === 'boolean') fields.isArchived = body.isArchived;

  const updated = await updateRepTeam(teamId, fields);
  return NextResponse.json({ team: updated });
}
