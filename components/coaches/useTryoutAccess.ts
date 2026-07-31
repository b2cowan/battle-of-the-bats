'use client';
import { useCoaches } from '@/lib/coaches-context';
import { canManageTryouts } from '@/lib/coach-capabilities';

/**
 * ONE home for the tryout pages' client gate (Chunk E WI-11). The hub, the check-in sub-page,
 * and the score sub-page all ask the same security-relevant question; tripling the expression
 * is how one copy quietly rots.
 *
 * Semantics (deliberate, in one place):
 *  - WHILE assignments resolve → open (a real coach must never flicker into a "no access"
 *    wall; callers render their loading state anyway).
 *  - Once loaded, a missing assignment OR a missing tryouts grant → closed. The old inline
 *    fallback (`assignment ? check : true`) failed open PERMANENTLY for a coach with no
 *    assignment at all — the direct-URL case the gate exists for.
 * The server routes are the real gate either way; this is honesty, not security.
 */
export function useTryoutAccess(teamId: string): {
  ctxLoading: boolean;
  canTryouts: boolean;
  assignment: ReturnType<typeof useCoaches>['assignments'][number] | undefined;
} {
  const { assignments, loading: ctxLoading } = useCoaches();
  const assignment = assignments.find(a => a.teamId === teamId);
  const canTryouts = ctxLoading ? true : (assignment ? canManageTryouts(assignment.capabilities) : false);
  return { ctxLoading, canTryouts, assignment };
}
