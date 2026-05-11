import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYear, getRepProgramYears, updateRepProgramYear } from '@/lib/db';
import type { RepProgramYearStatus } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

const VALID_TRANSITIONS: Record<RepProgramYearStatus, RepProgramYearStatus[]> = {
  draft:     ['active'],
  active:    ['completed'],
  completed: ['archived'],
  archived:  [],
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [
    { count: rosterCount },
    { count: pendingTryouts },
    { count: coachCount },
    { count: upcomingEvents },
  ] = await Promise.all([
    supabaseAdmin.from('rep_roster_players')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id).eq('status', 'active'),
    supabaseAdmin.from('rep_tryout_registrations')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id).eq('status', 'pending_review'),
    supabaseAdmin.from('rep_team_coaches')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id),
    supabaseAdmin.from('rep_team_events')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id)
      .gte('starts_at', new Date().toISOString()),
  ]);

  return NextResponse.json({
    team,
    programYear,
    summary: {
      rosterCount: rosterCount ?? 0,
      pendingTryouts: pendingTryouts ?? 0,
      coachCount: coachCount ?? 0,
      upcomingEvents: upcomingEvents ?? 0,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ teamId: string; yearId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const { teamId, yearId } = await params;
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYear = await getRepProgramYear(yearId);
  if (!programYear || programYear.teamId !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const fields: Parameters<typeof updateRepProgramYear>[1] = {};

  if (typeof body.name === 'string') fields.name = body.name.trim();
  if (typeof body.tryoutOpen === 'boolean') fields.tryoutOpen = body.tryoutOpen;
  if ('tryoutDescription' in body) fields.tryoutDescription = body.tryoutDescription?.trim() || null;
  if ('budgetAmount' in body) fields.budgetAmount = body.budgetAmount != null ? Number(body.budgetAmount) : null;

  if (body.status !== undefined) {
    const newStatus = body.status as RepProgramYearStatus;
    const allowed = VALID_TRANSITIONS[programYear.status];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from '${programYear.status}' to '${newStatus}'` },
        { status: 422 },
      );
    }
    // If activating, ensure no other year for this team is active
    if (newStatus === 'active') {
      const siblings = await getRepProgramYears(team.id);
      const otherActive = siblings.find(py => py.id !== programYear.id && py.status === 'active');
      if (otherActive) {
        return NextResponse.json(
          { error: 'Another program year is already active for this team. Complete or archive it first.' },
          { status: 409 },
        );
      }
    }
    fields.status = newStatus;
  }

  const updated = await updateRepProgramYear(yearId, fields);
  return NextResponse.json({ programYear: updated });
}
