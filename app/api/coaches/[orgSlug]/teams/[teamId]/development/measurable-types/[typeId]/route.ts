import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  updateRepTeamMeasurableType,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWriteDevelopment } from '@/lib/coach-capabilities';

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();

  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can manage measurable types.');
  if (denied) return denied;

  let body: { name?: unknown; unit?: unknown; isActive?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields: { name?: string; unit?: string; isActive?: boolean } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 40) {
      return NextResponse.json({ error: 'Name is required (max 40 characters).' }, { status: 400 });
    }
    fields.name = name;
  }
  if (body.unit !== undefined) {
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    if (!unit || unit.length > 20) {
      return NextResponse.json({ error: 'Unit is required (max 20 characters).' }, { status: 400 });
    }
    fields.unit = unit;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }
    fields.isActive = body.isActive;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const type = await updateRepTeamMeasurableType(typeId, teamId, fields);
    if (!type) return NextResponse.json({ error: 'Measurable type not found' }, { status: 404 });
    return NextResponse.json({ type });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'A measurable with that name already exists.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]' });
