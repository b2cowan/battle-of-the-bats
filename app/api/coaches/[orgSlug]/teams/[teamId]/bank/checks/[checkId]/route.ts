import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { moveRefused } from '@/lib/club-money-route';
import { bankRefusedAs } from '@/lib/bank-club-steps';
import { deleteTeamCheck, teamBankAnswer, teamBankCaller } from '@/lib/bank-coach-steps';
import { isUuid } from '@/lib/utils';

type Params = { params: Promise<{ orgSlug: string; teamId: string; checkId: string }> };

/**
 * DELETE — "Delete this check" (ask 5; the one question is BC7's): a saved check of the team's LIVE season. Its figures go
 * from the list; who deleted it and when are kept (a soft delete). Money write only; no live season, refused. A check of a
 * closed season is not on the working view (B10), so it is "not found".
 */
export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, checkId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;
  // A path id that isn't a uuid is "not found" before the database sees it (a 22P02 would be a 500).
  if (!isUuid(checkId)) return moveRefused(bankRefusedAs('check_not_found'));
  const caller = teamBankCaller(resolved);
  return teamBankAnswer(caller, await deleteTeamCheck(caller, checkId));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/bank/checks/[checkId]' });
