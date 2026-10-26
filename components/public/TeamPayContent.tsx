'use client';
/**
 * A TOURNAMENT TEAM'S PAY PAGE (Club Tier Stage 12a — drawn 12c §1–§3 and the Checkout tab; words copy §8, §9, §13, §18).
 * In the tournament's theme (it sits under the tournament's own address and layout). The pay block's shared pieces —
 * the button, the confirming wait, not finished, the receipt card — are THE one pay block (`./PayBlock`, Stage 12b §0e d);
 * this page adds the team's own part:
 *
 *   owing          deposit or full (A7, deposit pre-selected; the saving only while the team pays the fee), Pay {total}
 *                  by card — both choices and the button disable on press ("Opening the secure payment page…")
 *   confirming     back from Stripe: waits for the RECORD, never "Paid" on the redirect alone; polls the status route
 *   not finished   left Stripe's page: nothing charged, the owing block again
 *   paid           the receipt(s); the balance still owed, if any, under them
 *   nothing / already paid / refused, and NOT TAKING PAYMENTS — today's panel, word for word (A6)
 */
import { useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { PAY_WORDS as W } from '@/lib/online-payment-words';
import { formatStoredDate } from '@/lib/timezone';
import type { PayPageView, PayPageReceipt } from '@/lib/team-pay-view';
import type { PayScope } from '@/lib/team-pay-options';
import reg from '@/app/[orgSlug]/register/register.module.css';
import {
  ConfirmingState, NotFinishedState, PayButton, PayError, PayFrame, PayerEmailField, PolicyAndOtherWays, ReceiptCard,
  Receipts as ReceiptList, TestLine, openCheckout, payBlockStyles as pb, payDollars as dollars, usePaymentConfirming,
} from './PayBlock';
import styles from './TeamPay.module.css';

const day = (d: string | null) => (d ? formatStoredDate(d, { withYear: false }) : null);

export default function TeamPayContent({ token, view, returnedSession, left }: {
  token: string; view: PayPageView; returnedSession: string | null; left: boolean;
}) {
  // Back from Stripe: wait for the record. Paid reloads the page from the server; nothing here ever says Paid by itself.
  const { confirming, slow } = usePaymentConfirming(s => `/api/pay/team/${token}/status?session=${encodeURIComponent(s)}`, returnedSession);

  if (view.kind === 'invalid') {
    return <div className={reg.errorCard}><p>{view.message}</p></div>;
  }

  return (
    <div className={styles.page}>
      <div className={reg.formCard}>
        <PayFrame>
          <p className={styles.eyebrow}>{view.tournamentName}</p>
          <h1 className={styles.title}>{W.who(view.teamName, view.divisionName)}</h1>
          {view.testMode && <TestLine text={W.testLine} />}

          {confirming ? (
            <ConfirmingState slow={slow} payerEmail={view.payerEmail} />
          ) : (
            <>
              {left && view.kind === 'owing' && <NotFinishedState />}
              <Receipts view={view} />
              {view.kind === 'owing' && <Owing token={token} view={view} />}
              {view.kind === 'already' && view.receipts.length === 0 && (
                <div className={pb.state}><h2>{W.alreadyTitle(view.teamName)}</h2><p>{W.alreadyBody}</p></div>
              )}
              {view.kind === 'already' && view.receipts.length > 0 && !view.receipts.every(r => r.refunded) && (
                <p className={pb.note}>{W.alreadyBody}</p>
              )}
              {view.kind === 'nothing' && (
                <div className={pb.state}><h2>{W.nothingTitle}</h2><p>{W.nothingBody(view.teamName)}</p></div>
              )}
              {view.kind === 'refused' && <div className={pb.state}><p>{view.message}</p></div>}
              {view.kind === 'not_taking' && <TodaysPanel view={view} />}
            </>
          )}
        </PayFrame>
      </div>
    </div>
  );
}

/** The team's receipts on this link: each card payment, newest first, with a refund marked as such. */
function Receipts({ view }: { view: PayPageView }) {
  if (!view.receipts.length) return null;
  return <ReceiptList revisit={W.revisit}>{view.receipts.map(r => <Receipt key={r.id} r={r} view={view} />)}</ReceiptList>;
}

function Receipt({ r, view }: { r: PayPageReceipt; view: PayPageView }) {
  return (
    <ReceiptCard
      title={r.refunded && r.refundedAt ? W.refundedTag(day(r.refundedAt) ?? '') : W.paidTitle}
      test={r.test} totalCents={r.totalCents} clubName={view.clubName} brand={r.brand} last4={r.last4}
      paidAt={r.paidAt} receiptNo={r.receiptNo}
      lines={[{ label: W.receiptLine[r.scope], cents: r.baseCents }]}
      feeCents={r.feePaidByPayer ? r.feeCents : null}
    />
  );
}

/** Deposit or full (A7), then Pay by card. The server re-reads the amount; a changed amount sends the team back here. */
function Owing({ token, view }: { token: string; view: PayPageView }) {
  const [scope, setScope] = useState<PayScope | null>(view.preselected);
  const [email, setEmail] = useState(view.payerEmail ?? '');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = useMemo(() => view.choices.find(c => c.scope === scope) ?? view.choices[0], [scope, view.choices]);
  const deposit = view.choices.find(c => c.scope === 'deposit');
  const full = view.choices.find(c => c.scope === 'full');
  const balance = view.choices.find(c => c.scope === 'balance');

  async function pay() {
    if (!chosen) return;
    setOpening(true);
    setError(null);
    const r = await openCheckout(`/api/pay/team/${token}`, { scope: chosen.scope, totalCents: chosen.totalCents, email });
    if ('url' in r) { window.location.assign(r.url); return; }
    if ('changed' in r) { window.location.reload(); return; }
    setError(r.error);
    setOpening(false);
  }

  return (
    <section className={pb.owing}>
      {balance ? (
        <>
          {view.totalPaidCents > 0 && <p className={pb.note}>{W.paidSoFar(view.teamName, dollars(view.totalPaidCents))}</p>}
          <h2>{W.balanceHeading(dollars(balance.baseCents))}</h2>
          {balance.dueDate && <p className={pb.note}>{W.balanceDue(day(balance.dueDate)!)}</p>}
        </>
      ) : deposit && full ? (
        <fieldset className={styles.choices} disabled={opening}>
          <legend className={styles.legend}>{W.heading}</legend>
          <label className={styles.choice}>
            <input type="radio" name="pay-scope" checked={scope === 'deposit'} onChange={() => setScope('deposit')} />
            <span>
              <strong>{W.chooseDeposit(dollars(deposit.baseCents))}</strong>
              <span className={pb.note}>{W.chooseDepositHint(dollars(full.baseCents - deposit.baseCents), day(full.dueDate))}</span>
            </span>
          </label>
          <label className={styles.choice}>
            <input type="radio" name="pay-scope" checked={scope === 'full'} onChange={() => setScope('full')} />
            <span>
              <strong>{W.chooseFull(dollars(full.baseCents))}</strong>
              {view.savingCents ? <span className={pb.note}>{W.savingLine(dollars(view.savingCents))}</span> : null}
            </span>
          </label>
        </fieldset>
      ) : full ? (
        <h2>{W.noDepositHeading(dollars(full.baseCents))}</h2>
      ) : null}

      <PayerEmailField value={email} onChange={setEmail} disabled={opening} />
      {chosen && (
        <PayButton totalCents={chosen.totalCents} feeCents={chosen.feeCents} feePaidByPayer={view.feePaidByPayer}
          opening={opening} onPay={() => void pay()} buttonClass="btn btn-primary" />
      )}
      <PayError message={error} />
      <PolicyAndOtherWays refundPolicy={view.refundPolicy} howToPay={view.howToPay} />
    </section>
  );
}

/** Not taking payments: today's "Payment handled by organizer" panel, word for word (A6). */
function TodaysPanel({ view }: { view: PayPageView }) {
  const s = view.schedule;
  return (
    <div className={reg.paymentNotice}>
      <div className={reg.paymentNoticeHeader}><CreditCard size={18} /><span>{W.notTakingHeader}</span></div>
      {s.totalCents ? (
        <div className={reg.paymentDetails}>
          <div>
            <span>{W.notTakingTotal}</span>
            <strong>{dollars(s.totalCents)}</strong>
            {s.totalDue && <em>{W.notTakingDue(day(s.totalDue)!)}</em>}
          </div>
          {s.depositCents ? (
            <div>
              <span>{W.notTakingDeposit}</span>
              <strong>{dollars(s.depositCents)}</strong>
              {s.depositDue && <em>{W.notTakingDue(day(s.depositDue)!)}</em>}
            </div>
          ) : null}
        </div>
      ) : (
        <p>{W.notTakingNoSchedule}</p>
      )}
      {view.howToPay && (
        <div className={reg.paymentInstructions}>
          <span className={reg.paymentInstructionsLabel}>{W.notTakingHowLabel}</span>
          <p>{view.howToPay}</p>
        </div>
      )}
      <p>{W.notTakingFoot}</p>
    </div>
  );
}
