'use client';
/**
 * THE CLUB'S BUDGET, LISTED (Club Tier Stage 3b, session 2 — hub specimen 1, "The Budget, the coach's
 * grammar with the club's billing in it"; Asks 2, 4b, 5).
 *
 * The coach's plan list, drawn in the coach's own classes (its money grid and its plan table), with the
 * club's one difference — billing teams — built into the line:
 *   · REVENUE FIRST (owner decisions A–E, 2026-09-12), From the teams leading it: nobody types it, it is the
 *     Allocated column's total read as income, and it opens the allocations it adds up (as the coach's
 *     Player installments row opens Player Dues). Below it the club's own income, ONE SECTION PER CATEGORY
 *     (the category is the shelf, 2026-09-09), in the coach's money-in green.
 *   · Planned · Allocated · Collected — Allocated and Collected BLANK on a line the club pays itself and on
 *     the whole revenue band (the blank money cell, 3a's Ask 5d): what the teams were billed and have paid
 *     shows ONCE, on the cost lines it was billed from. A partly billed line says what is not allocated
 *     UNDER its name, never as a column — it only matters on that line.
 *   · NO ROW COUNTS ITS LINES (owner 2026-09-04, guarded on the coach's side) — only From the teams counts
 *     its allocations, as drawn.
 *   · The name is the row's door (a real button), the whole row opens, one chevron at the end, no control
 *     in a cell (the table standard as amended 2026-09-29). A category row folds — right while folded,
 *     down while open — and starts open (the coach's closed-set rule: a new category arrives showing).
 *   · The plan closes on the coach's three rows: the year's opening balance (worked out from the books —
 *     Ask 5), its net, its closing balance — red brackets only below zero (a balance's rule).
 *   · On a phone it is the coach's scrolling table under pinned names, the When column riding under each
 *     line's name, categories kept as rows.
 *
 * ⚠ NO FIGURE IS COMPUTED HERE: every sum is the server's (`ClubPlan`, lib/club-budget-report.ts, every
 * figure one function in lib/club-money-figures.ts). Under the When filter the two totals SUM A SLICE and
 * wear the coach's "Revenue shown" / "Expenses shown" — a slice may not wear the plan's name.
 */
import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import { balanceFigure } from '@/components/coaches/MoneyPeriodGrid';
import { PLAN_LADDER_LABEL } from '@/lib/coach-budget-totals';
import { REVENUE_EMPTY_PROMPT, whenSummary } from '@/lib/coach-budget-periods-view';
import { FROM_THE_TEAMS_WORD, netForYearWord, notAllocatedCaption, openingBalanceRowWord } from '@/lib/club-money-words';
import { clubYearSpan, sumMoney } from '@/lib/club-money-figures';
import type { ClubPlan, ClubPlanPeriod, PlanCategory, PlanLineRow } from '@/lib/club-budget-report';
import { money } from './MoneyKit';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import bud from '@/app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/budget.module.css';
import cr from './ClubReport.module.css';

export type WhenFilter = 'all' | 'undated' | 'dated';

/** Does a line carry money with no date? (The When pill's question — the coach's `whenSummary`.) */
export const lineHasUndated = (l: { periods: readonly ClubPlanPeriod[]; planned: number }) =>
  whenSummary(l.periods.map(p => ({ periodDate: p.date, amount: p.amount })), l.planned).undated > 0.005;

/** A category's fold key — the one the list's closed set holds. */
const keyOf = (c: PlanCategory) => `${c.direction}|${c.categoryId ?? c.categoryName}`;

/** Every category the List SHOWS, both sides — Collapse all's set (the coach's section-level fold). Only what the When
 *  filter leaves on screen, as the coach's: a hidden category counted here would keep the label on "Collapse all"
 *  after every visible one had folded. */
export const planFoldKeys = (plan: ClubPlan, when: WhenFilter): string[] =>
  [...plan.revenue.categories, ...plan.expenses.categories].filter(c => c.lines.some(l => passes(l, when))).map(keyOf);

const passes = (l: PlanLineRow, f: WhenFilter) => f === 'all' || (f === 'undated' ? lineHasUndated(l) : !lineHasUndated(l));

/** A line's answer to "when does this money move?", in the coach's words and two inks (WhenChip's). */
function WhenChip({ periods, total, className }: { periods: readonly ClubPlanPeriod[]; total: number; className?: string }) {
  const s = whenSummary(periods.map(p => ({ periodDate: p.date, amount: p.amount })), total);
  if (s.months.length === 0) return <span className={`${bud.whenChip} ${bud.whenChipNone} ${className ?? ''}`}>No date yet</span>;
  return (
    <span className={`${bud.whenChip} ${bud.whenChipSet} ${className ?? ''}`}>
      {s.months.join(' · ')}
      {s.undated > 0.005 && <> · <span className={bud.whenChipPart}>{money(s.undated)} no date</span></>}
    </span>
  );
}

const sumOf = (xs: readonly number[]) => sumMoney(xs.map(amount => ({ amount })));

export default function BudgetPlanList({ plan, when, closed, onToggle, onOpenLine, onOpenTeams }: {
  plan: ClubPlan;
  when: WhenFilter;
  /** The categories folded shut (the coach's closed-set: a new category arrives open). */
  closed: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onOpenLine: (lineId: string) => void;
  onOpenTeams: () => void;
}) {
  const L = PLAN_LADDER_LABEL;
  const filtered = when !== 'all';
  const cats = (list: readonly PlanCategory[]) => list
    .map(c => ({ c, lines: c.lines.filter(l => passes(l, when)) }))
    .filter(x => x.lines.length > 0);
  const revenue = cats(plan.revenue.categories);
  const expenses = cats(plan.expenses.categories);
  const teams = plan.revenue.fromTheTeams;
  const showTeams = !filtered && (teams.planned > 0.005 || teams.allocations.length > 0);
  const revenueShown = filtered ? sumOf(revenue.flatMap(x => x.lines.map(l => l.planned))) : plan.revenue.total;
  const expenseLines = expenses.flatMap(x => x.lines);
  const expensesShown = filtered ? sumOf(expenseLines.map(l => l.planned)) : plan.expenses.total;
  const allocatedShown = filtered ? sumOf(expenseLines.map(l => l.allocated ?? 0)) : plan.expenses.allocated;
  const collectedShown = filtered ? sumOf(expenseLines.map(l => l.collected ?? 0)) : plan.expenses.collected;

  const empty = (n: number) => Array.from({ length: n }, (_, i) => <td key={i} />);

  const categoryRow = (c: PlanCategory, funding: boolean, figures: [number, number | null, number | null]) => {
    const key = keyOf(c);
    const open = !closed.has(key);
    return (
      <tr
        key={`cat-${key}`}
        className={`${shared.moneyGridCat} ${funding ? bud.fundingRow : ''} ${shared.rowTappable}`}
        onClick={() => { if (window.getSelection()?.toString()) return; onToggle(key); }}
      >
        <th scope="row" className={bud.lead}>
          <button type="button" className={shared.moneyGridToggle} aria-expanded={open}
            onClick={e => { e.stopPropagation(); onToggle(key); }}>
            {open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
            <span>{c.categoryName}</span>
          </button>
        </th>
        <td className={bud.schedCell} />
        <td className={funding ? bud.fundingAmount : undefined}>{money(figures[0])}</td>
        <td>{figures[1] == null ? '' : money(figures[1])}</td>
        <td>{figures[2] == null ? '' : money(figures[2])}</td>
        <td className={cr.goCell} />
      </tr>
    );
  };

  const lineRow = (l: PlanLineRow) => {
    const funding = l.direction === 'in';
    const billed = !funding && l.allocations.length > 0;
    const left = !funding && billed && (l.notAllocated ?? 0) > 0.005;
    return (
      <tr key={l.id} className={shared.rowTappable}
        onClick={() => { if (window.getSelection()?.toString()) return; onOpenLine(l.id); }}>
        <th scope="row" className={`${bud.lead} ${shared.moneyGridLead}`}>
          <span className={shared.moneyGridExpandSpacer} />
          <span className={bud.lineStack}>
            <span className={bud.lineName}>{l.description}</span>
            {left && <span className={cr.notAllocated}>{notAllocatedCaption(l.notAllocated ?? 0)}</span>}
            <WhenChip periods={l.periods} total={l.planned} className={bud.whenUnderName} />
          </span>
        </th>
        <td className={bud.schedCell}><WhenChip periods={l.periods} total={l.planned} /></td>
        <td className={funding ? bud.fundingAmount : undefined}>{money(l.planned)}</td>
        <td>{billed ? money(l.allocated) : ''}</td>
        <td>{billed ? money(l.collected) : ''}</td>
        <td className={cr.goCell}>
          <button type="button" className={`${shared.linkBtn} ${shared.listRowToggle}`} aria-haspopup="dialog"
            aria-label={`Open ${l.description}`} onClick={e => { e.stopPropagation(); onOpenLine(l.id); }}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </td>
      </tr>
    );
  };

  const firstDay = clubYearSpan(plan.year).first;

  return (
    <CoachScrollX sticky hint="Swipe the table to see Allocated and Collected">
      <table className={`${shared.moneyGrid} ${bud.planTable}`}>
        <thead>
          <tr>
            <th scope="col" className={bud.lead}>Category / line</th>
            <th scope="col" className={bud.schedCell} style={{ width: 170 }}>When</th>
            <th scope="col" style={{ width: 130 }}>Planned</th>
            <th scope="col" style={{ width: 130 }}>Allocated</th>
            <th scope="col" style={{ width: 130 }}>Collected</th>
            <th scope="col" className={cr.goCell}><span className={cr.srInCell}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {/* ── REVENUE: From the teams, then one section per money-in category, then its total. ── */}
          <tr className={shared.moneyGridBand}>
            <th scope="row" className={bud.lead}>{L.revenueBand}</th>
            <td className={bud.schedCell} />{empty(4)}
          </tr>
          {showTeams && (
            <tr className={`${bud.ladderRow} ${bud.fundingRow} ${shared.rowTappable}`}
              onClick={() => { if (window.getSelection()?.toString()) return; onOpenTeams(); }}>
              <th scope="row" className={bud.lead}>
                <button type="button" className={shared.moneyGridToggle} aria-haspopup="dialog"
                  onClick={e => { e.stopPropagation(); onOpenTeams(); }} title="See the allocations it adds up">
                  <span className={bud.lineStack}>
                    <span>{FROM_THE_TEAMS_WORD}</span>
                    <span className={cr.leadNote}>{teams.allocations.length} {teams.allocations.length === 1 ? 'allocation' : 'allocations'}</span>
                  </span>
                </button>
              </th>
              <td className={bud.schedCell}><WhenChip periods={teams.periods} total={teams.planned} /></td>
              <td className={bud.fundingAmount}>{money(teams.planned)}</td>
              <td /><td />
              <td className={cr.goCell}><ChevronRight size={16} aria-hidden /></td>
            </tr>
          )}
          {revenue.map(({ c, lines }) => (
            <Fragment key={keyOf(c)}>
              {categoryRow(c, true, [filtered ? sumOf(lines.map(l => l.planned)) : c.planned, null, null])}
              {!closed.has(keyOf(c)) && lines.map(lineRow)}
            </Fragment>
          ))}
          {!showTeams && revenue.length === 0 && (
            <tr>
              <td className={`${bud.lead} ${bud.planPrompt}`}>{filtered ? 'No revenue lines match this filter.' : REVENUE_EMPTY_PROMPT}</td>
              <td className={bud.schedCell} />{empty(4)}
            </tr>
          )}
          <tr className={`${shared.moneyGridTotal} ${bud.fundingRow}`}>
            <th scope="row" className={bud.lead}>{filtered ? L.revenueShown : L.totalRevenue}</th>
            <td className={bud.schedCell} />
            <td className={bud.fundingAmount}>{money(revenueShown)}</td>
            <td /><td /><td />
          </tr>

          {/* ── EXPENSES: by category, Planned · Allocated · Collected, then its total. ── */}
          <tr className={shared.moneyGridBand}>
            <th scope="row" className={bud.lead}>{L.expensesBand}</th>
            <td className={bud.schedCell} />{empty(4)}
          </tr>
          {expenses.map(({ c, lines }) => (
            <Fragment key={keyOf(c)}>
              {categoryRow(c, false, filtered
                ? [sumOf(lines.map(l => l.planned)), sumOf(lines.map(l => l.allocated ?? 0)), sumOf(lines.map(l => l.collected ?? 0))]
                : [c.planned, c.allocated ?? 0, c.collected ?? 0])}
              {!closed.has(keyOf(c)) && lines.map(lineRow)}
            </Fragment>
          ))}
          {expenses.length === 0 && (
            <tr>
              <td className={`${bud.lead} ${bud.planPrompt}`}>{filtered ? 'No expense lines match this filter.' : 'Add a line for what the club expects to spend.'}</td>
              <td className={bud.schedCell} />{empty(4)}
            </tr>
          )}
          <tr className={shared.moneyGridTotal}>
            <th scope="row" className={bud.lead}>{filtered ? L.expensesShown : L.totalExpenses}</th>
            <td className={bud.schedCell} />
            <td>{money(expensesShown)}</td>
            <td>{money(allocatedShown)}</td>
            <td>{money(collectedShown)}</td>
            <td />
          </tr>

          {/* ── THE CLOSE: the year's opening (worked out from the books, Ask 5) · its net · its closing.
              Only on the whole plan — a slice has no balance (the coach's rule). ── */}
          {!filtered && (
            <>
              <tr className={`${shared.moneyGridFlow} ${shared.moneyGridFlowFirst}`}>
                <th scope="row" className={bud.lead}>{openingBalanceRowWord(firstDay)}</th>
                <td className={bud.schedCell} /><td>{balanceFigure(plan.openingBalance, false)}</td><td /><td /><td />
              </tr>
              <tr className={shared.moneyGridFlow}>
                <th scope="row" className={bud.lead}>{netForYearWord(plan.year)}</th>
                <td className={bud.schedCell} /><td>{balanceFigure(plan.net, false)}</td><td /><td /><td />
              </tr>
              <tr className={`${shared.moneyGridFlow} ${bud.periodGridClosing}`}>
                <th scope="row" className={bud.lead}>{L.closingBalance}</th>
                <td className={bud.schedCell} /><td>{balanceFigure(plan.closingBalance, false)}</td><td /><td /><td />
              </tr>
            </>
          )}
        </tbody>
      </table>
    </CoachScrollX>
  );
}
