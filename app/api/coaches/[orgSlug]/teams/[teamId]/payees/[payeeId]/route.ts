import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { NO_MONEY_ACCESS, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { moveRefused } from '@/lib/club-money-route';
import { deleteTeamPayee, renameTeamPayee } from '@/lib/team-payees';
import type { Organization } from '@/lib/types';

type Params = { params: Promise<{ orgSlug: string; teamId: string; payeeId: string }> };

/** A coach of THIS team, on its live season, who may write its money — or the refusal. */
async function resolveWriter(
  params: Params['params'],
): Promise<{ error: Response } | { org: Organization; teamId: string; payeeId: string }> {
  const { orgSlug, teamId, payeeId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return { error: resolved.error };
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), NO_MONEY_ACCESS);
  if (denied) return { error: denied };
  return { org: resolved.ctx.org, teamId, payeeId };
}

/**
 * PATCH { name } — rename one of the team's own payees (Ledger Parity D5). A shared club payee refuses
 * (403 `not_allowed` — the club's to change); another team's or an unshared club payee is 404; a name the
 * team's own list already holds is 409 `payee_exists` (merge them instead).
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const w = await resolveWriter(params);
  if ('error' in w) return w.error;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await renameTeamPayee(w.org, w.teamId, w.payeeId, body.name);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ payee: out.payee });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payees/[payeeId]' });

/** DELETE — only one of the team's own payees that no record names (409 `payee_in_use`; merge it instead). */
export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const w = await resolveWriter(params);
  if ('error' in w) return w.error;
  const out = await deleteTeamPayee(w.org, w.teamId, w.payeeId);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ deleted: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payees/[payeeId]' });
