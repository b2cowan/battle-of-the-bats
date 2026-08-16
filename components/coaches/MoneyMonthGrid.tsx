'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, X, CalendarClock } from 'lucide-react';
import CoachScrollX from '@/components/coaches/CoachScrollX';
import {
  buildCashFlow, lensCell, lensTotal, lensReadsPlan, formatMonthLabel, formatMonthLong,
  type MonthGrid, type MonthKey, type MoneyLens, type CashFlowRow,
} from '@/lib/coach-budget-months';
import { fmtCompact } from '@/lib/coach-money-summary';
import { moneySectionHref } from '@/lib/coach-money-links';
import { toggleKey } from '@/lib/toggle-key';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './MoneyMonthGrid.module.css';

export type { MoneyLens };

export const MONEY_LENSES: Array<{ id: MoneyLens; label: string; short: string }> = [
  { id: 'budget',     label: 'Budget',     short: 'Budget' },
  { id: 'scheduled',  label: 'Scheduled',  short: 'Sched.' },
  { id: 'actual',     label: 'Actual',     short: 'Actual' },
  { id: 'difference', label: 'Difference', short: 'Diff.' },
];

export interface CellDetailItem {
  id: string;
  description: string;
  date: string | null;
  amount: number;
  paid: boolean;
}

export interface MonthGridPayload {
  monthGrid: MonthGrid;
  cellDetails: Record<string, CellDetailItem[]>;
  moneyIn: { scheduled: Record<string, number>; actual: Record<string, number> };
  todayMonth: MonthKey;
  priorSeasonLabel: string | null;
}

function fmt(n: number) {
  return `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact money for a grid cell. Shared with the budget plan's period view — the two money grids
 *  had a copy each of the same formatter. */
const fmtCell = fmtCompact;

function fmtDay(d: string | null) {
  if (!d) return '';
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

/** The cash-flow strip's three rows — same columns as the grid, so they read as part of it. */
const CASH_ROWS: Array<{
  key: string;
  label: string;
  value: (r: CashFlowRow) => number;
  /** The running balance is the one row where a negative number is the point. */
  emphasis?: boolean;
}> = [
  { key: 'in',      label: 'Money in',        value: r => r.moneyIn },
  { key: 'out',     label: 'Money out',       value: r => r.moneyOut },
  { key: 'running', label: 'Running balance', value: r => r.running, emphasis: true },
];

function signClass(n: number): string {
  if (n > 0.005) return styles.pos;
  if (n < -0.005) return styles.neg;
  return '';
}

export default function MoneyMonthGrid({
  data,
  lens,
  base,
  canWrite,
  seasonQuery = '',
}: {
  data: MonthGridPayload;
  lens: MoneyLens;
  /** `/{orgSlug}/coaches/teams/{teamId}` — drill-ins link back into the pages that own the forms. */
  base: string;
  canWrite: boolean;
  /** The rendering page's season query (`''` or `'?year=<id>'`) — drill-ins from an archived
   *  season must stay in that season, not teleport the reader to the live one. */
  seasonQuery?: string;
}) {
  const { monthGrid: grid, cellDetails, moneyIn, todayMonth, priorSeasonLabel } = data;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<{ title: string; items: CellDetailItem[]; href: string; hrefLabel: string } | null>(null);

  const showPrior = priorSeasonLabel != null;
  const showUndated = grid.totals.undatedBudget > 0.005;
  // Undated budget only means anything under a lens that reads the plan.
  const undatedLive = lensReadsPlan(lens);

  // Cash flow follows the lens on screen — the plan under Budget, the commitments under Scheduled,
  // real spending under Actual — and never blends them, which is what keeps a planned estimate and
  // a commitment for the same cost from being counted twice. Meaningless under Difference.
  const cash = useMemo(() => {
    if (lens === 'difference') return null;
    const outByMonth: Record<string, number> = {};
    grid.months.forEach((m, i) => { outByMonth[m] = grid.totals.cells[i][lens]; });
    const inByMonth = lens === 'actual' ? moneyIn.actual : moneyIn.scheduled;
    return buildCashFlow(grid.months, inByMonth, outByMonth);
  }, [grid, lens, moneyIn]);

  function toggle(key: string) { setExpanded(prev => toggleKey(prev, key)); }

  function openDetail(kind: 'actual' | 'scheduled', categoryKey: string, categoryName: string, month: MonthKey) {
    const items = cellDetails[`${kind}|${categoryKey}|${month}`] ?? [];
    if (items.length === 0) return;
    setDetail({
      title: `${kind === 'actual' ? 'Paid in' : 'Due in'} ${formatMonthLong(month)} · ${categoryName}`,
      items,
      href: kind === 'actual'
        ? moneySectionHref(base, 'expenses', undefined, seasonQuery)
        : moneySectionHref(base, 'expenses', { tab: 'schedule' }, seasonQuery),
      hrefLabel: kind === 'actual' ? 'Open Expenses' : 'Open the payment schedule',
    });
  }

  /** One money cell. Becomes a link or a button only when there is genuinely something behind it. */
  function cellNode(
    value: number | null,
    opts: { onClick?: () => void; href?: string; title?: string; emphasis?: boolean } = {},
  ) {
    // ⚠ ONE MINUS SIGN. `fmtCell` already carries the sign; this also prepended a typographic
    // minus, so every negative rendered as "−-2,000" — two dashes. Only the running balance ever
    // goes negative, which is why it survived until the layout fixture gained budget data
    // (2026-08-13). The swap to the typographic minus stays, applied to the ONE sign there is.
    const text = value === null ? null : fmtCell(value)?.replace('-', '−');
    // Null = "nothing to say here" (a future month under Difference, a lens this row can't
    // answer); zero = "nothing happened". Both read as an em dash — a grid full of $0 is noise.
    if (text == null) return <span className={styles.nil}>—</span>;
    const body = <>{text}</>;
    const cls = `${styles.cellValue} ${opts.emphasis ? signClass(value!) : ''}`;
    if (opts.href) {
      return <Link href={opts.href} className={`${cls} ${styles.cellLink}`} title={opts.title}>{body}</Link>;
    }
    if (opts.onClick) {
      return <button type="button" className={`${cls} ${styles.cellLink}`} onClick={opts.onClick} title={opts.title}>{body}</button>;
    }
    return <span className={cls}>{body}</span>;
  }

  return (
    <div className={styles.wrap}>
      {/* A month grid is a COMPARISON, so it keeps its shape and scrolls with the line name
          pinned rather than stacking into cards (Chunk A D1/D2). */}
      <CoachScrollX sticky hint="Swipe the grid to see later months" className={styles.scroller}>
        {/* ⚠ `styles.grid` is NOT a no-op, however empty its own rule looks. It is the ancestor in
            `.grid thead th.lead` (the pinned header corner's stacking order) and in the two heading
            colours for the "No date yet" and current-month columns. Removing it silently unstyles
            three things a search for `.grid {` will not show you. */}
        <table className={`${shared.moneyGrid} ${styles.grid}`}>
          <thead>
            <tr>
              <th className={styles.lead}>Category / line</th>
              {showPrior && <th className={`${styles.num} ${styles.prior}`} title="Last season's plan">{priorSeasonLabel}</th>}
              {showUndated && <th className={`${styles.num} ${styles.undated}`}>No date yet</th>}
              {grid.months.map(m => (
                <th key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>{formatMonthLabel(m)}</th>
              ))}
              <th className={`${styles.num} ${styles.totalCol}`}>Total</th>
            </tr>
          </thead>

          <tbody>
            {grid.categories.map(cat => {
              const open = expanded.has(cat.categoryKey);
              const catTotal = lensTotal(cat.total, lens);
              return (
                <Fragment key={cat.categoryKey}>
                  <tr className={shared.moneyGridCat}>
                    <th scope="row" className={`${styles.lead} ${styles.catLead}`}>
                      <button
                        type="button"
                        className={shared.moneyGridToggle}
                        onClick={() => toggle(cat.categoryKey)}
                        aria-expanded={open}
                        disabled={cat.lines.length === 0}
                      >
                        {cat.lines.length === 0
                          ? <span className={shared.moneyGridChevronSpacer} aria-hidden />
                          : open ? <ChevronDown size={13} aria-hidden /> : <ChevronRight size={13} aria-hidden />}
                        <span className={shared.wrap640}>{cat.categoryName}</span>
                      </button>
                      {/* ⚠ THE "not in your plan" TAG WAS REMOVED HERE (owner ruling 2026-08-15).
                          A category with nothing budgeted and something actual has already said so
                          in its own figures; the words repeated what the reader could see. Its twin
                          on the Categories view ("not budgeted") went in the same change — one view
                          keeping a label the other dropped is the drift this report has been
                          consolidated twice to remove. */}
                    </th>
                    {showPrior && <td className={`${styles.num} ${styles.prior}`}>{cellNode(cat.priorTotal)}</td>}
                    {showUndated && (
                      <td className={`${styles.num} ${styles.undated}`}>
                        {cellNode(undatedLive && cat.undatedBudget > 0.005 ? cat.undatedBudget : null)}
                      </td>
                    )}
                    {grid.months.map((m, i) => {
                      const v = lensCell(cat.cells[i], lens, m, todayMonth);
                      const drillable = (lens === 'actual' || lens === 'scheduled')
                        && (cellDetails[`${lens}|${cat.categoryKey}|${m}`]?.length ?? 0) > 0;
                      return (
                        <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                          {cellNode(v, {
                            emphasis: lens === 'difference',
                            onClick: drillable ? () => openDetail(lens as 'actual' | 'scheduled', cat.categoryKey, cat.categoryName, m) : undefined,
                            title: drillable ? `See what makes up ${formatMonthLong(m)}` : undefined,
                          })}
                        </td>
                      );
                    })}
                    <td className={`${styles.num} ${styles.totalCol}`}>{cellNode(catTotal, { emphasis: lens === 'difference' })}</td>
                  </tr>

                  {open && cat.lines.map(line => (
                    <tr key={line.id} className={styles.lineRow}>
                      <th scope="row" className={`${styles.lead} ${shared.moneyGridLead}`}>
                        <span className={shared.wrap640}>{line.description}</span>
                      </th>
                      {showPrior && <td className={`${styles.num} ${styles.prior}`}>{cellNode(line.priorTotal)}</td>}
                      {showUndated && (
                        <td className={`${styles.num} ${styles.undated}`}>
                          {cellNode(undatedLive && line.undatedBudget > 0.005 ? line.undatedBudget : null, {
                            href: canWrite && undatedLive && line.undatedBudget > 0.005
                              ? moneySectionHref(base, 'budget', { line: line.id, periods: '1' }, seasonQuery)
                              : undefined,
                            title: canWrite ? 'Give this money a date' : undefined,
                          })}
                        </td>
                      )}
                      {grid.months.map((m, i) => {
                        // Only the BUDGET is known per line: actuals and commitments are matched to
                        // a category, not to a line (there is no payable↔line link, by design), so
                        // a line's actual cell honestly reads as "—" rather than inventing a split.
                        const v = lens === 'budget' ? line.cells[i].budget : null;
                        const canEdit = canWrite && lens === 'budget' && line.cells[i].budget > 0.005;
                        return (
                          <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                            {cellNode(v, {
                              href: canEdit ? moneySectionHref(base, 'budget', { line: line.id, periods: '1' }, seasonQuery) : undefined,
                              title: canEdit ? 'Edit this line’s payment dates' : undefined,
                            })}
                          </td>
                        );
                      })}
                      <td className={`${styles.num} ${styles.totalCol}`}>
                        {cellNode(lens === 'budget' ? line.total.budget : null)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}

            <tr className={`${shared.moneyGridTotal} ${styles.totalRow}`}>
              <th scope="row" className={styles.lead}>Total</th>
              {showPrior && <td className={`${styles.num} ${styles.prior}`}>{cellNode(grid.totals.priorTotal)}</td>}
              {showUndated && (
                <td className={`${styles.num} ${styles.undated}`}>
                  {cellNode(undatedLive ? grid.totals.undatedBudget : null)}
                </td>
              )}
              {grid.months.map((m, i) => (
                <td key={m} className={`${styles.num} ${m === todayMonth ? styles.thisMonth : ''}`}>
                  {cellNode(lensCell(grid.totals.cells[i], lens, m, todayMonth), { emphasis: lens === 'difference' })}
                </td>
              ))}
              <td className={`${styles.num} ${styles.totalCol}`}>
                {cellNode(lensTotal(grid.totals.total, lens), { emphasis: lens === 'difference' })}
              </td>
            </tr>

            {/* The cash-flow strip: three rows that share the grid's own columns, so a coach
                reads the plan and its consequence in one place instead of two widgets. */}
            {cash && CASH_ROWS.map((row, i) => (
              <tr key={row.key} className={`${shared.moneyGridFlow} ${i === 0 ? shared.moneyGridFlowFirst : ''} ${row.emphasis ? styles.runningRow : ''}`}>
                <th scope="row" className={styles.lead}>{row.label}</th>
                {showPrior && <td className={`${styles.num} ${styles.prior}`}><span className={styles.nil}>—</span></td>}
                {showUndated && <td className={`${styles.num} ${styles.undated}`}><span className={styles.nil}>—</span></td>}
                {cash.rows.map(r => (
                  <td key={r.month} className={`${styles.num} ${r.month === todayMonth ? styles.thisMonth : ''}`}>
                    {cellNode(row.value(r), { emphasis: row.emphasis })}
                  </td>
                ))}
                {/* A running balance has no meaningful sum across months — only its last value,
                    which is already the final column. */}
                <td className={`${styles.num} ${styles.totalCol}`}>
                  {row.emphasis ? <span className={styles.nil}>—</span> : cellNode(cash.rows.reduce((s, r) => s + row.value(r), 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CoachScrollX>

      {/* Every claim the grid makes about its own basis, in one place under it. */}
      <div className={styles.notes}>
        {cash && (
          <p className={styles.note}>
            Cash flow is projected with the <strong>{MONEY_LENSES.find(l => l.id === lens)?.label}</strong> lens
            {lens === 'budget' ? ' — your plan, not your commitments.' : lens === 'scheduled' ? ' — what you’ve committed to, not your plan.' : ' — money actually received and actually paid.'}
            {' '}Money in is player dues only; fundraiser rebates already credit dues, so counting both would count the same dollar twice.
            {showUndated && ` ${fmt(grid.totals.undatedBudget)} with no date yet isn’t in this projection.`}
          </p>
        )}
        {lens === 'difference' && (
          <p className={styles.note}>
            Difference is your plan minus what you’ve actually paid, for months that have already
            happened. A month still ahead shows “—” — money nobody has spent yet isn’t a saving.
          </p>
        )}
        {(lens === 'actual' || lens === 'scheduled') && (
          <p className={styles.note}>
            {lens === 'actual' ? 'Spending' : 'A commitment'} is matched to a <strong>category</strong>, not to
            an individual line, so line rows read “—” here. Tap a category’s figure to see what makes it up.
          </p>
        )}
        {grid.truncated && (
          <p className={styles.note}>
            Showing the first {grid.months.length} months. Anything dated outside them still counts in
            the Total column.
          </p>
        )}
      </div>

      {cash?.shortfall && (
        <div className={styles.shortfall}>
          <CalendarClock size={15} aria-hidden />
          <span>
            <strong>On this plan you go short in {formatMonthLong(cash.shortfall.month)} — about {fmt(cash.shortfall.amount)}.</strong>
            {' '}Move a payment, bring dues forward, or plan the gap.
          </span>
        </div>
      )}

      {grid.priorOnly.length > 0 && (
        <div className={styles.priorOnly}>
          <p className={styles.priorOnlyTitle}>In last season’s plan, not in this one</p>
          <ul className={styles.priorOnlyList}>
            {grid.priorOnly.map(p => (
              <li key={`${p.categoryName}-${p.description}`}>
                <span>{p.description}</span>
                <span className={styles.priorOnlyCat}>{p.categoryName}</span>
                <span className={styles.priorOnlyAmt}>{fmt(p.amount)}</span>
              </li>
            ))}
          </ul>
          <p className={styles.note}>Last season’s figures, for reference — not a suggestion for this one.</p>
        </div>
      )}

      {/* Drill-in: what a single Actual or Scheduled cell is made of. Read-only by design —
          the grid is a way to REACH the forms, never a second editor. Visible to read-only
          coaches, who can already see every number on this page. */}
      {detail && (
        <div className={`${shared.modalOverlay} ${shared.centeredOnMobile}`} onClick={() => setDetail(null)}>
          <div className={shared.modal} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className={shared.modalHeader}>
              <h3 className={shared.modalTitle}>{detail.title}</h3>
              <button className={shared.modalCloseBtn} onClick={() => setDetail(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <ul className={styles.detailList}>
              {detail.items.map(item => (
                <li key={item.id}>
                  <span className={styles.detailDesc}>
                    {item.description}
                    <span className={styles.detailMeta}>
                      {fmtDay(item.date)}{item.paid ? ' · paid' : ' · unpaid'}
                    </span>
                  </span>
                  <span className={styles.detailAmt}>{fmt(item.amount)}</span>
                </li>
              ))}
              <li className={styles.detailTotal}>
                <span>Total</span>
                <span className={styles.detailAmt}>{fmt(detail.items.reduce((s, i) => s + i.amount, 0))}</span>
              </li>
            </ul>
            <div className={shared.modalFooter}>
              <Link href={detail.href} className={shared.btnSecondary}>{detail.hrefLabel}</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
