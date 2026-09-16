import { NextResponse } from 'next/server';
import {
  getRepTeamMeasurableType, updateRepTeamMeasurableType, deleteRepTeamMeasurableType, PLAN_CHANGED_WHILE_DELETING,
  repTeamMeasurableTypeHasReadings, repTeamMeasurableTypeHasRecords,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamAssignment as resolveContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteDevelopment, DEVELOPMENT_GRANT_MESSAGE } from '@/lib/coach-capabilities';
import { readMeasurableTypeInput, applyDefinitionPatch } from '@/lib/development-input';

/** The definition, whether any result points at it, and whether ANY record does — one round trip. */
const readDefinition = (typeId: string, teamId: string) =>
  Promise.all([getRepTeamMeasurableType(typeId, teamId), repTeamMeasurableTypeHasReadings(typeId, teamId), repTeamMeasurableTypeHasRecords(typeId, teamId)]);

/**
 * One definition — the editor's read. `hasReadings` fixes the unit; `hasRecords` (results,
 * observations or not-assessed marks) decides whether Delete is offered.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  // One definition, read by its editor page only — behind the Development grant, like the room (D5).
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  const [type, hasReadings, hasRecords] = await readDefinition(typeId, teamId);
  if (!type) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
  return NextResponse.json({ type, hasReadings, hasRecords, canWrite: canWriteDevelopment(resolved.assignment.capabilities) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]' });

/**
 * Edit a definition in place — rename, aim, range, method, attempts, headline, descriptors,
 * retire, restore.
 *
 * ⚠ THE UNIT IS FIXED ONCE A RESULT EXISTS (owner, 2026-09-15): a unit change on a test with
 * results is refused (400) — never applied, never forked into a linked successor. A coach who
 * wants a new unit retires this test and defines a new one. The rule is decided by
 * `applyDefinitionPatch` (pure, tested); this route only supplies "does it have results".
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

/**
 * Delete a definition nothing points at (owner, 2026-09-15). One with records — a result, an
 * observation, a not-assessed mark — is retired, never deleted: the check here draws the line the
 * sheet drew, and the RESTRICT FKs hold it against a record that lands in between (23503 → 409).
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; typeId: string }> },) => {
  const { orgSlug, teamId, typeId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canWriteDevelopment(resolved.assignment.capabilities), DEVELOPMENT_GRANT_MESSAGE);
  if (denied) return denied;

  const [current, , hasRecords] = await readDefinition(typeId, teamId);
  if (!current) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
  if (hasRecords) return NextResponse.json({ error: 'This metric has records — retire it instead.' }, { status: 409 });

  try {
    const gone = await deleteRepTeamMeasurableType(typeId, teamId);
    if (!gone) return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = typeof error === 'object' && error !== null ? (error as { code?: string; message?: string }) : {};
    if (err.code === '23503') {
      return NextResponse.json({ error: 'This metric has records — retire it instead.' }, { status: 409 });
    }
    if (err.message === PLAN_CHANGED_WHILE_DELETING) {
      return NextResponse.json({ error: 'A session plan changed while this was deleting — try again.' }, { status: 409 });
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/measurable-types/[typeId]' });
