import { NextResponse } from 'next/server';
import { getRepTeamMeasurableTypes, createRepTeamMeasurableType } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import { denyUnless, canViewMeasurables, canWriteDevelopment, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readMeasurableTypeInput } from '@/lib/development-input';

// The definition routes share ONE auth chain — the repo's shared home for it — rather than three
// hand-rolled copies (the /simplify pass, 2026-09-12).
const resolveContext = resolveCoachTeamAssignment;

/** The whole library — every definition, retired ones with `?all=1`. The Metrics tab reads this. */
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

/**
 * Define a metric (Phase 1, mockup screen 2): a measured test — name · unit · aim (with a range's
 * edges) · method · attempts per session · headline — or an observed skill with its descriptors.
 * ⚠ A bare `{ name, unit }` still creates (the session chip's "+ New test…" and the profile's
 * quick add are the unchanged idiom): it lands as a record-only test with no method, which the
 * Metrics tab then says out loud. The reader supplies those defaults; nothing is guessed here.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readMeasurableTypeInput(body, 'create');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  try {
    const type = await createRepTeamMeasurableType({
      ...read.fields, orgId: ctx.org.id, teamId, createdBy: ctx.user.id,
    });
    return NextResponse.json({ type }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique index (active names, case-insensitive) → 409, matching the award-types UX.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'A metric with that name already exists.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types' });
