import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * Copy one season's budget plan onto another — every line, its period split with dates shifted a
 * season, and (since mig 274) the split mode the coach built each split in.
 *
 * ⚠ EXTRACTED from `rep-season-rollover.ts` (budget tab revamp §6.3, 2026-09-02) because a second
 * caller now exists: the empty-plan "Bring last season's plan" door (owner Q8b), for the coach who
 * declined the carry at rollover and changed their mind in October. Two copies of this block would
 * have been two places to re-learn the line_kind lesson below.
 *
 * Per-line resilience, not all-or-nothing: one bad line is counted in `failed` and the rest still
 * carry — the shape the rollover has always had, because a 30-line plan losing one line loudly
 * beats losing thirty silently.
 */

/** Shift a 'YYYY-MM-DD' date forward by `delta` years, clamping Feb 29 -> Feb 28 in non-leap years.
 *  Carried fee/budget dates are otherwise absolute and would land in the past on a season roll. */
export function shiftDateYears(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const newYear = y + delta;
  const daysInMonth = new Date(newYear, m, 0).getDate(); // m is 1-based; day 0 = last day of month m
  const newDay = Math.min(d, daysInMonth);
  return `${newYear}-${String(m).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
}

export interface BudgetCarrySummary {
  linesCopied: number;
  periodsCopied: number;
  failed: number;
}

type BudgetLineRow = {
  id: string;
  category_id: string | null;
  item_id: string | null;
  description: string;
  total_amount: number;
  /** ⚠ Carried, never defaulted. Omitting it let the column default win, which silently
   *  reclassified every EXPECTED-FUNDING line as a COST in the new season — money the team
   *  planned to raise came back as money it planned to spend, doubling the season total and
   *  the dues generated from it, with nothing on screen to reveal it. A write path, so the
   *  damage was permanent and invisible without a DB audit. */
  line_kind: string | null;
  /** Carried too (mig 274) — a remembered split must not forget how it was built on the way
   *  into a new season. */
  split_mode: string | null;
  notes: string | null;
  sort_order: number;
};

type BudgetPeriodRow = {
  period_label: string;
  period_date: string | null;
  amount: number;
  sort_order: number;
};

export async function carryBudgetPlan(args: {
  orgId: string;
  teamId: string;
  fromProgramYearId: string;
  toProgramYearId: string;
  /** How many years forward the period dates move (usually 1; 0 is legal and copies verbatim). */
  yearDelta: number;
}): Promise<BudgetCarrySummary> {
  const summary: BudgetCarrySummary = { linesCopied: 0, periodsCopied: 0, failed: 0 };

  // org+team re-asserted in the WHERE alongside the year (check-then-act, standing memory) —
  // a program-year id alone trusts the caller to have scoped it.
  const { data: oldLines } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('*')
    .eq('program_year_id', args.fromProgramYearId)
    .eq('org_id', args.orgId)
    .eq('team_id', args.teamId)
    .order('sort_order');

  /* ⚠ NO ONE-WORD-ONE-LINE GUARD HERE, AND THAT IS A FACT ABOUT THE CALLERS (owner ruling
     2026-09-09, migration 286). Both of them copy into an EMPTY plan: the rollover mints the
     program year first, and "bring last season's plan" 409s unless the target has no lines. The
     source cannot hold twins either — the unique index covers every season, not just the current
     one. If a third caller ever copies into a plan that already has words, it must skip the words
     already there; until then a guard here would be code no path can reach. A collision would
     still be caught, as a `failed` line rather than a silent twin. */
  for (const line of (oldLines ?? []) as BudgetLineRow[]) {
    try {
      const { data: newLine, error: lineErr } = await supabaseAdmin
        .from('rep_budget_lines')
        .insert({
          org_id: args.orgId,
          team_id: args.teamId,
          program_year_id: args.toProgramYearId,
          category_id: line.category_id ?? null,
          item_id: line.item_id ?? null,
          description: line.description,
          total_amount: line.total_amount,
          line_kind: line.line_kind ?? 'cost',
          split_mode: line.split_mode ?? null,
          notes: line.notes ?? null,
          sort_order: line.sort_order ?? 0,
        })
        .select('id')
        .single();
      if (lineErr || !newLine) { summary.failed++; continue; }
      summary.linesCopied++;

      const { data: oldPeriods } = await supabaseAdmin
        .from('rep_budget_periods')
        .select('*')
        .eq('budget_line_id', line.id)
        .order('sort_order');
      const periodRows = ((oldPeriods ?? []) as BudgetPeriodRow[]).map(pd => ({
        budget_line_id: newLine.id as string,
        period_label: pd.period_label,
        period_date: pd.period_date ? shiftDateYears(pd.period_date, args.yearDelta) : null,
        amount: pd.amount,
        sort_order: pd.sort_order ?? 0,
      }));
      if (periodRows.length > 0) {
        const { data: createdPeriods, error: pErr } = await supabaseAdmin
          .from('rep_budget_periods')
          .insert(periodRows)
          .select('id');
        if (pErr) summary.failed++; // a line copied without its period breakdown — flag it, don't lose it silently
        else summary.periodsCopied += createdPeriods?.length ?? 0;
      }
    } catch (e) {
      summary.failed++;
      console.error('[rep-budget-carry] budget line carry failed:', e);
    }
  }

  return summary;
}
