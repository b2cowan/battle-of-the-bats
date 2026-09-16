import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import {
  getRepTeamCircuits,
  createRepTeamCircuit,
  getRepTeamPracticePlansAcrossSeasons,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule, canWritePracticePlans } from '@/lib/coach-capabilities';
import {
  MAX_CIRCUITS_PER_TEAM, countCircuitUses, emptyCircuitBlock, validateCircuitInput,
} from '@/lib/rep-circuits';

/**
 * Circuits — a saved block WITH STATIONS, the third size of reusable thing (practices
 * re-evaluation stage 4, owner ruling L9, 2026-09-16; mig 302). Shaped like the plan-template
 * routes one block down, and gated exactly as they are:
 *
 * ── Capabilities (NO new capability key) ──
 *   READ  → `canManageSchedule` — "Schedule: View + edit", the same gate the drill and template
 *           libraries read on (a library is an instrument for whoever plans; the hub hides the tab
 *           for anyone else). A placed circuit's words reach a schedule-only assistant through the
 *           plan itself, which the plan GET serves on `schedule` alone.
 *   WRITE → `canWritePracticePlans` = "Schedule: View + edit" (R7). A circuit is the shape of a
 *           block, gated with the plans it feeds.
 * ⚠ RLS (mig 302) admits HEAD COACHES ONLY to writes — STRICTER than this gate, not a mirror of
 * it. Every write here goes through the service role, so the app never meets that rule; a direct
 * PostgREST call from an assistant's session is refused, which is the safe direction.
 *
 * ⚠ **THE ARCHIVE DOOR — decided, not discovered.** Deliberately NOT `resolveCoachTeamRead`: this
 * resolves the team's live context and cannot serve a past season. A circuit library is a reusable
 * INSTRUMENT (owner ruling 2026-08-01, applied to its third size). The table is keyed by TEAM, so a
 * team's circuits cross a rollover with nothing to import.
 *
 * ⚠ The ONE deliberate cross-season read is `getRepTeamPracticePlansAcrossSeasons`, which counts
 * how many plans each circuit has been placed on. It reads the team's own records and writes
 * nothing into a finished season — and it is ENUMERATED in the guard test's cross-season
 * plan-reader list (`CROSS_SEASON_PLAN_READERS`). A route gaining or losing it fails the build.
 */
const resolveContext = resolveCoachTeamAssignment;

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You do not have access to the schedule.');
  if (denied) return denied;

  const includeRetired = new URL(req.url).searchParams.get('all') === '1';

  const [circuits, plans] = await Promise.all([
    getRepTeamCircuits(teamId, { includeRetired }),
    // Non-fatal: losing the counts must not take the room down with them.
    getRepTeamPracticePlansAcrossSeasons(teamId).catch(() => []),
  ]);

  const uses = countCircuitUses(plans);
  return NextResponse.json({
    circuits: circuits.map(c => ({
      ...c,
      // ⚠ "Started N plans", never "used N×" — nothing records what was actually run (D4).
      planCount: uses.get(c.id)?.planCount ?? 0,
      lastPlannedAt: uses.get(c.id)?.lastPlannedAt ?? null,
    })),
    canWrite: canWritePracticePlans(assignment.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/circuits' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWritePracticePlans(assignment.capabilities), 'Managing circuits needs Schedule: View + edit. Ask your head coach.');
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ⚠ An empty NAME is rejected here and never in the plan editor — an explicit submit.
  const parsed = validateCircuitInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await getRepTeamCircuits(teamId, { includeRetired: true });
  if (existing.filter(c => c.isActive).length >= MAX_CIRCUITS_PER_TEAM) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_CIRCUITS_PER_TEAM} circuits. Retire one to add another.` },
      { status: 400 },
    );
  }

  try {
    const circuit = await createRepTeamCircuit({
      orgId: ctx.org.id,
      teamId,
      name: parsed.circuit.name,
      // `undefined` means "no shape supplied" — an empty circuit the coach is about to build in
      // its editor. `validateCircuitInput` has already emptied it of people either way.
      block: parsed.circuit.block ?? emptyCircuitBlock(),
      tagIds: parsed.circuit.tagIds,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ circuit: { ...circuit, planCount: 0, lastPlannedAt: null } }, { status: 201 });
  } catch (error: unknown) {
    // Partial unique index on ACTIVE names, case-insensitive → 409, matching the other libraries.
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json(
        { error: `You already have a circuit called “${parsed.circuit.name}”.` },
        { status: 409 },
      );
    }
    throw error;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/circuits' });
