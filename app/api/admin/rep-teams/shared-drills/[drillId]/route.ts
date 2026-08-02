import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { updateRepTeamDrill } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { validateDrillInput } from '@/lib/rep-drills';

/**
 * Edit, retire or restore ONE of the club's shared drills.
 *
 * ⚠ No DELETE — retiring keeps every practice plan that already used it working untouched, and a
 * plan renders from its own copy of the words regardless.
 *
 * ⚠ The update is scoped to `teamId: null` in the query, so this route can only ever reach SHARED
 * rows: an org admin cannot rename or retire a coach's private team drill through it, even by id.
 */
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  return null;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ drillId: string }> },) => {
  const { drillId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Retire/restore travels alone — a state change, not an edit.
  if (typeof body.isActive === 'boolean' && Object.keys(body).length === 1) {
    const drill = await updateRepTeamDrill(drillId, { orgId: ctx!.org.id, teamId: null }, { isActive: body.isActive });
    if (!drill) return NextResponse.json({ error: 'Shared drill not found' }, { status: 404 });
    return NextResponse.json({ drill });
  }

  const parsed = validateDrillInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const drill = await updateRepTeamDrill(drillId, { orgId: ctx!.org.id, teamId: null }, parsed.drill);
    if (!drill) return NextResponse.json({ error: 'Shared drill not found' }, { status: 404 });
    return NextResponse.json({ drill });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `A shared drill called “${parsed.drill.name}” already exists.` }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/admin/rep-teams/shared-drills/[drillId]' });
