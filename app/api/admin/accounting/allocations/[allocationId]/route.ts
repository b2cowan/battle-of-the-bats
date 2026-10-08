import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationDetail, loadClubLoop } from '@/lib/club-money-reads';
import { canMoveClubMoney } from '@/lib/member-access';
import { tournamentToday } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf, lockedIn } from '@/lib/club-fiscal-year';
import { orgDayKey } from '@/lib/timezone';

type Params = { params: Promise<{ allocationId: string }> };

/**
 * GET /api/admin/accounting/allocations/[allocationId]?orgSlug= — an allocation (specimen 3): its
 * four figures, and one bill per team (the teams that need the club first), each with its
 * installments' states and, once received or sent, the day, how, the reference and who.
 * `canMove` says whether this member may record, confirm or undo (Ask 1).
 *
 * ⚖ Stage 3c — THE FISCAL YEAR IT COUNTS IN, AND THE LOCK. `year` = { key, name, locked }: its line's fiscal year,
 * else the year its first installment falls due in. `canEdit`: the bill itself (its amounts, teams, due dates) may
 * change — never on a bill counting in a CLOSED year (Ask 1); its installments stay receivable whatever the year
 * (a bill still owed is the team's debt). Each received installment carries `received.locked`: its line sits in a
 * closed year, so Undo is not offered (Ask 8d — to undo it, reopen the year).
 */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const r = await resolveClubMoney(req, { scope: 'loop', write: false });
  if ('error' in r) return r.error;
  const { ctx } = r;
  const { allocationId } = await params;
  const today = tournamentToday();
  const loop = await loadClubLoop(ctx.org.id, await teamIdsInScope(ctx), { allocationId });
  const detail = await allocationDetail(ctx.org.id, loop, allocationId, today);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // The toolbar line names the budget line it came from ("budget line Diamond permits", specimen 3).
  let budgetLineName: string | null = null;
  let lineYearKey: string | null = null;
  const settingP = loadFiscalSetting(ctx.org.id);
  if (detail.allocation.sourceBudgetLineId) {
    const { data } = await supabaseAdmin.from('org_budget_lines').select('description, org_fiscal_years ( first_day )')
      .eq('id', detail.allocation.sourceBudgetLineId).eq('org_id', ctx.org.id).maybeSingle();
    const line = data as { description?: string | null; org_fiscal_years?: { first_day?: string } | null } | null;
    budgetLineName = line?.description ?? null;
    lineYearKey = line?.org_fiscal_years?.first_day ?? null;
  }
  const setting = await settingP;
  const firstDue = detail.teams.flatMap(t => t.installments.map(i => i.dueDate)).sort()[0] ?? null;
  const year = fiscalYearOf(lineYearKey ?? firstDue ?? orgDayKey(detail.allocation.createdAt), setting);
  const canMove = canMoveClubMoney(ctx, ctx.org);
  // A received installment whose line sits in a closed year: the year’s name, and Reopen’s (the bill room’s locked sentence).
  const teams = detail.teams.map(t => ({
    ...t,
    installments: t.installments.map(i => {
      if (!i.received) return i;
      const lockedInYear = lockedIn(i.received.on, setting, canMove);
      return { ...i, received: { ...i.received, locked: lockedInYear !== null, lockedIn: lockedInYear } };
    }),
  }));
  return NextResponse.json({
    asOf: today, canMove, canEdit: canMove && !year.locked, budgetLineName,
    year: { key: year.key, name: year.name, locked: year.locked },
    ...detail, teams,
  });
}, { route: '/api/admin/accounting/allocations/[allocationId]' });
