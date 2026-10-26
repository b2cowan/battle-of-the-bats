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
 *
 * 12b (drawn m3, copy §6.1): a child paid by card offers "Refund to the card" (all of what is left, and A2's box for the
 * processing fee while the family paid it — on when the club declines, off when the family leaves), "Refund part of it"
 * (an amount and a reason; never the fee) or "Kept by the club". The card refund and the ending are one act: Stripe
 * first, the book with it, then the ending; a refusal changes nothing. A child paid partly by hand keeps today's choices.
 *
 * 12c Part 6 (words §3.3, ask 7): a child whose BANK DEBIT is still clearing ends now, and the window asks up front what
 * happens to the money when it clears — "Send it back to the bank account" (A2's box under it, ruled §7.5) or "Keep it"
 * with a reason; nothing picked, the button absent until a choice. A sibling's share is named. After payouts are
 * disconnected only "Keep it" is offered (§7.7). The answer is stored and carried out when the debit clears.
 */
import { useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { DayField, FormError, MethodField, TextField, moneyKit } from '../../money/MoneyKit';
import { END_WORDS, MONEY_REFUSAL, methodInBrackets, type EndMode } from '@/lib/house-league-money-words';
import { formatLeagueMoney, lastPayment, receivedOf, type LeagueMoneyLine } from '@/lib/league-money';
import { endWaitlistLine, guardianName, refundDayError, regDay } from '@/lib/house-league-registrations';
import type { DuesPaymentMethod, LeagueRegistration } from '@/lib/types';
import { REFUND_WORDS, cardLabel } from '@/lib/online-payment-words';
import { isClearing, type RegDebit } from '@/lib/league-debits';
import { childList } from '@/lib/league-pay-words';
import { possessive } from '@/lib/utils';
import { patchRegistration } from './api';
import css from './Registrations.module.css';

export interface EndedResult {
  mode: EndMode;
  /** The sentence the screen says: what ended, who was emailed, what happened to the money, who moved up. */
  said: string;
}

export default function EndWindow({
  reg, name, mode, division, regs, lines, autoPromote, today, orgQuery, seasonId, raised, onClose, onChanged, onDone, stripeRefundIds,
  debit = null, payoutsOn = true, canRefund = true,
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
  /** 12c: "Withdraw {child}" from a refund made in Stripe — the ending's email carries that refund (one email). */
  stripeRefundIds?: string[];
  /** 12c Part 6: the child's bank debit — asked about only while it is clearing. */
  debit?: RegDebit | null;
  /** 12c Part 6: the club's payouts are connected (else only "Keep it" for a clearing debit, §7.7). */
  payoutsOn?: boolean;
  /** 12c (review of the whole): the member takes fees — sending money back is a refund (never the treasurer's). */
  canRefund?: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDone: (result: EndedResult, ended: LeagueRegistration, promoted: LeagueRegistration | undefined) => void;
}) {
  const received = receivedOf(lines);
  const hasMoney = received > 0;
  const last = lastPayment(lines);
  const payments = lines.filter(l => l.status === 'posted' && l.dir === 'in').length;
  const amount = formatLeagueMoney(received);
  // 12b: every payment for this child came by card (only the card landing writes 'online_card'), so the money goes back
  // to the card. The shares still refundable are read from the server (card, fee share, what is left).
  // 12c: a cleared bank debit is online too — it goes back to the bank account the same way (words §3.9).
  const allCard = hasMoney && lines.filter(l => l.status === 'posted' && l.dir === 'in').every(l => l.method === 'online_card' || l.method === 'online_bank');
  type Share = {
    itemId: string; leftCents: number; feeShareCents: number; untouched: boolean; familyPaidFee: boolean; brand: string | null; last4: string | null;
    rail?: 'card' | 'bank_debit'; bankLast4?: string | null;
  };
  const [shares, setShares] = useState<Share[] | null>(null);
  useEffect(() => {
    if (!allCard) return;
    let live = true;
    void fetch(`/api/admin/house-league/seasons/${seasonId}/registrations/${reg.id}${orgQuery}`, { credentials: 'same-origin' })
      .then(r => r.json()).then(d => { if (live) setShares((d?.cardShares ?? []) as Share[]); }).catch(() => { if (live) setShares([]); });
    return () => { live = false; };
  }, [allCard, seasonId, reg.id, orgQuery]);
  const card = allCard && shares && shares.length > 0 ? shares : null;
  const cardLeftCents = card ? card.reduce((sum, x) => sum + x.leftCents, 0) : 0;
  const newest = card?.[0] ?? null;
  const toBank = newest?.rail === 'bank_debit';
  // A2's box: a FULL refund, every share untouched, while the family paid the fee (owner §0e).
  const feeCents = card && card.every(x => x.untouched && x.familyPaidFee) ? card.reduce((sum, x) => sum + x.feeShareCents, 0) : 0;
  const clubEnding = mode !== 'withdrawn';

  // Nothing is picked (owner 2026-10-25): the primary waits for a choice.
  const [answer, setAnswer] = useState<'refunded' | 'kept' | 'card' | 'cardPart' | null>(null);
  const [feeOn, setFeeOn] = useState(clubEnding);
  const [partAmount, setPartAmount] = useState('');
  const [partReason, setPartReason] = useState('');
  const [day, setDay] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [keptReason, setKeptReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 12c Part 6: a bank debit still clearing — its own question, nothing picked.
  const clearing = isClearing(debit) ? debit : null;
  const clearBase = clearing ? formatLeagueMoney(clearing.shareCents / 100) : '';
  const clearFeeCents = clearing && clearing.familyPaysFee ? clearing.feeShareCents : 0;
  const canSendBack = !!clearing && payoutsOn && canRefund;
  const [clearAnswer, setClearAnswer] = useState<'send_back' | 'keep' | null>(null);
  const [clearFeeOn, setClearFeeOn] = useState(clubEnding);
  const [clearReason, setClearReason] = useState('');
  const clearBackCents = clearing ? clearing.shareCents + (clearFeeOn ? clearFeeCents : 0) : 0;
  const C = END_WORDS.clear;

  const tellsFamily = mode !== 'withdrawn';
  const lastWords = last ? { day: regDay(last.day, today), how: methodInBrackets(last.method) } : { day: '', how: '' };
  const refundedHow = methodInBrackets(method || null);
  const cardBackCents = answer === 'card' ? cardLeftCents + (feeOn ? feeCents : 0) : answer === 'cardPart' ? Math.round(Number(partAmount || 0) * 100) : 0;
  const hint = !hasMoney || !answer
    ? END_WORDS.hintPlain[mode]
    : answer === 'card' || answer === 'cardPart'
      ? (toBank ? END_WORDS.hintBank : END_WORDS.hintCard)(mode, name, formatLeagueMoney(cardBackCents / 100))
    : answer === 'refunded'
      ? END_WORDS.hintRefunded(mode, name, amount, regDay(day, today), refundedHow)
      : END_WORDS.hintKept(mode, name, amount);
  const waitlistLine = endWaitlistLine(reg, regs, autoPromote);
  const needsChoice = (hasMoney && !answer) || (!!clearing && !clearAnswer);
  const foot = clearing && !hasMoney
    ? (clearAnswer === 'send_back' ? C.footBack(name, mode, formatLeagueMoney(clearBackCents / 100))
      : clearAnswer === 'keep' ? C.footKept(name, mode, clearBase) : C.footChoose(clearBase))
    : !hasMoney ? null
    : answer === 'refunded' || answer === 'card' ? END_WORDS.footRefunded(amount)
      : answer === 'kept' ? END_WORDS.footKept(amount)
        : answer === 'cardPart' ? null
          : END_WORDS.footChoose(amount);

  async function go() {
    if (busy || needsChoice) return;
    if (hasMoney && answer === 'refunded') {
      const dayError = refundDayError(day, today, last?.day ?? null);
      if (dayError) { setError(dayError); return; }
    }
    if (hasMoney && answer === 'kept' && !keptReason.trim()) { setError(MONEY_REFUSAL.keptReason(amount)); return; }
    if (clearing && clearAnswer === 'keep' && !clearReason.trim()) { setError(C.keptReasonError(clearBase)); return; }
    if (answer === 'cardPart') {
      const cents = Math.round(Number(partAmount) * 100);
      const leftCents = newest?.leftCents ?? 0;
      if (!Number.isFinite(cents) || cents <= 0 || cents > leftCents) { setError(END_WORDS.cardPartAmountError(formatLeagueMoney(leftCents / 100))); return; }
      if (!partReason.trim()) { setError(END_WORDS.cardPartReasonError); return; }
    }
    setBusy(true); setError('');
    const body: Record<string, unknown> = {
      status: mode === 'declined' ? 'declined' : 'withdrawn',
      ...(mode === 'released' ? { released: true } : {}),
      ...(tellsFamily && note.trim() ? { familyNote: note.trim() } : {}),
      ...(hasMoney && answer === 'refunded' ? { money: { answer: 'refunded', day, method: method || null } } : {}),
      ...(hasMoney && answer === 'kept' ? { money: { answer: 'kept', reason: keptReason.trim() } } : {}),
      ...(answer === 'card' ? { money: { answer: 'card', feeIncluded: feeCents > 0 && feeOn, note: note.trim() || null } } : {}),
      ...(answer === 'cardPart' ? { money: { answer: 'card', amount: Number(partAmount), partialReason: partReason.trim(), note: note.trim() || null } } : {}),
      ...(stripeRefundIds?.length ? { stripeRefundIds } : {}),
      ...(clearing && clearAnswer ? {
        clear: { choice: clearAnswer, feeBack: clearAnswer === 'send_back' && clearFeeCents > 0 && clearFeeOn, reason: clearAnswer === 'keep' ? clearReason.trim() : null },
      } : {}),
    };
    const r = await patchRegistration(orgQuery, seasonId, reg.id, body);
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      // The money (or the registration) moved under the window: read again behind it.
      if (r.status === 409) onChanged();
      return;
    }
    if (clearing && clearAnswer) {
      const said = clearAnswer === 'send_back'
        ? C.doneBack(mode, name, formatLeagueMoney(clearBackCents / 100), reg.guardianEmail || null)
        : C.doneKept(mode, name, clearBase, reg.guardianEmail || null);
      onDone({ mode, said: r.promoted ? `${said} ${END_WORDS.done.moved(r.promoted.playerFirstName)}` : said }, r.registration, r.promoted);
      return;
    }
    const parts = [END_WORDS.done[mode](name)];
    if (hasMoney && answer === 'refunded') parts.push(END_WORDS.done.refunded(amount));
    if (hasMoney && answer === 'kept') parts.push(END_WORDS.done.kept(amount));
    if (answer === 'card' || answer === 'cardPart') parts.push((toBank ? END_WORDS.doneBank : END_WORDS.doneCard)(formatLeagueMoney(cardBackCents / 100)));
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
      dirty={note.trim() !== '' || keptReason.trim() !== '' || partReason.trim() !== '' || clearReason.trim() !== ''}
      footerStart={foot ? <span>{foot}</span> : undefined}
      footer={(
        <>
          <DialogCancel>{END_WORDS.cancel}</DialogCancel>
          {!needsChoice && (
            <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
              {busy ? END_WORDS.working[mode]
                : clearAnswer === 'send_back' ? C.submit[mode]
                  : answer === 'card' || answer === 'cardPart' ? END_WORDS.submitCard[mode] : END_WORDS.submit[mode]}
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
      {(hasMoney || !clearing) && (
        <p className={css.endLead}>
          {hasMoney
            ? (payments > 1 ? END_WORDS.bodyMoneyMany : END_WORDS.bodyMoney)(name, amount, lastWords.day, lastWords.how)
            : END_WORDS.bodyPlain(mode, name, division)}
        </p>
      )}
      <FormError>{error}</FormError>

      {clearing && (
        <>
          <p className={css.endLead}>
            {clearing.siblings.length
              ? C.leadSibling(possessive(reg.playerFirstName), clearBase, formatLeagueMoney(clearing.totalCents / 100), childList(clearing.siblings))
              : C.lead(formatLeagueMoney(clearing.totalCents / 100))}
          </p>
          {clearing.siblings.length > 0 && <p className={ck.hint}>{C.siblingNote(childList(clearing.siblings))}</p>}
          <fieldset className={css.choices}>
            {canSendBack && (
              <label className={css.choice}>
                <input type="radio" name="regs-end-clear" checked={clearAnswer === 'send_back'} onChange={() => setClearAnswer('send_back')} />
                <span>
                  <span className={css.choiceName}>{C.sendBack}</span>
                  <span className={ck.hint}>{clearFeeCents > 0 ? C.sendBackSub : C.sendBackSubClubPays(clearBase)}</span>
                </span>
              </label>
            )}
            {canSendBack && clearAnswer === 'send_back' && clearFeeCents > 0 && (
              <div className={css.choiceFields}>
                <label className={css.choice}>
                  <input type="checkbox" checked={clearFeeOn} onChange={e => setClearFeeOn(e.target.checked)} />
                  <span>
                    <span className={css.choiceName}>{END_WORDS.feeBox(formatLeagueMoney(clearFeeCents / 100), formatLeagueMoney((clearing.shareCents + clearFeeCents) / 100))}</span>
                    <span className={ck.hint}>
                      {clearFeeOn ? (clubEnding ? C.feeOnWhy : END_WORDS.feeOnChanged(formatLeagueMoney(clearFeeCents / 100))) : clubEnding ? C.feeOffPlain : C.feeOffWhy}
                    </span>
                  </span>
                </label>
              </div>
            )}
            <label className={css.choice}>
              <input type="radio" name="regs-end-clear" checked={clearAnswer === 'keep'} onChange={() => setClearAnswer('keep')} />
              <span>
                <span className={css.choiceName}>{C.keep}</span>
                <span className={ck.hint}>{C.keepSub}</span>
              </span>
            </label>
            {clearAnswer === 'keep' && (
              <div className={css.choiceFields}>
                <TextField id="regs-end-clear-reason" label={END_WORDS.keptReason} value={clearReason} onChange={setClearReason}
                  required maxLength={200} hint={END_WORDS.keptReasonHint} />
              </div>
            )}
          </fieldset>
          {!payoutsOn && canRefund && <p className={ck.hint}>{C.disconnected}</p>}
        </>
      )}

      {card && newest && (
        <fieldset className={css.choices}>
          <label className={css.choice}>
            <input type="radio" name="regs-end-money" checked={answer === 'card'} onChange={() => setAnswer('card')} />
            <span>
              <span className={css.choiceName}>{toBank ? END_WORDS.bankFull(newest.bankLast4 ?? '') : END_WORDS.cardFull(cardLabel(newest.brand, newest.last4))}</span>
              <span className={ck.hint}>{toBank ? REFUND_WORDS.arrivesBank : END_WORDS.cardArrives}</span>
            </span>
          </label>
          {answer === 'card' && feeCents > 0 && (
            <div className={css.choiceFields}>
              <label className={css.choice}>
                <input type="checkbox" checked={feeOn} onChange={e => setFeeOn(e.target.checked)} />
                <span>
                  <span className={css.choiceName}>{END_WORDS.feeBox(formatLeagueMoney(feeCents / 100), formatLeagueMoney((cardLeftCents + feeCents) / 100))}</span>
                  <span className={ck.hint}>
                    {feeOn
                      ? (clubEnding ? END_WORDS.feeOnWhy(formatLeagueMoney(feeCents / 100)) : END_WORDS.feeOnChanged(formatLeagueMoney(feeCents / 100)))
                      : END_WORDS.feeOffWhy(formatLeagueMoney(cardLeftCents / 100))}
                  </span>
                </span>
              </label>
            </div>
          )}
          <label className={css.choice}>
            <input type="radio" name="regs-end-money" checked={answer === 'cardPart'} onChange={() => setAnswer('cardPart')} />
            <span>
              <span className={css.choiceName}>{END_WORDS.cardPart}</span>
              <span className={ck.hint}>{END_WORDS.cardPartSub(formatLeagueMoney(newest.leftCents / 100))}</span>
            </span>
          </label>
          {answer === 'cardPart' && (
            <div className={css.choiceFields}>
              <label className={ck.field} htmlFor="regs-end-part">
                <span className={ck.label}>{END_WORDS.cardPartAmount}<span className={repKit.req} aria-hidden>*</span></span>
                <input id="regs-end-part" className={ck.input} inputMode="decimal" value={partAmount} onChange={e => setPartAmount(e.target.value)} />
              </label>
              <TextField id="regs-end-part-reason" label={END_WORDS.cardPartReason} value={partReason} onChange={setPartReason}
                required maxLength={500} hint={END_WORDS.cardPartReasonHint} />
              {Number(partAmount) > 0 && Math.round(Number(partAmount) * 100) <= newest.leftCents && (
                <p className={ck.hint}>{END_WORDS.cardPartRest(formatLeagueMoney((Math.round(received * 100) - Math.round(Number(partAmount) * 100)) / 100))}</p>
              )}
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
              <TextField id="regs-end-reason-card" label={END_WORDS.keptReason} value={keptReason} onChange={setKeptReason}
                required maxLength={200} hint={END_WORDS.keptReasonHint} />
            </div>
          )}
        </fieldset>
      )}

      {/* Paid partly by hand, or nothing left to send back to the card: today's choices. */}
      {hasMoney && (!allCard || (shares !== null && shares.length === 0)) && (
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

      {!(clearing && !hasMoney) && <p className={ck.hint}>{hint}</p>}
      {waitlistLine && <p className={`${ck.hint} ${css.endWaitlist}`}>{waitlistLine}</p>}
    </KitDialog>
  );
}
