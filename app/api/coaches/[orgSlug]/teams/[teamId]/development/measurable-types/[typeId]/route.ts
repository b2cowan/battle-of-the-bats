import { NextResponse } from 'next/server';
import { getRepTeamMeasurableType, updateRepTeamMeasurableType, repTeamMeasurableTypeHasReadings } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamAssignment as resolveContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteDevelopment, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readMeasurableTypeInput, applyDefinitionPatch } from '@/lib/development-input';
import { successorSentence } from '@/lib/measurable-definition';

/** The definition and whether any reading points at it — independent reads, one round trip. */
const readDefinition = (typeId: string, teamId: string) =>
  Promise.all([getRepTeamMeasurableType(typeId, teamId), repTeamMeasurableTypeHasReadings(typeId, teamId)]);

/** One definition, with whether any reading points at it — the editor's read. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  // One definition, read by its editor page only — behind the Development grant, like the room (D5).
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  const [type, hasReadings] = await readDefinition(typeId, teamId);
  if (!type) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
  return NextResponse.json({ type, hasReadings, canWrite: canWriteDevelopment(resolved.assignment.capabilities) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]' });

/**
 * Edit a definition in place — rename, aim, range, method, attempts, headline, descriptors,
 * retire, restore.
 *
 * ⚠ THE SUCCESSOR RULE IS ENFORCED HERE (owner ruling 3, 2026-09-11; narrowed to the unit
 * 2026-09-14 — the method is the coach's optional note and never forks a series): a unit
 * change on a test that has readings is REFUSED with a 409 that carries the offer — the merged
 * definition the successor would take — and the editor then asks the coach and
 * posts to `[typeId]/replace`. The rule is decided by `applyDefinitionPatch` (pure, tested); this
 * route only supplies "does it have readings" and turns the answer into a status.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const read = readMeasurableTypeInput(body, 'patch');
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: 400 });

  const [current, hasReadings] = await readDefinition(typeId, teamId);
  if (!current) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });

  const applied = applyDefinitionPatch(current, read.fields, hasReadings);
  if ('error' in applied) return NextResponse.json({ error: applied.error }, { status: 400 });
  if (applied.change.kind === 'successor') {
    return NextResponse.json({
      error: successorSentence(current.name),
      successor: { definition: applied.next },
    }, { status: 409 });
  }

  try {
    const type = await updateRepTeamMeasurableType(typeId, teamId, read.fields);
    if (!type) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    return NextResponse.json({ type });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'A metric with that name already exists.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]' });
