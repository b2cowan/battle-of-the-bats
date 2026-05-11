import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepTeam,
  getRepProgramYear,
  getRepTryoutRegistrations,
  createRepTryoutRegistration,
} from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET(
  req: Request,
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

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') ?? undefined;

  let registrations = await getRepTryoutRegistrations(programYear.id);

  if (statusFilter) {
    registrations = registrations.filter(r => r.status === statusFilter);
  }

  const search = searchParams.get('search')?.toLowerCase();
  if (search) {
    registrations = registrations.filter(r =>
      `${r.playerFirstName} ${r.playerLastName}`.toLowerCase().includes(search) ||
      r.guardianEmail.toLowerCase().includes(search),
    );
  }

  return NextResponse.json({ registrations });
}

export async function POST(
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

  const errors: Record<string, string> = {};
  if (!body.playerFirstName?.trim()) errors.playerFirstName = 'Required';
  if (!body.playerLastName?.trim()) errors.playerLastName = 'Required';
  if (!body.guardianFirstName?.trim()) errors.guardianFirstName = 'Required';
  if (!body.guardianLastName?.trim()) errors.guardianLastName = 'Required';
  if (!body.guardianEmail?.trim()) errors.guardianEmail = 'Required';

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const registration = await createRepTryoutRegistration({
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    playerFirstName: body.playerFirstName.trim(),
    playerLastName: body.playerLastName.trim(),
    playerDateOfBirth: body.playerDateOfBirth?.trim() || null,
    playerNotes: body.playerNotes?.trim() || null,
    guardianFirstName: body.guardianFirstName.trim(),
    guardianLastName: body.guardianLastName.trim(),
    guardianEmail: body.guardianEmail.trim().toLowerCase(),
    guardianPhone: body.guardianPhone?.trim() || null,
  });

  return NextResponse.json({ registration }, { status: 201 });
}
