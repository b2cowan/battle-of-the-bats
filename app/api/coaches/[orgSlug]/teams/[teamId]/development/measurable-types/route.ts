import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeamMeasurableTypes,
  createRepTeamMeasurableType,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMeasurables, canWriteDevelopment } from '@/lib/coach-capabilities';

async function resolveContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  return { ctx, assignment };
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canViewMeasurables(resolved.assignment.capabilities), 'You do not have access to measurables.');
  if (denied) return denied;

  const includeRetired = new URL(req.url).searchParams.get('all') === '1';
  const types = await getRepTeamMeasurableTypes(teamId, { includeRetired });
  return NextResponse.json({ types });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage measurable types.');
  if (denied) return denied;

  let body: { name?: unknown; unit?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 40) {
    return NextResponse.json({ error: 'Name is required (max 40 characters).' }, { status: 400 });
  }
  const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
  if (!unit || unit.length > 20) {
    return NextResponse.json({ error: 'Unit is required (max 20 characters) — e.g. "seconds" or "mph".' }, { status: 400 });
  }

  try {
    const type = await createRepTeamMeasurableType({
      orgId: ctx.org.id, teamId, name, unit, createdBy: ctx.user.id,
    });
    return NextResponse.json({ type }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique index (active names, case-insensitive) → 409, matching the award-types UX.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'A measurable with that name already exists.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types' });
