'use client';
/**
 * A SAVED CHECK, OPENED — the coach's (Bank balance check BC7a; drawing BANK_BALANCE_CHECK_DRAWINGS.html tab 5, plan §6,
 * asks 5 and 6). The portal's own record window (QuestionShell, 640: the joined band's figures need it, /design BC2b):
 * exactly what was saved — the three tiles from the SAVED figures (the engine's `figureOfSaved`, figured on the server,
 * already on the check: rule 6), the sums as saved (the engine's `savedTerms`: Your books · each line not in the bank yet ·
 * cash), "Books now say $X" when a line dated on or before it changed after the save, and who checked it and when.
 *   · the foot's left ...... "Delete this check" (red words, the Ledger's record door), one question docked in its place
 *                            (the Ledger's own record window does the same); who deleted it and when is kept (soft)
 *   · the foot's right ..... Close, and "Check this statement again" (the form above gets the date; saving replaces this)
 *   · beside it ............ "Print this check" (BC8b; the club's "Report door" carried): the team's printed check, for
 *                            everyone who opens the window (money read too, a read not a write), a desk's door only
 *                            (hidden at 640 and under: R0 tab 9 has no phone version); the report is mounted with the window
 * ⚖ K7: a money-read coach opens the same window with no Delete and no "Check this statement again".
 * ⚖ A team has no online payments on their way (B12: no coach-side Stripe): its saved checks carry none, so no such line.
 */
import { useState } from 'react';
import { Printer, Trash2 } from 'lucide-react';
import QuestionShell from '@/components/coaches/QuestionShell';
import MoneySummaryBand from '@/components/coaches/MoneySummaryBand';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import { useCoaches } from '@/lib/coaches-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatTime } from '@/lib/utils';
import { utcToZonedInputs } from '@/lib/timezone';
import { savedTerms } from '@/lib/bank-check';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { bankBandTiles, cents, dayYear, moved, nameOf } from '@/lib/bank-screen';
import { deleteTeamCheck, type TeamBank, type TeamCheck } from './coachBank';
import CoachBankReport from './CoachBankReport';
import b from './CoachBank.module.css';

export default function CoachBankWindow({ orgSlug, teamId, accountName, check, canWrite, onClose, onAgain, onDeleted }: {
  orgSlug: string;
  teamId: string;
  accountName: string;
  check: TeamCheck;
  /** Money write (the server's `canWrite`): Delete and "Check this statement again". */
  canWrite: boolean;
  onClose: () => void;
  onAgain: (date: string) => void;
  /** The bank read again after the delete, and what to tell the coach. */
  onDeleted: (view: TeamBank, text: string) => void;
}) {
  const isPhone = useIsPhone();
  // The printed page's team (its eyebrow and foot): the portal's own assignment, as the Ledger names the team.
  const teamName = useCoaches().assignments.find(a => a.teamId === teamId)?.teamName ?? '';
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const when = dayYear(check.date);
  const at = utcToZonedInputs(check.checkedAt);
  const band = bankBandTiles({ date: check.date, figure: check.figure, typed: true, saved: true, isPhone });
  // The lines and their signs are the engine's; a team's check has no on-its-way line (none was ever counted).
  const { terms, totalCents } = savedTerms(check);
  const rows = terms.flatMap(t => {
    switch (t.kind) {
      case 'base': return [{ key: t.key, label: W.sumBooks(when), amount: cents(t.cents) }];
      case 'waiting': return [{ key: t.key, label: W.savedWaiting(nameOf(t.item)), amount: moved(t.cents) }];
      case 'cash': return [{ key: t.key, label: W.savedCash, amount: moved(t.cents) }];
      default: return [];
    }
  });

  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    const r = await deleteTeamCheck(orgSlug, teamId, check.id);
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onDeleted(r.view, W.deleted(when));
  }

  return (
    <QuestionShell open onClose={onClose} busy={busy} wide ariaLabel={W.savedTitle(when)}
      eyebrow={W.savedEyebrow(accountName)} title={W.savedTitle(when)}
      footerStart={asking ? (
        // The Ledger's record window's own question, docked where Delete stood (a writer's only).
        <div className={styles.dangerConfirm} role="group" aria-label={W.deleteTitle}>
          <p className={styles.dangerConfirmTitle}>{W.deleteTitle}</p>
          <p className={styles.dangerConfirmBody}>{W.deleteAsk(when)}</p>
          {error && <p className={styles.errorText} role="alert">{error}</p>}
          <div className={styles.dangerConfirmActions}>
            <button type="button" className={styles.btnGhost} onClick={() => { setAsking(false); setError(''); }} disabled={busy}>{W.deleteKeep}</button>
            <button type="button" className={styles.btnDanger} onClick={() => void remove()} disabled={busy}>{busy ? W.deleting : W.deleteYes}</button>
          </div>
        </div>
      ) : (canWrite || !isPhone) && (
        // A reader on a phone has neither door (Print is a desk's): no empty slot in the foot (/review BC8b).
        <span className={b.footDoors}>
          {canWrite && (
            <button type="button" className={styles.deleteRecordBtn} onClick={() => setAsking(true)} disabled={busy}>
              <Trash2 size={13} aria-hidden /> {W.deleteCheck}
            </button>
          )}
          {/* The team's printed check (BC8b, "Report door"): everyone who opens the check, a desk's door only. */}
          <button type="button" className={b.printDoor} onClick={() => window.print()} disabled={busy}>
            <Printer size={13} aria-hidden /> {W.printCheck}
          </button>
        </span>
      )}
      footer={asking ? undefined : (
        <>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>{W.close}</button>
          {canWrite && <button type="button" className={styles.btnPrimary} onClick={() => onAgain(check.date)}>{W.checkAgain}</button>}
        </>
      )}>
      <div className={b.band}>
        <MoneySummaryBand ariaLabel={band.ariaLabel} tiles={band.tiles} />
      </div>
      <div className={b.sums} role="group" aria-label={W.sumsTitle}>
        {rows.map(r => (
          <div key={r.key} className={b.sumRow}><span>{r.label}</span><span className={b.sumAmt}>{r.amount}</span></div>
        ))}
        <div className={`${b.sumRow} ${b.sumTotal}`}><span>{W.savedShouldTotal}</span><span className={b.sumAmt}>{cents(totalCents)}</span></div>
      </div>
      {check.booksNowSayCents !== null && (
        <p className={b.savedNote}><b>{W.booksNowSay(cents(check.booksNowSayCents))}.</b> {W.booksNowSayWhy(when)}</p>
      )}
      <p className={b.savedNote}>{W.checkedOn(check.checkedBy, dayYear(at.date), formatTime(at.time))}</p>
      {/* Hidden on screen; only the paper (portalled onto <body>, as the club's is mounted with its window). */}
      {check.kind === 'check' && <CoachBankReport teamName={teamName} accountName={accountName} check={check} />}
    </QuestionShell>
  );
}
