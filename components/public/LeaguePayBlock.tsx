'use client';
/**
 * A HOUSE-LEAGUE FAMILY'S PAY BLOCK (Club Tier Stage 12b; drawn b1, k1, k2; words CLUB_TIER_STAGE12B_COPY.md §1, §10).
 * THE one pay block's pieces (`./PayBlock`) in the club's frame, for one sign-up: every child still owing on one line
 * each, one button for the whole owed total (siblings in one checkout, §0e a), the receipts of the sign-up's card
 * payments, and the confirming / not-finished states. Drawn only while the club takes card payments; otherwise the page
 * keeps today's words and draws no button (A6). 12c: bank debit beside the card; a debit clearing holds its children's
 * spots (siblings on one debit clear and return together), and a child not on it keeps the buttons.
 */

/** "Ava's spot is held." / "Spots are held for Ava and Leo." (words §2.2). */
const heldLine = (d: LeaguePayDebit) =>
  (d.childFirsts.length === 1 ? B.holdChild(possessive(d.childFirsts[0])) : B.holdChildren(childList(d.childFirsts)));
import { useState } from 'react';
import { BANK_DEBIT_WORDS as B, PAY_WORDS as W } from '@/lib/online-payment-words';
import { possessive } from '@/lib/utils';
import { LEAGUE_PAY_WORDS as LW, childList } from '@/lib/league-pay-words';
import type { LeaguePayDebit, LeaguePayView } from '@/lib/league-pay-view';
import {
  ClearingState, ConfirmingState, NotFinishedState, PayButtons, PayError, PayFrame, PayerEmailField, PolicyAndOtherWays, ReceiptCard,
  Receipts, ReturnedNotice, TestLine, openCheckout, payBlockStyles as pb, payDollars as dollars, usePaymentConfirming,
  type PayRail,
} from './PayBlock';
import kit from './ClubKit.module.css';

export default function LeaguePayBlock({ pay, returnedSession, left }: {
  pay: LeaguePayView; returnedSession: string | null; left: boolean;
}) {
  const { confirming, slow } = usePaymentConfirming(s => `/api/pay/league/${pay.token}/status?session=${encodeURIComponent(s)}`, returnedSession);
  return (
    <PayFrame inClub>
      {pay.testMode && <TestLine text={W.testLine} />}
      {confirming ? (
        <div className={kit.card}><ConfirmingState slow={slow} payerEmail={pay.payerEmail} /></div>
      ) : (
        <>
          {left && pay.kind === 'owing' && <NotFinishedState />}
          <LeagueReceipts pay={pay} />
          {pay.clearing.map(d => (
            <div key={d.id} className={kit.card}>
              <ClearingState totalCents={d.totalCents} last4={d.last4} startedAt={d.startedAt} held={heldLine(d)}
                clubName={pay.clubName} contact={pay.clubContact} />
            </div>
          ))}
          {pay.kind === 'owing' && pay.returned && (
            <ReturnedNotice returnedAt={pay.returned.returnedAt} reason={pay.returned.reason} held={heldLine(pay.returned)} />
          )}
          {pay.kind === 'owing' && <Owing pay={pay} />}
          {pay.kind === 'paid' && <p className={pb.note}>{LW.paidTitle}</p>}
          {pay.kind === 'refused' && pay.message && <div className={kit.card}><p style={{ margin: 0 }}>{pay.message}</p></div>}
        </>
      )}
    </PayFrame>
  );
}

/** The sign-up's card payments, newest first: one line per child, the fee only when the family paid it. */
function LeagueReceipts({ pay }: { pay: LeaguePayView }) {
  if (!pay.receipts.length) return null;
  return (
    <Receipts revisit={LW.revisit}>
      {pay.receipts.map(r => (
        <ReceiptCard
          key={r.id}
          title={r.refunded ? LW.receiptRefunded : W.paidTitle}
          test={r.test} totalCents={r.totalCents} clubName={pay.clubName} brand={r.brand} last4={r.last4}
          paidAt={r.paidAt} receiptNo={r.receiptNo} lines={r.lines} feeCents={r.feePaidByPayer ? r.feeCents : null}
          bank={r.bank ? { last4: r.bankLast4, startedAt: r.startedAt } : null}
        />
      ))}
    </Receipts>
  );
}

/** What is owed, child by child, then Pay. The server re-reads the amount; a changed amount reloads the page. */
function Owing({ pay }: { pay: LeaguePayView }) {
  const [email, setEmail] = useState(pay.payerEmail ?? '');
  const [opening, setOpening] = useState<PayRail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(rail: PayRail) {
    const totalCents = rail === 'bank_debit' ? pay.bankTotalCents : pay.totalCents;
    if (totalCents == null) return;
    setOpening(rail);
    setError(null);
    const r = await openCheckout(`/api/pay/league/${pay.token}`, { rail, totalCents, email });
    if ('url' in r) { window.location.assign(r.url); return; }
    if ('changed' in r) { window.location.reload(); return; }
    setError(r.error);
    setOpening(null);
  }

  return (
    <section className={`${kit.card} ${pb.owing}`} aria-label={LW.heading}>
      <h2>{LW.heading}</h2>
      <ul className={pb.owingLines}>
        {pay.lines.map(l => (
          <li key={l.childName}>
            {l.part
              ? LW.lineChildPart(l.childName, l.divisionName, dollars(l.owingCents), dollars(l.feeCents))
              : LW.lineChild(l.childName, l.divisionName, dollars(l.owingCents))}
          </li>
        ))}
        {pay.clearingLines.map(l => <li key={l.childName}>{B.lineClearing(l.childName, l.divisionName, dollars(l.cents))}</li>)}
      </ul>
      <PayerEmailField value={email} onChange={setEmail} disabled={opening !== null} />
      <PayButtons totalCents={pay.totalCents} feeCents={pay.feeCents} bankTotalCents={pay.bankTotalCents} bankFeeCents={pay.bankFeeCents}
        feePaidByPayer={pay.feePaidByPayer} opening={opening} onPay={rail => void go(rail)}
        buttonClass={`${kit.btn} ${kit.btnPrimary}`} bankButtonClass={`${kit.btn} ${kit.btnOutline}`} />
      <PayError message={error} />
      <PolicyAndOtherWays refundPolicy={pay.refundPolicy} howToPay={pay.howToPay} />
    </section>
  );
}
