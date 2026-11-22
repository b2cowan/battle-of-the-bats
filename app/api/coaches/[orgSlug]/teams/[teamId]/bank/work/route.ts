import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { denyUnless, canWriteMoney } from '@/lib/coach-capabilities';
import { bankBody } from '@/lib/bank-club-steps';
import { openTeamAccount, teamBankCaller } from '@/lib/bank-coach-steps';
import { teamAccountOf } from '@/lib/bank-coach-read';
import { teamCanSave } from '@/lib/bank-coach-work';
import { isWorkWorthKeeping, readWorkBody } from '@/lib/bank-check-work';
import { discardWork, keepWork, readWork, workRefused } from '@/lib/bank-check-work-server';

type Params = { params: Promise<{ orgSlug: string; teamId: string }> };
const MONEY_WRITE = 'You do not have permission to change team finances. Ask the head coach to grant it.';

/**
 * A BANK CHECK IN PROGRESS on the team's account (S7, plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18; lib/bank-check-work). Every
 * handler asks the check route's own gate first: the team's LIVE season (no live season, refused: CLAUDE.md's season gate),
 * then money write (a view-only coach gets no card, and no work).
 *
 * GET    — { mine, colleagues }: the caller's own work and colleagues' quiet lines (who, date, changed: nothing more).
 *          No team account yet: nothing.
 * PUT    { work, revision } — keep it (kept as you go; Save for later): { saved } with `endsOn`, or `work_changed` (409),
 *          or `bad_work` (400). The first keep makes the team's account when none exists (the first save's own step; an
 *          account with no check reads as none).
 * DELETE — Start over: the caller's work goes.
 */
export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), MONEY_WRITE);
  if (denied) return denied;
  const c = teamBankCaller(resolved);
  const account = await teamAccountOf(c.orgId, c.season.teamId);
  return NextResponse.json(await readWork({
    accountId: account?.id ?? null, me: c.actorId, orgId: c.orgId, canSave: teamCanSave(c.season.teamId, c.season.id),
  }));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/bank/work' });

export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), MONEY_WRITE);
  if (denied) return denied;
  const c = teamBankCaller(resolved);
  const body = readWorkBody(await bankBody(req));
  if (!body) return workRefused('bad_work');
  const found = await teamAccountOf(c.orgId, c.season.teamId);
  // Nothing worth keeping and no account: nothing to keep or discard, and no account made for it.
  if (!found && !isWorkWorthKeeping(body.work)) return NextResponse.json({ saved: null });
  const account = found ?? await openTeamAccount(c);
  const kept = await keepWork({ accountId: account.id, me: c.actorId, work: body.work, revision: body.revision });
  return kept.ok ? NextResponse.json({ saved: kept.saved }) : workRefused(kept.code);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/bank/work' });

export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), MONEY_WRITE);
  if (denied) return denied;
  const c = teamBankCaller(resolved);
  const account = await teamAccountOf(c.orgId, c.season.teamId);
  if (account) await discardWork(account.id, c.actorId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/bank/work' });
