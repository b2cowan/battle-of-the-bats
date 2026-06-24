import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, updateRepTeam, getRepProgramYears, getNonArchivedRepTeamCount } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
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
}, { route: '/api/admin/rep-teams/teams/[teamId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
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

  // Capacity enforcement (Club Repackaging): un-archiving returns a team to the org's active
  // (counted) set, so it must respect the plan team cap exactly like create/adopt do. Only the
  // archived→active transition can push a club over; archiving or other field edits are unaffected.
  if (body.isArchived === false && team.isArchived) {
    const cap = ctx!.org.teamLimit;
    if (cap < 9999) {
      const currentCount = await getNonArchivedRepTeamCount(ctx!.org.id);
      if (currentCount >= cap) {
        const nextStep = ctx!.org.planId === 'club'
          ? ' Upgrade to Club · Association to add up to 30 teams.'
          : ' Contact us to raise your team limit for a larger association.';
        return NextResponse.json(
          { error: `You've reached your plan's limit of ${cap} teams.${nextStep}`, code: 'team_limit_reached' },
          { status: 409 },
        );
      }
    }
  }

  const updated = await updateRepTeam(teamId, fields);
  return NextResponse.json({ team: updated });
}, { route: '/api/admin/rep-teams/teams/[teamId]' });
