import { NextResponse } from 'next/server';
import { getAuthContextWithScope, scopeGuard, unauthorized, forbidden } from '@/lib/api-auth';
import { canMoveClubMoney } from '@/lib/member-access';
import { paymentErrorResponse } from '@/lib/team-payments-server';
import { LOCKED_RESULTS } from '@/lib/tournament-status-words';
import { tournamentInOrg } from '@/lib/org-references';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { tournamentToday } from '@/lib/timezone';
import { withObservability } from '@/lib/observability';
import { closeTeamPayPages } from '@/lib/online-pay-pages';

/** One team's share of one transfer; far above any entry fee, far below the column's limit. */
const MOST_PER_TEAM = 1_000_000;

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ tournamentId: string }> }) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!canMoveClubMoney(ctx, ctx.org)) return forbidden();
  const { tournamentId } = await params;
  const outOfScope = scopeGuard(ctx, tournamentId);
  if (outOfScope) return outOfScope;
  if (!(await tournamentInOrg(ctx.org.id, tournamentId))) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  }
  // A finished event takes no new payment (the same lock the Teams screen's payments route holds).
  const { data: state } = await supabaseAdmin.from('tournaments').select('status').eq('id', tournamentId).maybeSingle();
  if (state?.status === 'completed') return NextResponse.json({ error: LOCKED_RESULTS }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const allocations = Array.isArray(body.allocations) ? body.allocations : [];
  if (allocations.length < 2 || allocations.length > 50 || allocations.some((a: unknown) => {
    const row = a as { teamId?: unknown; amount?: unknown };
    return typeof row?.teamId !== 'string' || !/^[0-9a-f-]{36}$/i.test(row.teamId)
      || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0.01 || Number(row.amount) > MOST_PER_TEAM;
  })) {
    return NextResponse.json({ error: 'Choose two or more teams and a positive amount for each.' }, { status: 400 });
  }
  const p_day = tournamentToday();
  const method = ['etransfer','cash','cheque','card','other'].includes(body.method) ? body.method : null;
  const reference = typeof body.reference === 'string' ? body.reference.trim().slice(0,500) : null;
  const { data, error } = await supabaseAdmin.rpc('club_tournament_shared_payment', {
    p_tournament: tournamentId,
    p_team_ids: allocations.map((a: { teamId: string }) => a.teamId),
    p_amounts: allocations.map((a: { amount: number }) => Math.round(Number(a.amount) * 100) / 100),
    p_actor: ctx.user.id, p_day, p_method: method, p_reference: reference,
  });
  if (error) return paymentErrorResponse(error, ctx.org.id, [p_day]);
  // 12d-1 (ask 12): every team on the shared transfer was recorded by hand, so their open pay pages close.
  await closeTeamPayPages(allocations.map((a: { teamId: string }) => a.teamId), 'a shared payment');
  return NextResponse.json({ receiptId: data });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/shared-payment' });
