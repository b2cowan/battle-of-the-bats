'use client';
/**
 * WHAT IS BEHIND AN ACTUAL — the club's Budget vs. Actual (Club Tier Stage 3b, session 2; hub specimen 2,
 * "Behind a figure, and where an Actual comes from").
 *
 * The coach's "behind the figure" panel's rules (owner 2026-09-09): a figure opens a panel listing what it
 * adds up, each line dated, and AT MOST TWO DOORS — a ceiling, not a target. The rows share the coach's
 * recipe; the doors are the club's own, which is why this panel lives with the club's screen while the rows
 * it is opened from are the coach's own (promoted, components/coaches/MoneyStatementRows):
 *   · a typed line states itself (the date, its words, its amount); the ONE door is the Ledger, narrowed to
 *     these lines — their book, the year, their category and item;
 *   · a line the money loop wrote names the allocation or the request behind it, and that row IS the door
 *     to its page (the mirror of the coach's drive or sponsor row opening its room).
 * A Budgeted figure does not open this: it opens the line's own window (the line reads first).
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { formatStoredDate } from '@/lib/timezone';
import type { ItemResult } from '@/components/coaches/MoneyStatementRows';
import type { ClubReport } from '@/lib/club-budget-report';
import { money } from './MoneyKit';
import cr from './ClubReport.module.css';

export default function StatementBehindWindow({ item, categoryName, report, accountingBase, onClose }: {
  item: ItemResult;
  /** The category the row sits under — its filing, and the Ledger's Category to narrow by. */
  categoryName: string;
  report: Pick<ClubReport, 'year' | 'lineSources' | 'lineBooks'>;
  accountingBase: string;
  onClose: () => void;
}) {
  const costs = item.costs ?? [];
  const moved = item.direction === 'in' ? 'received' : 'paid';
  const books = [...new Set(costs.map(c => report.lineBooks[c.id]?.ledgerId).filter((x): x is string => !!x))];
  const bookName = books.length === 1 ? costs.map(c => report.lineBooks[c.id]?.bookName).find(Boolean) ?? null : null;
  const where = bookName ? `on ${bookName}` : 'on the club’s books';
  const filed = item.itemName && item.itemName !== categoryName ? `${categoryName} › ${item.itemName}` : categoryName;
  const params = new URLSearchParams({ from: `${report.year}-01-01`, to: `${report.year}-12-31`, category: categoryName });
  /* "These lines" are the ITEM's, not the whole category's: the Ledger's Item filter (owner 2026-10-07) narrows to
     them. Keyed on the item's id, never on its name matching the category's: a word may be "Insurance › Insurance",
     while a Not filed row (and a category's "Not itemized" bucket) has no item half — the category alone is exact. */
  if (item.itemId && item.itemName) params.set('item', item.itemName);
  if (books.length === 1) params.set('book', books[0]);
  const ledgerHref = `${accountingBase}/ledger?${params}`;
  const typed = costs.some(c => !report.lineSources[c.id]);
  const day = (d: string | null) => (d ? formatStoredDate(d, { withYear: false }) : 'no date');

  return (
    <KitDialog
      kind="form"
      eyebrow={`Actual · ${report.year}`}
      title={item.itemName}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Done</button>
          {typed && <Link className="btn btn-outline" href={ledgerHref}>Open these lines in the Ledger <ChevronRight size={14} aria-hidden /></Link>}
        </>
      )}
    >
      <p className={cr.leftBoxFigure}>{money(Math.abs(item.actual))} {moved}</p>
      <p className={ck.hint}>
        {costs.length} {costs.length === 1 ? 'line' : 'lines'} {where}, filed under {filed}.
      </p>
      <div className={cr.windowRows}>
        {costs.map(c => {
          const source = report.lineSources[c.id];
          const body = (
            <>
              <span className={cr.windowRowMain}>
                <span className={cr.windowRowTitle}>{c.description || 'No description'}</span>
                <span className={cr.windowRowSub}>
                  {day(c.paidDate)}{source ? ` · ${source.teamName}` : ''}
                </span>
              </span>
              <span className={cr.windowRowEnd}>{money(c.amount)}</span>
            </>
          );
          if (source?.kind === 'allocation') {
            return <Link key={c.id} href={`${accountingBase}/allocations/${source.allocationId}`} className={cr.windowRow} title="Open this allocation">{body}</Link>;
          }
          if (source?.kind === 'request') {
            return <Link key={c.id} href={`${accountingBase}/payment-requests?request=${source.requestId}`} className={cr.windowRow} title="Open this request">{body}</Link>;
          }
          return <div key={c.id} className={cr.windowRow}>{body}</div>;
        })}
      </div>
    </KitDialog>
  );
}
