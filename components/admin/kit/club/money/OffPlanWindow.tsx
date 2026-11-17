'use client';
/**
 * OFF-PLAN, LINE BY LINE — Budget vs. Actual's Off-plan tile opens this (Club Tier 13e B1; drawing tab 4, notes 1–2 and the
 * phone's 1–2; theme 4: "every figure opens its lines").
 *
 * One row per expense line the year's plan has no line for — its name, the category it sits under, "not planned", its
 * amount — and the Not filed row ("No budget word yet · file them on the Ledger"). The rows are `offPlanLines` over the
 * report's own statement: the same test and the same rows as the tile's figure (`offPlan`), so they add up to it by
 * construction (pinned in tests/unit/club-stage13e-b.test.ts). The title carries the total; there is no total row.
 *
 * Each row opens that line's ACTUAL window (`StatementBehindWindow`, which already holds "Open these lines in the
 * Ledger"). ⚠ NO LEDGER BUTTON HERE: the Ledger has no "off-plan" filter and must not gain one by guessing items across
 * categories. ⚠ Off-plan is SPENDING read from the plan and the Ledger — never the schedule's Bill window or a "being
 * billed" line (the several-permits plan: "13e … don't touch it").
 *
 * On a closed year the lines are locked: the Not filed row stops saying "file them" (the note's door reads "See them").
 * On a phone the shared window fills the screen; the sub-lines drop their second half (drawn so).
 */
import { ChevronRight } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import repKit from '../RepKit.module.css';
import type { CategoryResult, ItemResult } from '@/components/coaches/MoneyStatementRows';
import { NOT_FILED_ID } from '@/lib/club-ledger';
import { OFF_PLAN_WORDS } from '@/lib/club-money-words';
import { offPlanLines } from '@/lib/club-money-figures';
import { money } from './MoneyKit';
import cr from './ClubReport.module.css';

export default function OffPlanWindow({ yearName, total, categories, locked, onOpenLine, onClose }: {
  yearName: string;
  /** The tile's own figure — the title says it, and the rows add up to it. */
  total: number;
  /** The year's expense categories, as the statement reads them (the tile's own rows). */
  categories: readonly CategoryResult[];
  /** A closed year: its lines are locked, so nothing here says "file". */
  locked: boolean;
  onOpenLine: (item: ItemResult, categoryName: string) => void;
  onClose: () => void;
}) {
  const lines = offPlanLines(categories);
  return (
    <KitDialog
      kind="form"
      eyebrow={OFF_PLAN_WORDS.eyebrow(yearName)}
      title={OFF_PLAN_WORDS.title(total)}
      onClose={onClose}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>{OFF_PLAN_WORDS.done}</button>}
    >
      <p className={`${ck.hint} ${repKit.deskOnly}`}>{OFF_PLAN_WORDS.lead}</p>
      <div className={cr.windowRows}>
        {lines.map(({ category, item }) => {
          const notFiled = category.categoryId === NOT_FILED_ID;
          const name = item.itemName || category.categoryName;
          return (
            <button key={`${category.categoryId ?? ''}|${item.itemId ?? ''}|${name}`} type="button" className={cr.windowRow}
              aria-haspopup="dialog" onClick={() => onOpenLine(item, category.categoryName)}>
              <span className={cr.windowRowMain}>
                <span className={cr.windowRowTitle}>{name}</span>
                {notFiled ? (
                  <span className={`${cr.windowRowSub} ${cr.offPlanNotFiled}`}>
                    {OFF_PLAN_WORDS.notFiled}
                    {!locked && <span className={repKit.deskOnly}>{OFF_PLAN_WORDS.notFiledMore}</span>}
                  </span>
                ) : (
                  <span className={cr.windowRowSub}>
                    {category.categoryName}<span className={repKit.deskOnly}>{OFF_PLAN_WORDS.notPlannedMore}</span>
                  </span>
                )}
              </span>
              <span className={cr.windowRowEnd}>{money(item.actual)}</span>
              <ChevronRight size={16} aria-hidden className={cr.windowRowEnd} />
            </button>
          );
        })}
      </div>
    </KitDialog>
  );
}
