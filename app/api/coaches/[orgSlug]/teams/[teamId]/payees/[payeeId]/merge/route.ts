import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { NO_MONEY_ACCESS, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { moveRefused } from '@/lib/club-money-route';
import { mergeTeamPayee } from '@/lib/team-payees';

type Params = { params: Promise<{ orgSlug: string; teamId: string; payeeId: string }> };

/**
 * POST { intoPayeeId } — merge one of the team's own payees into another of its own, or into a payee the club
 * shares (Ledger Parity D5/D7): every record of THIS team naming it moves to the one kept, and it is removed, in
 * one step (`team_payee_merge`, mig 316). The body is the club's own merge body, so one screen can serve both.
 * Refusals: 400 `same_payee` · 403 `not_allowed` (a shared club payee is the club's) · 404 (anything the team
 * cannot see) · 409 `named_elsewhere` (a record outside the team still names it).
 */
export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId, payeeId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), NO_MONEY_ACCESS);
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await mergeTeamPayee(resolved.ctx.org, teamId, payeeId, body.intoPayeeId);
  if (!out.ok) return moveRefused(out);
  return NextResponse.json({ moved: out.moved, into: out.into });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payees/[payeeId]/merge' });
