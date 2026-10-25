'use client';
/**
 * A team record's online-payment windows (Club Tier Stage 12a — words copy §15–§16; Books & refunds §3 drawn for the
 * house-league row, here in tournament form):
 *
 *   View the payment   read-only: when, the card, the entry fee, the processing fee and who paid it, the total, from whom
 *   Refund             in full, to the card (A12). While the team paid the fee: who is ending it, and the fee box (A2 = C:
 *                      on when the organizer ends it, off when the team asked to leave; the organizer can change it). A
 *                      fee given back comes from the club (FieldLogicHQ keeps its fee, plan §0c). A note for the email.
 *                      The same window records a refund made ANOTHER way after a refund to the card came back.
 *
 * Both open over the team's record (`raised`). The refund asks (create asks): nothing moves until the button is pressed.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { formatStoredDate } from '@/lib/timezone';
import {
  PAY_VIEW_WORDS as V, REFUND_WORDS as R, cardLabel, money, paidAtLabel, receiptLabel,
} from '@/lib/online-payment-words';
import type { TeamOnlinePayment } from '@/lib/team-payments';
import styles from '../teams-admin.module.css';

const dollars = (cents: number) => money(cents / 100);

export function PaymentViewWindow({ p, onClose }: { p: TeamOnlinePayment; onClose: () => void }) {
  const rows: [string, string][] = [
    [V.paid, p.paidAt ? paidAtLabel(p.paidAt) : '—'],
    [V.card, cardLabel(p.brand, p.last4)],
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
    </KitDialog>
  );
}

export function RefundWindow({ p, teamName, anotherWay, send, onClose }: {
  p: TeamOnlinePayment;
  teamName: string;
  /** Record a refund the club made another way (after a refund to the card came back), rather than refund to the card. */
  anotherWay: boolean;
  send: (body: { feeIncluded: boolean; reason: 'organizer_ended' | 'team_left' | null; note: string | null }) => Promise<string | null>;
  onClose: () => void;
}) {
  const teamPaidFee = p.feePaidByPayer && p.feeCents > 0;
  const [reason, setReason] = useState<'organizer_ended' | 'team_left'>('organizer_ended');
  const [feeIncluded, setFeeIncluded] = useState(true);
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const day = p.paidAt ? formatStoredDate(p.paidAt, { withYear: false }) : '';

  function pickReason(next: 'organizer_ended' | 'team_left') {
    setReason(next);
    // A2 = C: the default follows who is ending it, until the organizer sets the box themselves.
    if (!touched) setFeeIncluded(next === 'organizer_ended');
  }

  async function go() {
    setBusy(true);
    setError(null);
    const failed = await send({ feeIncluded: teamPaidFee && feeIncluded, reason: teamPaidFee ? reason : null, note: note.trim() || null });
    if (failed) { setError(failed); setBusy(false); }
  }

  const why = !teamPaidFee ? null
    : touched ? (feeIncluded ? R.feeOnChanged(dollars(p.feeCents)) : R.feeOffWhy(dollars(p.baseCents)))
      : reason === 'organizer_ended' ? R.feeOnWhy(dollars(p.feeCents)) : R.feeOffWhy(dollars(p.baseCents));

  return (
    <KitDialog
      kind="question"
      raised
      title={anotherWay ? R.titleAnotherWay : R.title(teamName)}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{R.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
            {busy ? R.working : anotherWay ? R.buttonAnotherWay : R.button}
          </button>
        </>
      }
    >
      <p>{teamPaidFee
        ? R.paidTeams(teamName, dollars(p.totalCents), day, dollars(p.baseCents), dollars(p.feeCents))
        : R.paidClub(teamName, dollars(p.baseCents), day)}</p>
      {anotherWay ? <p className={ck.hint}>{R.anotherWayLead}</p> : (
        <p>{R.target(cardLabel(p.brand, p.last4))} <span className={ck.hint}>· {R.arrives}</span></p>
      )}
      {teamPaidFee && (
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
      {!anotherWay && (
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
