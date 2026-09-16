import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import {
  getRepTeamCircuitById,
  getRepTeamCircuitUsage,
  updateRepTeamCircuit,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule, canWritePracticePlans } from '@/lib/coach-capabilities';
import { blockToCircuitShape, validateCircuitInput } from '@/lib/rep-circuits';
import { MAX_TAGS_PER_ITEM, uniqueIds } from '@/lib/rep-drills';

/**
 * One circuit — read it to edit, PATCH to rename, re-tag, rewrite the block, retire or restore
 * (practices re-evaluation stage 4, L9; the plan-template record route one block down).
 *
 * ⚠ **RETIRE, NEVER DELETE.** There is no DELETE verb and mig 302 grants no delete policy. Plans a
 * circuit was placed on are unaffected either way — a plan COPIES the block rather than referencing
 * it — but retiring keeps "Started 8 plans" readable and the provenance line on those plans true.
 *
 * ⚠ Live-season only, like its collection route: a circuit library is an INSTRUMENT.
 */
const resolveContext = resolveCoachTeamAssignment;

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; circuitId: string }> },) => {
  const { orgSlug, teamId, circuitId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  // A TARGETED usage read, not the library-wide walk the list route uses (the template's rule).
  const [circuit, use] = await Promise.all([
    getRepTeamCircuitById(circuitId, teamId),
    getRepTeamCircuitUsage(circuitId, teamId).catch(() => ({ planCount: 0, lastPlannedAt: null })),
  ]);
  if (!circuit) return NextResponse.json({ error: 'Circuit not found' }, { status: 404 });

  return NextResponse.json({
    circuit: { ...circuit, planCount: use.planCount, lastPlannedAt: use.lastPlannedAt },
    canWrite: canWritePracticePlans(assignment.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/circuits/[circuitId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; circuitId: string }> },) => {
  const { orgSlug, teamId, circuitId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWritePracticePlans(assignment.capabilities), 'Managing circuits needs Schedule: View + edit. Ask your head coach.');
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ⚠ Field-by-field, and every absent key means "leave it alone" — a retire must not blank the
  // name or the block, and a rename must not wipe the stations (the template route's line).
  const patch: Parameters<typeof updateRepTeamCircuit>[2] = {};

  if (body.name !== undefined) {
    const parsed = validateCircuitInput({ name: body.name });
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    patch.name = parsed.circuit.name;
  }
  // Emptied of people on the way in — a circuit carries the stations and the teaching, never the
  // roster (D20, one level down from a template).
  if (body.block !== undefined) patch.block = blockToCircuitShape(body.block);
  if (body.tagIds !== undefined) patch.tagIds = uniqueIds(body.tagIds, MAX_TAGS_PER_ITEM);
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  try {
    const circuit = await updateRepTeamCircuit(circuitId, { orgId: ctx.org.id, teamId }, patch);
    if (!circuit) return NextResponse.json({ error: 'Circuit not found' }, { status: 404 });
    return NextResponse.json({ circuit });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: `You already have a circuit called “${patch.name ?? ''}”.` },
        { status: 409 },
      );
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/circuits/[circuitId]' });
