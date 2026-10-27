'use client';
/**
 * CORRECT A PRICE (Club Tier Stage 9b-2, Part 3; copy §5, drawing m3). The kit's form window, medium. The window TELLS, it
 * does not ask which (plan §0e): a price change on a paid registration settles itself, and the line under the fields
 * changes as the new price is typed — raising it leaves the difference owing, lowering it records the difference as a
 * refund (a Date refunded and How appear), the same price says nothing more is owing. There is no family credit, so
 * nothing else a lower price can mean. A reason is required. Nobody is emailed (the window says so, and points at Email
 * this family). This is a correction, not a discount scheme.
 *
 * 12b (drawn b6, copy §6.2): a child paid by card — a lower price refunds the difference to the card (pre-selected; or
 * "Refunded another way" with today's date and How), as one act with the correction; a higher price emails the family a
 * pay link for the rest while the club takes card payments.
 */
import { useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { DayField, FormError, MethodField, TextField, moneyKit } from '../../money/MoneyKit';
import { MONEY_REFUSAL, PRICE_WORDS } from '@/lib/house-league-money-words';
import { REFUND_WORDS } from '@/lib/online-payment-words';
import { formatLeagueMoney, lastPayment, receivedOf, type LeagueMoneyLine } from '@/lib/league-money';
import { parsePrice, refundDayError, regDay, type PriceChange } from '@/lib/house-league-registrations';
import type { DuesPaymentMethod, LeagueRegistration } from '@/lib/types';
import { patchRegistration } from './api';
import css from './Registrations.module.css';

export default function PriceWindow({
  reg, name, price, kind, lines, changes, today, orgQuery, seasonId, raised, onClose, onChanged, onDone,
}: {
  reg: LeagueRegistration;
  name: string;
  /** What this registration owes now. */
  price: number;
  /** How the price came about: the early bird, the regular price, or an earlier correction. */
  kind: 'regular' | 'early' | 'corrected';
  lines: readonly LeagueMoneyLine[];
  changes: readonly PriceChange[];
  today: string;
  orgQuery: string;
  seasonId: string;
  raised: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDone: (said: string) => void;
}) {
  const got = receivedOf(lines);
  const last = lastPayment(lines);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [day, setDay] = useState(today);
  const [method, setMethod] = useState<DuesPaymentMethod | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 12b: every payment for this child came by card (only the card landing writes 'online_card').
  // 12c: a cleared bank debit is online too ('online_bank') — the difference goes back to the bank account the same way.
  const allCard = got > 0 && lines.filter(l => l.status === 'posted' && l.dir === 'in').every(l => l.method === 'online_card' || l.method === 'online_bank');
  const toBank = allCard && last?.method === 'online_bank';
  const [toCard, setToCard] = useState(true);

  const next = parsePrice(text);
  const diff = next == null ? 0 : Math.round((next - got) * 100) / 100;
  const lower = got > 0 && next != null && diff < 0;
  const raise = got > 0 && next != null && diff > 0;
  const even = got > 0 && next != null && diff === 0;
  const paid = formatLeagueMoney(got);
  const money = formatLeagueMoney;

  const signedDay = kind === 'corrected'
    ? regDay(changes.filter(c => c.kind === 'corrected').sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt))[0]?.changedAt, today)
    : regDay(reg.registeredAt, today);

  const cardLower = allCard && lower && toCard;
  const cardRaise = allCard && raise;
  const hint = got === 0 ? PRICE_WORDS.hintUnpaid(name)
    : cardRaise ? PRICE_WORDS.hintRaiseCard(name, money(diff))
    : raise ? PRICE_WORDS.hintRaise(name, paid, money(diff))
      : lower && allCard ? (toBank ? PRICE_WORDS.hintLowerBank : PRICE_WORDS.hintLowerCard)(name, paid, money(-diff))
      : lower ? PRICE_WORDS.hintLower(name, paid, money(-diff))
        : even ? PRICE_WORDS.hintEven(name, paid)
          : null;

  async function go() {
    if (busy) return;
    if (next == null) { setError(MONEY_REFUSAL.amount); return; }
    if (next === price) { setError(MONEY_REFUSAL.priceSame); return; }
    if (!reason.trim()) { setError(MONEY_REFUSAL.priceReason); return; }
    if (lower && !cardLower) {
      const dayError = refundDayError(day, today, last?.day ?? null);
      if (dayError) { setError(dayError); return; }
    }
    setBusy(true); setError('');
    const r = await patchRegistration(orgQuery, seasonId, reg.id, {
      money: {
        kind: 'price', price: next, reason: reason.trim(),
        ...(cardLower || cardRaise ? { card: true } : {}),
        ...(lower ? { day: cardLower ? today : day, method: cardLower ? null : method || null } : {}),
      },
    });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      if (r.status === 409) onChanged();
      return;
    }
    onDone(cardLower ? (toBank ? PRICE_WORDS.doneLowerBank : PRICE_WORDS.doneLowerCard)(name, money(next), money(-diff))
      : cardRaise ? PRICE_WORDS.doneRaiseCard(name, money(next))
      : lower ? PRICE_WORDS.doneLower(name, money(next), money(-diff)) : PRICE_WORDS.done(name, money(next)));
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      raised={raised}
      title={PRICE_WORDS.title(name)}
      onClose={onClose}
      busy={busy}
      dirty={text.trim() !== '' || reason.trim() !== ''}
      footerStart={<span>{lower ? PRICE_WORDS.footLower(money(-diff)) : PRICE_WORDS.footDefault}</span>}
      footer={(
        <>
          <DialogCancel>{PRICE_WORDS.cancel}</DialogCancel>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
            {busy ? PRICE_WORDS.working : cardLower ? PRICE_WORDS.submitLowerCard : cardRaise ? PRICE_WORDS.submitRaiseCard : PRICE_WORDS.submit}
          </button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      <div className={ck.field}>
        <span className={ck.label}>{PRICE_WORDS.signedLabel}</span>
        <div className={repKit.readonlyValue}>{PRICE_WORDS.signed(money(price), kind, signedDay)}</div>
      </div>
      <label className={ck.field} htmlFor="regs-price-new">
        <span className={ck.label}>{PRICE_WORDS.newLabel}<span className={repKit.req} aria-hidden>*</span></span>
        <input id="regs-price-new" className={ck.input} inputMode="decimal" placeholder={money(price)} value={text}
          onChange={e => setText(e.target.value)} data-autofocus="" />
      </label>
      <TextField id="regs-price-reason" label={PRICE_WORDS.reasonLabel} value={reason} onChange={setReason}
        placeholder={PRICE_WORDS.reasonPlaceholder} required maxLength={200} />
      {hint && <p className={ck.hint}>{hint}{(raise || lower) && !cardRaise && !cardLower && ` ${PRICE_WORDS.hintNoEmail}`}</p>}
      {lower && allCard && (
        <fieldset className={css.choices}>
          <label className={css.choice}>
            <input type="radio" name="regs-price-back" checked={toCard} onChange={() => setToCard(true)} />
            <span>
              <span className={css.choiceName}>{(toBank ? PRICE_WORDS.lowerBankChoice : PRICE_WORDS.lowerCardChoice)(money(-diff))}</span>
              <span className={ck.hint}>{toBank ? REFUND_WORDS.arrivesBank : PRICE_WORDS.lowerCardSub}</span>
            </span>
          </label>
          <label className={css.choice}>
            <input type="radio" name="regs-price-back" checked={!toCard} onChange={() => setToCard(false)} />
            <span><span className={css.choiceName}>{PRICE_WORDS.lowerOtherChoice}</span></span>
          </label>
        </fieldset>
      )}
      {lower && !cardLower && (
        <div className={moneyKit.pair}>
          <DayField id="regs-price-day" label={PRICE_WORDS.refundDate} value={day} onChange={setDay} max={today} />
          <MethodField id="regs-price-how" label={PRICE_WORDS.refundHow} value={method} onChange={setMethod} required={false} emptyLabel={PRICE_WORDS.howNone} />
        </div>
      )}
    </KitDialog>
  );
}
