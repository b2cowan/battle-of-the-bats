'use client';
/**
 * ENDING A REGISTRATION (Club Tier Stage 9b-2, Part 3; copy §4, drawing m3): Decline, Withdraw and Release the spot are ONE
 * window with three titles. The kit's form window, medium; the foot's sentence at the left, Cancel and the primary at the
 * right. A registration that has received money asks what happened to it — ⚖ the question STARTS WITH NOTHING PICKED and
 * the primary button is ABSENT until Refunded or Kept is chosen (owner 2026-10-25, plan §0e): a refund is a line going out
 * of the book, and a mis-click must not record money that never moved. A refund is its own line beside the payment it
 * returns, never the payment disappearing; a kept fee needs a reason. Nothing is asked when nothing was received.
 *
 * Who is told (⚖ a change that tells families is held until the button, and the button names it): Decline and Release email
 * the family, with the note typed here; Withdraw emails ONLY when money moved. The window says which, live.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { DayField, FormError, MethodField, TextField, moneyKit } from '../../money/MoneyKit';
import { END_WORDS, MONEY_REFUSAL, methodInBrackets, type EndMode } from '@/lib/house-league-money-words';
import { formatLeagueMoney, lastPayment, receivedOf, type LeagueMoneyLine } from '@/lib/league-money';
import { endWaitlistLine, guardianName, refundDayError, regDay } from '@/lib/house-league-registrations';
import type { DuesPaymentMethod, LeagueRegistration } from '@/lib/types';
import { patchRegistration } from './api';
import css from './Registrations.module.css';

export interface EndedResult {
  mode: EndMode;
  /** The sentence the screen says: what ended, who was emailed, what happened to the money, who moved up. */
  said: string;
}

export default function EndWindow({
  reg, name, mode, division, regs, lines, autoPromote, today, orgQuery, seasonId, raised, onClose, onChanged, onDone,
}: {
  reg: LeagueRegistration;
  name: string;
  mode: EndMode;
  division: string;
  regs: readonly LeagueRegistration[];
  lines: readonly LeagueMoneyLine[];
  autoPromote: boolean;
  today: string;
  orgQuery: string;
  seasonId: string;
  raised: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDone: (result: EndedResult, ended: LeagueRegistration, promoted: LeagueRegistration | undefined) => void;
}) {
  const received = receivedOf(lines);
  const hasMoney = received > 0;
  const last = lastPayment(lines);
  const payments = lines.filter(l => l.status === 'posted' && l.dir === 'in').length;
  const amount = formatLeagueMoney(received);

  // Nothing is picked (owner 2026-10-25): the primary waits for a choice.
  const [answer, setAnswer] = useState<'refunded' | 'kept' | null>(null);
  const [day, setDay] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [keptReason, setKeptReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tellsFamily = mode !== 'withdrawn';
  const lastWords = last ? { day: regDay(last.day, today), how: methodInBrackets(last.method) } : { day: '', how: '' };
  const refundedHow = methodInBrackets(method || null);
  const hint = !hasMoney || !answer
    ? END_WORDS.hintPlain[mode]
    : answer === 'refunded'
      ? END_WORDS.hintRefunded(mode, name, amount, regDay(day, today), refundedHow)
      : END_WORDS.hintKept(mode, name, amount);
  const waitlistLine = endWaitlistLine(reg, regs, autoPromote);
  const needsChoice = hasMoney && !answer;
  const foot = !hasMoney ? null
    : answer === 'refunded' ? END_WORDS.footRefunded(amount)
      : answer === 'kept' ? END_WORDS.footKept(amount)
        : END_WORDS.footChoose(amount);

  async function go() {
    if (busy || needsChoice) return;
    if (hasMoney && answer === 'refunded') {
      const dayError = refundDayError(day, today, last?.day ?? null);
      if (dayError) { setError(dayError); return; }
    }
    if (hasMoney && answer === 'kept' && !keptReason.trim()) { setError(MONEY_REFUSAL.keptReason(amount)); return; }
    setBusy(true); setError('');
    const body: Record<string, unknown> = {
      status: mode === 'declined' ? 'declined' : 'withdrawn',
      ...(mode === 'released' ? { released: true } : {}),
      ...(tellsFamily && note.trim() ? { familyNote: note.trim() } : {}),
      ...(hasMoney && answer === 'refunded' ? { money: { answer: 'refunded', day, method: method || null } } : {}),
      ...(hasMoney && answer === 'kept' ? { money: { answer: 'kept', reason: keptReason.trim() } } : {}),
    };
    const r = await patchRegistration(orgQuery, seasonId, reg.id, body);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      // The money (or the registration) moved under the window: read again behind it.
      if (r.status === 409) onChanged();
      return;
    }
    const parts = [END_WORDS.done[mode](name)];
    if (hasMoney && answer === 'refunded') parts.push(END_WORDS.done.refunded(amount));
    if (hasMoney && answer === 'kept') parts.push(END_WORDS.done.kept(amount));
    if (r.promoted) parts.push(END_WORDS.done.moved(r.promoted.playerFirstName));
    onDone({ mode, said: parts.join(' ') }, r.registration, r.promoted);
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      raised={raised}
      title={END_WORDS.title(mode, name)}
      onClose={onClose}
      busy={busy}
      dirty={note.trim() !== '' || keptReason.trim() !== ''}
      footerStart={foot ? <span>{foot}</span> : undefined}
      footer={(
        <>
          <DialogCancel>{END_WORDS.cancel}</DialogCancel>
          {!needsChoice && (
            <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
              {busy ? END_WORDS.working[mode] : END_WORDS.submit[mode]}
            </button>
          )}
        </>
      )}
    >
      {mode === 'withdrawn' && reg.withdrawRequestedAt && (
        <p className={css.endLead}>
          {END_WORDS.requested(guardianName(reg), name, regDay(reg.withdrawRequestedAt, today), reg.withdrawRequestNote?.trim() || null)}
        </p>
      )}
      <p className={css.endLead}>
        {hasMoney
          ? (payments > 1 ? END_WORDS.bodyMoneyMany : END_WORDS.bodyMoney)(name, amount, lastWords.day, lastWords.how)
          : END_WORDS.bodyPlain(mode, name, division)}
      </p>
      <FormError>{error}</FormError>

      {hasMoney && (
        <fieldset className={css.choices}>
          <label className={css.choice}>
            <input type="radio" name="regs-end-money" checked={answer === 'refunded'} onChange={() => setAnswer('refunded')} />
            <span>
              <span className={css.choiceName}>{END_WORDS.refunded}</span>
              <span className={ck.hint}>{END_WORDS.refundedSub(amount)}</span>
            </span>
          </label>
          {answer === 'refunded' && (
            <div className={`${moneyKit.pair} ${css.choiceFields}`}>
              <DayField id="regs-end-day" label={END_WORDS.refundedDate} value={day} onChange={setDay} max={today} />
              <MethodField id="regs-end-how" label={END_WORDS.refundedHow} value={method} onChange={setMethod} required={false} emptyLabel={END_WORDS.howNone} />
            </div>
          )}
          <label className={css.choice}>
            <input type="radio" name="regs-end-money" checked={answer === 'kept'} onChange={() => setAnswer('kept')} />
            <span>
              <span className={css.choiceName}>{END_WORDS.kept}</span>
              <span className={ck.hint}>{END_WORDS.keptSub}</span>
            </span>
          </label>
          {answer === 'kept' && (
            <div className={css.choiceFields}>
              <TextField id="regs-end-reason" label={END_WORDS.keptReason} value={keptReason} onChange={setKeptReason}
                required maxLength={200} hint={END_WORDS.keptReasonHint} />
            </div>
          )}
        </fieldset>
      )}

      {tellsFamily && (
        <label className={ck.field} htmlFor="regs-end-note">
          <span className={ck.label}>{END_WORDS.noteLabel}</span>
          <textarea id="regs-end-note" className={ck.textarea} rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
        </label>
      )}

      <p className={ck.hint}>{hint}</p>
      {waitlistLine && <p className={`${ck.hint} ${css.endWaitlist}`}>{waitlistLine}</p>}
    </KitDialog>
  );
}
