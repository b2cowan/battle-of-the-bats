import { NextResponse } from 'next/server';
import { getRepTeamMeasurableType, repTeamMeasurableTypeHasReadings, replaceRepTeamMeasurableType } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import { denyUnless, canWriteDevelopment, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readMeasurableTypeInput } from '@/lib/development-input';
import { definitionChange } from '@/lib/measurable-definition';

/**
 * ═══ START A NEW DEFINITION AND RETIRE THIS ONE (owner ruling 3, 2026-09-11; unit only since 2026-09-14) ═══
 * The dedicated action the editor posts to after the PATCH refused a unit change on a
 * test with readings (409 with the offer). The body is the SUCCESSOR's whole definition — the same
 * shape a create takes — and the successor takes the predecessor's kind and name unless renamed.
 *
 * ⚠ Only for what the rule is for: the predecessor must be an ACTIVE measured test WITH readings,
 * and the posted definition must actually change its unit — anything else is an
 * ordinary edit and this route says so (400), because a "successor" that changes nothing the
 * readings care about would be a duplicate definition wearing a rule's name.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveCoachTeamAssignment(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Independent reads, one round trip: the definition, and whether any reading points at it.
  const [current, hasReadings] = await Promise.all([getRepTeamMeasurableType(typeId, teamId), repTeamMeasurableTypeHasReadings(typeId, teamId)]);
  if (!current) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
  if (!current.isActive) return NextResponse.json({ error: 'A retired definition cannot be replaced — restore it first, or define a new metric.' }, { status: 400 });
  if (current.kind !== 'test') return NextResponse.json({ error: 'Only a test starts a new definition — edit the skill directly.' }, { status: 400 });

  // The successor inherits the kind and, unless renamed, the name — so the body can be the edited
  // form as it stands, not a second copy of every field.
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const read = readMeasurableTypeInput({ ...raw, kind: current.kind, name: raw.name ?? current.name }, 'create');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const change = definitionChange(current, { unit: read.fields.unit }, hasReadings);
  if (change.kind !== 'successor') {
    return NextResponse.json({
      error: hasReadings
        ? 'Nothing about how this test is measured changed — edit it in place instead.'
        : 'This test has no results yet, so it can simply be edited.',
    }, { status: 400 });
  }

  try {
    const result = await replaceRepTeamMeasurableType({
      ...read.fields, predecessorId: typeId, orgId: ctx.org.id, teamId, createdBy: ctx.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null ? (error as { code?: string; message?: string }) : {};
    if (code.code === '23505') {
      return NextResponse.json({ error: 'A metric with that name already exists.' }, { status: 409 });
    }
    // The function's own refusals only fire on a race with another edit (the route checked the same
    // things a moment ago) — say so rather than 500.
    if (typeof code.message === 'string' && code.message.startsWith('replace_rep_team_measurable_type_')) {
      return NextResponse.json({ error: 'This definition changed while you were editing it — reload and try again.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]/replace' });
