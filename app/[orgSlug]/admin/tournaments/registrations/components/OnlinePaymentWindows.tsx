'use client';
/**
 * A team record's online-payment windows (Club Tier Stage 12a — words copy §15–§16; Books & refunds §3 drawn for the
 * house-league row, here in tournament form):
 *
 *   View the payment   read-only: when, the card, the entry fee, the processing fee and who paid it, the total, from whom
 *                      — and (12c words §1.4) each refund below it: amount, the fee, the reason, the entry it lowered, who
 *                      and when, where it stands, Stripe's reference (Copy is the symbol alone in this smaller window) and
 *                      whether the team was emailed. A refund the card sent back carries "Record the refund sent another way".
 *   Refund             12c words §1.1: nothing picked on open. **All of it** is 12a's full refund: while the team paid the
 *                      fee, who is ending it and the fee box (A2 = C). **Part of it**: an amount up to what is left, a
 *                      reason the team reads, never the processing fee; it lowers that team's entry by the same amount.
 *                      "All of it" is gone once part has been refunded. The same window records the refund sent ANOTHER
 *                      way after a refund to the card came back (F6).
 *
 * Both open over the team's record (`raised`). The refund asks (create asks): nothing moves until the button is pressed.
 */
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { RepChip } from '@/components/admin/kit/club/RepKit';
import { formatStoredDate } from '@/lib/timezone';
import {
  PAY_VIEW_WORDS as V, REFUND_WORDS as R, SCOPE_WORDS, cardLabel, money, paidAtLabel, receiptLabel,
} from '@/lib/online-payment-words';
import { CARD_REFUND_WORDS } from '@/lib/house-league-money-words';
import { clockOf } from '@/lib/league-card-refunds';
import { possessive } from '@/lib/utils';
import type { TeamOnlinePayment, TeamRefund } from '@/lib/team-payments';
import styles from '../teams-admin.module.css';

const dollars = (cents: number) => money(cents / 100);
const day = (iso: string | null) => (iso ? formatStoredDate(iso, { withYear: false }) : '—');
const C = CARD_REFUND_WORDS.record;

/** Stripe's reference with Copy as the symbol alone (owner note, 2026-10-26: a smaller window). Copied fades. */
function RefCopy({ value }: { value: string }) {
  const [said, setSaid] = useState<'copied' | 'failed' | null>(null);
  useEffect(() => {
    if (said !== 'copied') return;
    const t = window.setTimeout(() => setSaid(null), 2000);
    return () => window.clearTimeout(t);
  }, [said]);
  return (
    <span className={styles.refLine}>
      <span className={styles.refValue}>{value}</span>
      <button type="button" className={styles.refCopy} aria-label={C.copyAria}
        onClick={() => { navigator.clipboard.writeText(value).then(() => setSaid('copied'), () => setSaid('failed')); }}>
        <Copy size={16} aria-hidden />
      </button>
      {said && <span className={ck.hint} role="status">{said === 'copied' ? C.copied : C.copyFailedDesk}</span>}
    </span>
  );
}

/** One refund of the payment, as "View the payment" reads it (12c words §1.4). */
function RefundBlock({ r, p, scopeNoun, entryNow, canDesk, onAnotherWay }: {
  r: TeamRefund; p: TeamOnlinePayment; scopeNoun: string; entryNow: number | null; canDesk: boolean; onAnotherWay: () => void;
}) {
  const bank = p.rail === 'bank_debit';
  const target = bank ? `the account ending ${p.bankLast4 ?? ''}` : cardLabel(p.brand, p.last4);
  const teamPaidFee = p.feePaidByPayer && p.feeCents > 0;
  const rows: Array<[string, React.ReactNode]> = [
    [C.amount, <>{C.amountValue(dollars(r.amountCents), target)}{r.part && <span className={ck.hint}> · {V.amountPart(scopeNoun)}</span>}</>],
  ];
  if (teamPaidFee) rows.push([C.fee, r.feeBackCents > 0 ? C.feeWhy.whole : C.feeWhy.keptPart]);
  if (r.reason) rows.push([C.reason, r.reason]);
  if (r.part && entryNow != null) rows.push([V.entry, V.entryValue(dollars(r.amountCents - r.feeBackCents), money(entryNow))]);
  rows.push([C.by, r.stripe ? C.byStripe(day(r.createdAt), clockOf(r.createdAt)) : C.byValue(r.by ?? '—', day(r.createdAt), clockOf(r.createdAt))]);
  if (r.state === 'refunded' && r.succeededAt) rows.push([C.reached(bank), C.reachedValue(day(r.succeededAt), clockOf(r.succeededAt))]);
  if (r.state === 'failed') rows.push([C.what, C.whatValue(day(r.createdAt), day(r.failedAt), bank)]);
  if (r.reference) rows.push([C.ref, <RefCopy key="ref" value={r.reference} />]);
  rows.push([V.emailed, r.state === 'failed' ? V.emailedNotFailed : r.state === 'anotherWay' ? C.emailedAnotherWay
    : r.emailedAt ? C.emailedSent(p.payerEmail ?? '—', day(r.emailedAt)) : p.payerEmail ? '—' : V.emailedNone]);
  return (
    <section className={styles.payRefund} aria-label={r.state === 'anotherWay' ? C.headingAnother : C.heading(bank)}>
      <h4 className={styles.payRefundHead}>
        <span>{r.state === 'anotherWay' ? C.headingAnother : C.heading(bank)}</span>
        <RepChip tone={r.state === 'failed' ? 'warn' : r.state === 'pending' ? 'info' : 'good'}>
          {r.state === 'failed' ? C.pill.failed(bank) : r.state === 'pending' ? C.pill.pending : C.pill.refunded}
        </RepChip>
        {r.stripe && <RepChip>{C.tagStripe}</RepChip>}
      </h4>
      <dl className={styles.payViewList}>
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {r.state === 'failed' && canDesk && (
        <button type="button" className={`btn btn-secondary ${styles.payRefundButton}`} onClick={onAnotherWay}>{C.button}</button>
      )}
    </section>
  );
}

export function PaymentViewWindow({ p, onClose, entryNow = null, canDesk = false, onAnotherWay }: {
  p: TeamOnlinePayment;
  onClose: () => void;
  /** The team's entry now (after its part refunds), for "Lowered $40.00 to $360.00". */
  entryNow?: number | null;
  /** Whoever runs tournaments: the button on a refund the card sent back (never the treasurer, §0f). */
  canDesk?: boolean;
  onAnotherWay?: () => void;
}) {
  const bank = p.rail === 'bank_debit';
  const rows: [string, string][] = [
    // 12c Part 6: a bank debit reads the account and both days (words §3.7 `payView.bank`).
    ...(bank
      ? [[V.started, p.startedAt ? formatStoredDate(p.startedAt) : '—'], [V.cleared, p.paidAt ? formatStoredDate(p.paidAt) : '—']] as [string, string][]
      : [[V.paid, p.paidAt ? paidAtLabel(p.paidAt) : '—']] as [string, string][]),
    [bank ? V.bank : V.card, bank ? V.bankValue(p.bankLast4 ?? '') : cardLabel(p.brand, p.last4)],
    [V.base, dollars(p.baseCents)],
    [p.feePaidByPayer ? V.feeTeam : V.feeClub, dollars(p.feeCents)],
    [V.total, dollars(p.totalCents)],
    ...(p.payerEmail ? [[V.from, p.payerEmail] as [string, string]] : []),
  ];
  return (
    <KitDialog kind="form" raised title={V.title(receiptLabel(p.receiptNo ?? ''))} onClose={onClose}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>{V.close}</button>}>
      <dl className={styles.payViewList}>
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {p.refunds.map(r => (
        <RefundBlock key={r.id} r={r} p={p} scopeNoun={SCOPE_WORDS.noun[p.scope]} entryNow={entryNow} canDesk={canDesk}
          onAnotherWay={() => onAnotherWay?.()} />
      ))}
    </KitDialog>
  );
}

export type RefundSend =
  | { kind: 'all'; feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null }
  | { kind: 'part'; amount: number; partialReason: string; note: string | null }
  | { kind: 'anotherWay'; feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null };

export function RefundWindow({ p, teamName, anotherWay, send, onClose, otherLabel = null }: {
  p: TeamOnlinePayment;
  teamName: string;
  /** Record a refund the club made another way (after a refund to the card came back), rather than refund to the card. */
  anotherWay: boolean;
  send: (body: RefundSend) => Promise<string | null>;
  onClose: () => void;
  /** The team's OTHER online payment ("balance" / "deposit"), when there is one, for "Refund the rest from the balance’s ⋯". */
  otherLabel?: string | null;
}) {
  const teamPaidFee = p.feePaidByPayer && p.feeCents > 0;
  const partDone = p.refunds.filter(r => r.part && r.state !== 'failed');
  const untouched = p.leftCents >= p.baseCents && partDone.length === 0;
  const [choice, setChoice] = useState<'all' | 'part' | null>(anotherWay ? 'all' : null);
  const [reason, setReason] = useState<'organizer_ended' | 'team_left'>('organizer_ended');
  const [feeIncluded, setFeeIncluded] = useState(true);
  const [touched, setTouched] = useState(false);
  const [amount, setAmount] = useState('');
  const [partReason, setPartReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paidDay = p.paidAt ? formatStoredDate(p.paidAt, { withYear: false }) : '';
  const receipt = receiptLabel(p.receiptNo ?? '');
  const scope = SCOPE_WORDS.scope[p.scope];
  const scopeNoun = SCOPE_WORDS.noun[p.scope];
  const left = dollars(p.leftCents);
  const typedCents = Math.round(Number(amount) * 100);
  const partOk = Number.isFinite(typedCents) && typedCents > 0 && typedCents <= p.leftCents;
  const bank = p.rail === 'bank_debit';

  function pickReason(next: 'organizer_ended' | 'team_left') {
    setReason(next);
    // A2 = C: the default follows who is ending it, until the organizer sets the box themselves.
    if (!touched) setFeeIncluded(next === 'organizer_ended');
  }

  async function go() {
    setError(null);
    if (choice === 'part') {
      if (!partOk) { setError(R.errAmount(left)); return; }
      if (!partReason.trim()) { setError(R.errReason); return; }
    }
    setBusy(true);
    const body: RefundSend = choice === 'part'
      ? { kind: 'part', amount: typedCents / 100, partialReason: partReason.trim(), note: note.trim() || null }
      : { kind: anotherWay ? 'anotherWay' : 'all', feeIncluded: teamPaidFee && feeIncluded, reason: teamPaidFee ? reason : null, note: note.trim() || null };
    const failed = await send(body);
    if (failed) { setError(failed); setBusy(false); }
  }

  const why = !teamPaidFee ? null
    : touched ? (feeIncluded ? R.feeOnChanged(dollars(p.feeCents)) : R.feeOffWhy(dollars(p.baseCents)))
      : reason === 'organizer_ended' ? R.feeOnWhy(dollars(p.feeCents)) : R.feeOffWhy(dollars(p.baseCents));
  const partSum = partDone.reduce((n, r) => n + r.amountCents, 0);
  const lastPart = partDone[0];

  return (
    <KitDialog
      kind="question"
      raised
      title={anotherWay ? R.titleAnotherWay : R.title(teamName, scope)}
      onClose={onClose}
      busy={busy}
      footerStart={anotherWay ? undefined : <span>{choice ? (p.payerEmail ? R.foot : R.footNoEmail) : R.footChoose}</span>}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{R.cancel}</button>
          {choice && (
            <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
              {busy ? R.working : anotherWay ? R.buttonAnotherWay : choice === 'part' ? (partOk ? R.partButton(dollars(typedCents)) : R.button) : R.button}
            </button>
          )}
        </>
      }
    >
      <p>{teamPaidFee
        ? R.paidTeams(dollars(p.totalCents), paidDay, receipt, dollars(p.baseCents), scopeNoun, dollars(p.feeCents))
        : R.paidClub(dollars(p.baseCents), paidDay, receipt, scopeNoun)}</p>
      {anotherWay && <p className={ck.hint}>{R.anotherWayLead}</p>}
      {!anotherWay && (
        <fieldset className={styles.refundChoice}>
          {untouched && (
            <label>
              <input type="radio" name="refund-how-much" checked={choice === 'all'} onChange={() => setChoice('all')} />
              {' '}{bank ? R.choiceAllBank(p.bankLast4 ?? '') : R.choiceAll(cardLabel(p.brand, p.last4))}
              <span className={ck.hint}> · {bank ? R.arrivesBank : R.arrives}</span>
            </label>
          )}
          <label>
            <input type="radio" name="refund-how-much" checked={choice === 'part'} onChange={() => setChoice('part')} />
            {' '}{R.choicePart}<span className={ck.hint}> · {R.choicePartSub(left)}</span>
          </label>
        </fieldset>
      )}
      {choice === 'part' && (
        <>
          <label className={ck.field}>
            <span className={ck.label}>{R.partAmount}<span className={ck.required} aria-hidden>*</span></span>
            <input className={ck.input} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-required="true" />
            <span className={ck.hint}>
              {partDone.length === 1 && lastPart ? R.partAlready(dollars(partSum), day(lastPart.createdAt), left)
                : partDone.length > 1 ? R.partAlreadyMany(dollars(partSum), partDone.length, left) : R.partLimit(left)}
              {teamPaidFee ? ` ${R.partFeeNote}` : ''}
            </span>
            {typedCents > p.leftCents && otherLabel && <span className={ck.hint}>{R.partBigger(left, possessive(otherLabel))}</span>}
            {partOk && <span className={ck.hint}>{R.partRest(dollars(p.leftCents - typedCents))}</span>}
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{R.partReason}<span className={ck.required} aria-hidden>*</span></span>
            <input className={ck.input} maxLength={500} value={partReason} onChange={e => setPartReason(e.target.value)} aria-required="true" />
            <span className={ck.hint}>{R.partReasonHint}</span>
          </label>
        </>
      )}
      {choice === 'all' && teamPaidFee && (
        <>
          <fieldset className={styles.refundChoice}>
            <legend className={ck.label}>{R.whoLabel}</legend>
            <label><input type="radio" name="refund-who" checked={reason === 'organizer_ended'} onChange={() => pickReason('organizer_ended')} /> {R.whoOrganizer}</label>
            <label><input type="radio" name="refund-who" checked={reason === 'team_left'} onChange={() => pickReason('team_left')} /> {R.whoTeam}</label>
          </fieldset>
          <label className={styles.refundFee}>
            <input type="checkbox" checked={feeIncluded} onChange={e => { setTouched(true); setFeeIncluded(e.target.checked); }} />
            <span>{R.feeCheckbox(dollars(p.feeCents), dollars(p.totalCents))}</span>
          </label>
          {why && <p className={ck.hint}>{why}</p>}
        </>
      )}
      {!anotherWay && choice && (
        <label className={ck.field}>
          <span className={ck.label}>{R.noteLabel}</span>
          <textarea className={ck.textarea} rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
          <span className={ck.hint}>{R.noteHint}</span>
        </label>
      )}
      {error && <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{error}</p>}
    </KitDialog>
  );
}
