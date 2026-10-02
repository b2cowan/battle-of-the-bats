'use client';
/**
 * ⚖ A LEDGER ROW ANOTHER TAB WROTE OPENS A READ WINDOW (Ledger Parity D3, owner 2026-10-02; hub screen 4).
 *
 * Before: a dues payment, money a fundraiser brought in, or a payment to or from the club did not open at
 * all — its last cell held a worded button ("Player Dues →") to the tab that wrote it. Now the ROW opens,
 * and what it opens is the club's window for a line another screen wrote: the facts, ONE sentence naming
 * where it is changed, and ONE door there. The body is the shared kit's `LedgerLineRead` — the club's
 * `ReadLineWindow` renders the same body — so the two portals draw one shape; the frame is the portal's
 * own window (`QuestionShell`; the admin's `KitDialog` is admin-only by rule).
 *
 * It shows for a read-only money assistant too: it reads, and its door is a tab they can already open.
 * The same window answers a row the team RECORDED when the person reading cannot change it (no money
 * write): its facts, and a sentence saying who can — no door, because the only editor is the money form.
 *
 * ⚠ IT READS ONLY WHAT THE ROW CARRIES (the register's own fields, `origin` and `paidHow` included) —
 * never a second fetch, so the window can never disagree with the row a coach just clicked.
 */
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import QuestionShell from '@/components/coaches/QuestionShell';
import { LedgerLineRead, type RecordFact } from '@/components/coaches/kit';
import { moneySectionHref } from '@/lib/coach-money-links';
import { CLUB_SENT_WAITING_WORD } from '@/lib/club-money-words';
import { formatMoney, REGISTER_SOURCE_LABEL, type RegisterBookRow } from '@/lib/coach-register';
import { ledgerRowDate } from '@/lib/ledger-format';
import shared from '../../../coaches.module.css';

/** Who the row is about, in the words its origin owns ("Family", "Raised by", "Credited to"). */
function whoFact(r: RegisterBookRow): RecordFact {
  switch (r.origin) {
    case 'dues-payment':
    case 'dues-payout':
      return r.playerName ? ['Family', r.playerName] : null;
    case 'dues-installment':
      return r.playerName ? ['Family', r.playerName] : r.detail ? ['Families', r.detail] : null;
    case 'drive':
      return r.playerName ? ['Raised by', r.playerName] : null;
    case 'sponsor':
      return r.playerName ? ['Credited to', r.playerName] : null;
    case 'club-installment':
      return r.installmentNumber != null ? ['Installment', `#${r.installmentNumber}`] : null;
    default:
      return null;
  }
}

/** The row's state, when it has one worth a line (overdue, waiting on the club, a pledge, a request). */
function statusFact(r: RegisterBookRow): RecordFact {
  if (r.overdueDays != null) return ['Status', `Overdue by ${r.overdueDays} ${r.overdueDays === 1 ? 'day' : 'days'}`];
  if (r.waitingOnClub) return ['Status', CLUB_SENT_WAITING_WORD];
  if ((r.origin === 'club-request' || r.origin === 'pledge') && r.detail) return ['Status', r.detail];
  if (!r.origin && r.detail) return ['Note', r.detail];
  return null;
}

/** The one sentence: where this line is changed — its lead names the place, one tail says the Ledger follows. */
function whereSentence(r: RegisterBookRow, tab: string | null): string {
  if (!tab) return 'Only someone who can enter the team’s money can change it.';
  // "On Club" reads as a typo — club is also an ordinary word — so the Club tab is named as a tab (/marketing).
  if (tab === 'Club') tab = 'the Club tab';
  // Two lines are not the coach's to change: the club's bill is PAID there, and a request is the club's to decide.
  if (r.origin === 'club-installment' && r.scheduled) return `The club’s bill, on ${tab}. Pay it there, and the Ledger follows.`;
  if (r.origin === 'club-request' && r.scheduled) return `Waiting for the club’s answer, on ${tab}. The Ledger follows what the club decides.`;
  const lead = r.origin === 'dues-installment' ? `Due on ${tab}, from a family’s payment schedule`
    : r.origin === 'pledge' ? `Pledged on ${tab} and not arrived yet`
    : `Recorded on ${tab}`;
  return `${lead}. Change it there, and the Ledger follows.`;
}

export default function LedgerLineWindow({ row, base, open, onClose }: {
  row: RegisterBookRow;
  /** The team's portal base — `/{org}/coaches/teams/{team}`. */
  base: string;
  /** The window shows only on the tab that opened it (the hub keeps panels mounted, hidden). */
  open: boolean;
  onClose: () => void;
}) {
  const section = row.open?.kind === 'workspace' ? row.open.section : null;
  const tab = row.kind === 'dues' || row.kind === 'fundraising' || row.kind === 'club'
    ? REGISTER_SOURCE_LABEL[row.kind] : null;
  const door = section && tab ? { href: moneySectionHref(base, section, undefined), label: `Open ${tab}` } : null;
  const amount = row.moneyIn > 0 ? `${formatMoney(row.moneyIn)} in` : `${formatMoney(row.moneyOut)} out`;
  const when = row.date ? ledgerRowDate(row.date) : null;
  const title = when ? `${row.description} · ${when}` : row.description;

  return (
    <QuestionShell open={open} onClose={onClose} ariaLabel={title} title={title}>
      <>
        <div className={shared.scrollPane}>
          <LedgerLineRead
            facts={[
              ['Amount', amount],
              row.categoryName ? ['Category', row.categoryName] : null,
              row.itemName ? ['Item', row.itemName] : null,
              whoFact(row),
              row.paidHow ? ['How it was paid', row.paidHow] : null,
              [row.scheduled ? 'Due' : row.datedWhenRecorded ? 'Recorded on' : 'On', when ?? 'No date'],
              statusFact(row),
            ]}
            where={whereSentence(row, door ? tab : null)}
          />
        </div>
        <div className={shared.modalFooter}>
          <button type="button" className={shared.btnSecondary} onClick={onClose}>Close</button>
          {door && (
            <Link href={door.href} className={shared.btnSecondary} onClick={onClose}>
              {door.label} <ChevronRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      </>
    </QuestionShell>
  );
}
