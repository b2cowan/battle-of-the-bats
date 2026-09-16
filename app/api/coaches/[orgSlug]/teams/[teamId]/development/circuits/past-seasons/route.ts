import { NextResponse } from 'next/server';
import { resolveCoachTeamAssignment } from '@/lib/coach-route-context';
import { getPastSeasonPracticePlans, getRepTeamCircuits } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canWritePracticePlans, canReadPastPracticePlans } from '@/lib/coach-capabilities';
import { blockToCircuitShape, circuitLine } from '@/lib/rep-circuits';

/**
 * "Bring a circuit forward from a past season" — the archive ruling made concrete for the third
 * size of reusable thing (practices re-evaluation stage 4, L9).
 *
 * ⚠ **A cross-season READ that writes nothing into a finished season**, exactly like its drill and
 * plan-template siblings, and deliberately NOT on `resolveCoachTeamRead` for the same reason: that
 * resolver answers with ONE season and this route reads across all of them, into the LIVE library.
 * ENUMERATED in the guard test's `CROSS_SEASON_PLAN_READERS` through the named read it calls.
 *
 * ⚠ Needs BOTH the library write (`canWritePracticePlans`) and the look-back read
 * (`canReadPastPracticePlans`) — everything this list can do is feed a library write.
 *
 * ⚠ It offers past plans' MULTI-STATION BLOCKS by title, deduplicated by name (newest wording
 * wins; older ones are counted, never merged). A one-station or bare block is a drill's import,
 * offered on the Drills tab — the same activity is never offered in two sizes.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  const resolved = await resolveCoachTeamAssignment(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(
    canWritePracticePlans(assignment.capabilities) && canReadPastPracticePlans(assignment.capabilities),
    'Managing circuits needs Schedule: View + edit. Ask your head coach.',
  );
  if (denied) return denied;

  const [pastPlans, circuits] = await Promise.all([
    // The LIVE season is excluded in the READ — this season's circuit is reachable through "Save
    // to my circuits…" on the block itself.
    getPastSeasonPracticePlans(teamId).catch(() => []),
    getRepTeamCircuits(teamId, { includeRetired: true }).catch(() => []),
  ]);

  const have = new Set(circuits.map(c => c.name.trim().toLowerCase()));

  const byName = new Map<string, {
    key: string; name: string; block: ReturnType<typeof blockToCircuitShape>;
    line: string; planCount: number; lastPlannedAt: string | null; alreadyInLibrary: boolean;
  }>();

  // Newest first, so the FIRST time a name is seen carries the shape worth keeping.
  const ordered = [...pastPlans].sort((a, b) => (b.startsAt ?? '').localeCompare(a.startsAt ?? ''));
  for (const row of ordered) {
    for (const block of row.plan?.blocks ?? []) {
      if ((block.stations?.length ?? 0) < 2) continue;
      const name = block.title.trim();
      if (!name) continue;
      const key = name.toLowerCase();

      const seen = byName.get(key);
      if (seen) { seen.planCount += 1; continue; }

      // Emptied of people on the way out, so the client never holds a roster it has no business
      // with and cannot post one back.
      const shape = blockToCircuitShape(block);
      byName.set(key, {
        key,
        name,
        block: shape,
        line: circuitLine(shape),
        planCount: 1,
        // ⚠ "last planned", never "last run" — the practice the plan was written FOR.
        lastPlannedAt: row.startsAt,
        alreadyInLibrary: have.has(key),
      });
    }
  }

  // Most-planned first, then alphabetical — the coach's own staples. Orders BLOCKS, never people.
  const importable = [...byName.values()]
    .sort((a, b) => b.planCount - a.planCount || a.name.localeCompare(b.name));

  return NextResponse.json({ circuits: importable });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/circuits/past-seasons' });
