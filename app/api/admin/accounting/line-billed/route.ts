import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveClubMoney } from '@/lib/club-money-route';
import { teamIdsInScope } from '@/lib/club-team-route';
import { tournamentToday } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { readClubPlan } from '@/lib/club-budget-read';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf } from '@/lib/club-fiscal-year';
import { isUuid } from '@/lib/utils';
import type { LineBilled } from '@/lib/club-draft-bill';

/**
 * GET /api/admin/accounting/line-billed?orgSlug=&line= — what ACCOUNTING already bills on one budget line, for a schedule's
 * Bill window (Club Tier Stage 13d-4, Ask 4 A; drawing tab 4 notes 6-7): the mirror of New allocation's warning. The line
 * (its year, what's left — Not allocated, the one definition, read from the line's OWN year's plan), and each allocation
 * on it by name, amount and teams (the reader's groups named, the rest counted — B11). The Bill window reads it for the
 * line chosen, or for the permit's line when it isn't one it can offer, so it says so instead of switching to no line.
 * It WARNS: nothing here refuses a bill (the send's own `billBlockers` does that).
 * ⚖ One read so the several-permits build (owner 2026-11-13: after 13d) replaces the read, not the screen.
 * → 200 `{ billed: LineBilled | null }` (null: the line isn't the club's, or is no cost line).
 */
export const GET = withObservability(async (req: Request) => {
  const gate = await resolveClubMoney(req, { scope: 'books', write: false });
  if ('error' in gate) return gate.error;
  const { ctx } = gate;
  const lineId = new URL(req.url).searchParams.get('line');
  if (!isUuid(lineId)) return NextResponse.json({ error: 'Pick a budget line.' }, { status: 400 });

  const [{ data: row, error }, setting] = await Promise.all([
    supabaseAdmin.from('org_budget_lines')
      .select('id, org_fiscal_years ( first_day )').eq('id', lineId).eq('org_id', ctx.org.id).maybeSingle(),
    loadFiscalSetting(ctx.org.id),
  ]);
  if (error) throw error;
  const firstDay = (row?.org_fiscal_years as { first_day?: string } | null)?.first_day;
  if (!row || !firstDay) return NextResponse.json({ billed: null });

  const today = tournamentToday();
  const year = fiscalYearOf(firstDay, setting);
  const plan = await readClubPlan(ctx.org.id, year, setting, today, teamIdsInScope(ctx));
  const line = plan.expenses.categories.flatMap(c => c.lines).find(l => l.id === lineId);
  if (!line) return NextResponse.json({ billed: null });
  const billed: LineBilled = {
    line: {
      id: line.id, description: line.description, yearName: year.name, left: line.notAllocated ?? 0,
      closed: year.locked, thisYear: fiscalYearOf(today, setting).key === year.key,
    },
    allocations: line.allocations.map(a => ({ name: a.description, amount: a.allocated, teamNames: a.teamNames, otherTeams: a.otherTeams })),
  };
  return NextResponse.json({ billed });
}, { route: '/api/admin/accounting/line-billed' });
