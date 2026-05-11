import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepTeam, getRepProgramYears, createRepProgramYear } from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: { teamId: string } },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const team = await getRepTeam(params.teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const programYears = await getRepProgramYears(team.id);
  return NextResponse.json({ programYears });
}

export async function POST(
  req: Request,
  { params }: { params: { teamId: string } },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const team = await getRepTeam(params.teamId);
  if (!team || team.orgId !== ctx!.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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
    return NextResponse.json({ programYear }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'A program year for that calendar year already exists for this team' }, { status: 409 });
    }
    throw e;
  }
}
