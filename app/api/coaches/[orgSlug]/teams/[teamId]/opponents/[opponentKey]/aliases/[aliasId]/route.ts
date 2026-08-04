import { NextResponse } from 'next/server';
import { deleteRepTeamOpponentAlias } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteScoutingSummary } from '@/lib/coach-capabilities';

/**
 * Un-merge (P2): delete the alias and the two names regroup naturally on the next read —
 * observations logged while merged stay with the row they were attached to (plan §3;
 * re-pointing them apart again would be guessing which team each one meant). Nested under
 * `[opponentKey]` like every opponent sub-action (the observation DELETE precedent: the
 * alias id alone addresses the row, team-scoped).
 *
 * Caps `notes`, the same curation grant as the merge. Live-season route off the season
 * rail — INSTRUMENT ruling (coach-season-write-guard.test.ts).
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; opponentKey: string; aliasId: string }> },) => {
  const { orgSlug, teamId, aliasId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { assignment } = resolved;
  const denied = denyUnless(canWriteScoutingSummary(assignment.capabilities), 'Only coaches with notes access can un-merge opponents.');
  if (denied) return denied;

  const removed = await deleteRepTeamOpponentAlias(teamId, aliasId);
  if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/opponents/[opponentKey]/aliases/[aliasId]' });
