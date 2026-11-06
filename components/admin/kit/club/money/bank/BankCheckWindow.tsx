'use client';
/**
 * A SAVED CHECK, OPENED (Bank balance check BC2b; drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 5, plan §6, asks 5 and 6).
 * A form window (medium, 640, as every club window with the joined band; the start's has no band, so 520): exactly what
 * was saved. The three joined tiles from the SAVED figures (the engine's `figureOfSaved`, figured on the server, already on
 * the row: rule 6), the sums as saved, who checked it and when, and "Books now say $X"
 * when a line dated on or before it changed after the save.
 *   · the body's end ........ "Delete this check": RepKit's `RecordDelete` (design 2026-10-09: an admin record's delete is
 *                             the trash icon and red words at body weight, ending the body), one question first; who
 *                             deleted it and when is kept (a soft delete)
 *   · the foot .............. "Check this statement again" (the form above gets the date; saving replaces this one). No
 *                             Close: a RECORD window closes by its × (design 2026-10-09, the no-Close rule; the drawing's
 *                             Close predates it, /design BC2b).
 * ⚖ THE STARTING STATEMENT opens too (owner 2026-11-06, BC2b ask 2: a mistyped start must be fixable): its balance, what was
 *   on its way, who started it. While a later check stands on it, the server's own sentence (`start_has_checks`) stands
 *   where its Delete would be, before the tap; deleting it puts the account back on its Start card. It has no foot.
 * ⚖ Every write control is a writer's (B7, `canMove`): a reader opens the same window with no door and no foot.
 * ⚖ Delete goes through `bankWrite`; a stale refusal goes to the tab (`onStale` → `staleRefresh`), which re-reads first.
 * ⚖ The window draws no money arithmetic: the lines, their signs and the total are the engine's (`savedTerms`), nothing
 *   re-added or re-signed here.
 */
import { useState } from 'react';
import KitDialog from '../../KitDialog';
import { RecordDelete } from '../../RepKit';
import { FormError } from '../MoneyKit';
import { formatTime } from '@/lib/utils';
import { utcToZonedInputs } from '@/lib/timezone';
import { BANK_REFUSAL } from '@/lib/bank-check-words';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { BankBand, BankSavedSums, type SavedSumRow } from './BankFigure';
import { savedTerms } from '@/lib/bank-check';
import { bankUrl, bankWrite, cents, dayYear, isStaleView, moved, type AccountView, type SavedCheckView } from './BankShared';
import s from './Bank.module.css';

/**
 * The saved sums, worded. The lines and their signs are the engine's (`savedTerms`): a check is Your books · on its way
 * (or *not counted*) · each Not in the bank yet item · cash; the start is The bank said · on its way · its waiting items,
 * ruled off by the books it starts from (ask 7). This only names and formats them.
 */
function savedSumRows(c: SavedCheckView): { rows: SavedSumRow[]; total: string } {
  const { terms, totalCents } = savedTerms(c);
  const rows = terms.map((t): SavedSumRow => {
    switch (t.kind) {
      case 'base': return c.kind === 'start'
        ? { key: t.key, label: W.savedBank, amount: cents(t.cents) }
        : { key: t.key, label: W.sumBooks(dayYear(c.date)), amount: cents(t.cents) };
      case 'onItsWay': return t.cents === null
        ? { key: t.key, label: W.savedOnItsWay, amount: W.notCounted, quiet: true, note: W.savedNotCountedNote }
        : { key: t.key, label: W.savedOnItsWay, amount: moved(t.cents) };
      case 'waiting': return { key: t.key, label: W.savedWaiting(t.item.label ?? dayYear(t.item.date)), amount: moved(t.cents) };
      case 'cash': return { key: t.key, label: W.savedCash, amount: moved(t.cents) };
    }
  });
  return { rows, total: cents(totalCents) };
}

export default function BankCheckWindow({ orgSlug, view, check, canMove, onClose, onAgain, onDeleted, onStale }: {
  orgSlug: string;
  view: AccountView;
  check: SavedCheckView;
  /** B7: a writer's controls (Delete, Check this statement again). */
  canMove: boolean;
  onClose: () => void;
  /** "Check this statement again": the tab closes this window and hands the form the date. */
  onAgain: (date: string) => void;
  /** The account read again after the delete, and what to tell the treasurer. */
  onDeleted: (view: AccountView, text: string) => void;
  /** The server said the view is stale: the tab re-reads, then says the sentence. */
  onStale: (text: string) => void;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = check.kind === 'start';
  const when = dayYear(check.date);
  const at = utcToZonedInputs(check.checkedAt);
  const checkedLine = (start ? W.startedOn : W.checkedOn)(check.checkedBy, dayYear(at.date), formatTime(at.time));
  // The start can't go while a later check stands on it (`start_has_checks`): the screen says so before the tap.
  const startHeld = start && view.checks.length > 0;
  const sums = savedSumRows(check);

  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    const r = await bankWrite(bankUrl(orgSlug, `/accounts/${view.account.id}/checks/${check.id}`), 'DELETE', {}, W.deleteFailed);
    setBusy(false);
    if (!r.ok) {
      if (isStaleView(r.code)) onStale(r.error); else setError(r.error);
      return;
    }
    onDeleted(r.view, start ? W.deletedStart(when) : W.deleted(when));
  }

  return (
    <>
      <KitDialog
        kind="form"
        eyebrow={start ? W.startEyebrow(view.account.name) : W.savedEyebrow(view.account.name)}
        title={start ? W.startTitle(when) : W.savedTitle(when)}
        // Medium (640), as every club window that carries the joined band (a bill, Record a payment): at the drawing's
        // 520 the shipped band's figures wrapped ("Off by / $12.40"), /design BC2b.
        size={start ? undefined : 'medium'}
        onClose={onClose}
        busy={busy}
        footer={canMove && !start ? (
          <button type="button" className="btn btn-lime" onClick={() => onAgain(check.date)} disabled={busy}>{W.checkAgain}</button>
        ) : undefined}
      >
        {!start && <BankBand date={check.date} figure={check.figure} typed saved />}
        <BankSavedSums rows={sums.rows} totalLabel={start ? W.startBooks : W.savedShouldTotal} totalAmount={sums.total} />
        {check.booksNowSayCents !== null && (
          <p className={s.savedNote}><b>{W.booksNowSay(cents(check.booksNowSayCents))}.</b> {W.booksNowSayWhy(when)}</p>
        )}
        <p className={s.savedNote}>{checkedLine}</p>
        {canMove && (
          <div className={s.recordDoor}>
            {startHeld
              ? <p className={s.statusNote}>{BANK_REFUSAL.start_has_checks}</p>
              : <RecordDelete onClick={() => { setError(''); setAsking(true); }} disabled={busy}>{start ? W.deleteStart : W.deleteCheck}</RecordDelete>}
          </div>
        )}
      </KitDialog>
      {asking && (
        <KitDialog
          kind="question"
          title={start ? W.deleteStartTitle : W.deleteTitle}
          onClose={() => setAsking(false)}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>{W.deleteKeep}</button>
              <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={busy}>{busy ? W.deleting : W.deleteYes}</button>
            </>
          )}
        >
          <FormError>{error}</FormError>
          <p>{start ? W.deleteStartAsk(when) : W.deleteAsk(when)}</p>
        </KitDialog>
      )}
    </>
  );
}
