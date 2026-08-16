import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYears, createRepProgramYear } from '@/lib/db';
import { projectMembershipsOntoProgramYear } from '@/lib/coach-membership';
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
  const groupErrG = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErrG) return groupErrG;

  const programYears = await getRepProgramYears(team.id);
  return NextResponse.json({ programYears });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years' });

export const POST = withObservability(async (req: Request,
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
  const groupErrP = repGroupScopeGuard(ctx!, team.groupId);
  if (groupErrP) return groupErrP;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const year = typeof body.year === 'number' ? Math.floor(body.year) : null;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be a valid calendar year' }, { status: 400 });
  }

  // Guard: only one active program year per team at a time
  const existing = await getRepProgramYears(team.id);
  const hasActive = existing.some(py => py.status === 'active');
  if (hasActive) {
    return NextResponse.json(
      { error: 'This team already has an active program year. Complete or archive it before creating a new one.' },
      { status: 409 },
    );
  }

  try {
    const programYear = await createRepProgramYear(team.id, ctx!.org.id, {
      name,
      year,
      tryoutOpen: body.tryoutOpen === true,
      tryoutDescription: body.tryoutDescription?.trim() || null,
    });
    // M1 (2026-08-16): the new season's staff RECORD is written from the team's memberships the
    // moment the year exists. Before this, a fresh year started with ZERO coach rows and the
    // admin re-added everyone by hand — under the old access model that was also a lock-out
    // window for the whole staff.
    //
    // ⚠ REVERT ON FAILURE, exactly like the rollover path — a draft year counts as LIVE for
    // every coach operation the moment it exists, so a year whose staff projection silently
    // failed would make the team look "between seasons" to its own staff (the ~54 write routes
    // and the live assignments list still read season rows) while memberships insist all is
    // well, and nothing self-heals team-wide. Deleting the year is clean: rows cascade with it.
    try {
      await projectMembershipsOntoProgramYear(team.id, ctx!.org.id, programYear.id);
    } catch (e) {
      console.error('[program-years POST] staff projection failed; deleting the half-created year:', e);
      await supabaseAdmin.from('rep_program_years').delete().eq('id', programYear.id);
      return NextResponse.json(
        { error: 'Could not set up coaching access for the new program year. Nothing was created — please try again.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ programYear }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'A program year for that calendar year already exists for this team' }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years' });
