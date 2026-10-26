'use client';
/**
 * A HOUSE-LEAGUE FAMILY'S PAY BLOCK (Club Tier Stage 12b; drawn b1, k1, k2; words CLUB_TIER_STAGE12B_COPY.md §1, §10).
 * THE one pay block's pieces (`./PayBlock`) in the club's frame, for one sign-up: every child still owing on one line
 * each, one button for the whole owed total (siblings in one checkout, §0e a), the receipts of the sign-up's card
 * payments, and the confirming / not-finished states. Drawn only while the club takes card payments; otherwise the page
 * keeps today's words and draws no button (A6).
 */
import { useState } from 'react';
import { PAY_WORDS as W } from '@/lib/online-payment-words';
import { LEAGUE_PAY_WORDS as LW } from '@/lib/league-pay-words';
import type { LeaguePayView } from '@/lib/league-pay-view';
import {
  ConfirmingState, NotFinishedState, PayButton, PayError, PayFrame, PayerEmailField, PolicyAndOtherWays, ReceiptCard,
  Receipts, TestLine, openCheckout, payBlockStyles as pb, payDollars as dollars, usePaymentConfirming,
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
        />
      ))}
    </Receipts>
  );
}

/** What is owed, child by child, then Pay. The server re-reads the amount; a changed amount reloads the page. */
function Owing({ pay }: { pay: LeaguePayView }) {
  const [email, setEmail] = useState(pay.payerEmail ?? '');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setOpening(true);
    setError(null);
    const r = await openCheckout(`/api/pay/league/${pay.token}`, { totalCents: pay.totalCents, email });
    if ('url' in r) { window.location.assign(r.url); return; }
    if ('changed' in r) { window.location.reload(); return; }
    setError(r.error);
    setOpening(false);
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
      </ul>
      <PayerEmailField value={email} onChange={setEmail} disabled={opening} />
      <PayButton totalCents={pay.totalCents} feeCents={pay.feeCents} feePaidByPayer={pay.feePaidByPayer}
        opening={opening} onPay={() => void go()} buttonClass={`${kit.btn} ${kit.btnPrimary}`} />
      <PayError message={error} />
      <PolicyAndOtherWays refundPolicy={pay.refundPolicy} howToPay={pay.howToPay} />
    </section>
  );
}
