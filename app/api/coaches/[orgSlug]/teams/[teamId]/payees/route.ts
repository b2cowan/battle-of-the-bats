import { NextResponse } from 'next/server';
import { createOrgPayee } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { NO_MONEY_ACCESS, canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { listTeamPayees, searchTeamPayees } from '@/lib/team-payees';

/**
 * GET ?q=      — the team's payee picker: the club's SHARED payees (`scope: 'club'`) + the team's own
 *                (`scope: 'team'`); a standalone team's every payee is its own (Ledger Parity D7, mig 316).
 * GET ?all=1   — the team's Payees page (D5): `{ payees, shared }` — its own payees with uses and last used
 *                from THIS team's records only, and the shared club payees by name (read-only; merge targets).
 * POST { name, notes? } — a new payee, always the team's own.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), NO_MONEY_ACCESS);
  if (denied) return denied;

  const url = new URL(req.url);
  if (url.searchParams.get('all') === '1') {
    return NextResponse.json(await listTeamPayees(ctx.org, teamId));
  }
  const payees = await searchTeamPayees(ctx.org, teamId, url.searchParams.get('q') ?? '');
  return NextResponse.json({ payees });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payees' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), NO_MONEY_ACCESS);
  if (denied) return denied;

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const notes: string | null = typeof body.notes === 'string' ? body.notes.trim() || null : null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 });

  try {
    // Coaches always create team-scoped payees
    const payee = await createOrgPayee({ orgId: ctx.org.id, teamId, name, notes, createdBy: ctx.user.id });
    return NextResponse.json({ payee }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: 'A payee with that name already exists for this team' }, { status: 409 });
    throw e;
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/payees' });
