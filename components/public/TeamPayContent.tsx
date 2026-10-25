'use client';
/**
 * A TOURNAMENT TEAM'S PAY PAGE (Club Tier Stage 12a — drawn 12c §1–§3 and the Checkout tab; words copy §8, §9, §13, §18).
 * In the tournament's theme (it sits under the tournament's own address and layout). One pay block, its states:
 *
 *   owing          deposit or full (A7, deposit pre-selected; the saving only while the team pays the fee), Pay {total}
 *                  by card — both choices and the button disable on press ("Opening the secure payment page…")
 *   confirming     back from Stripe: waits for the RECORD, never "Paid" on the redirect alone; polls the status route
 *   not finished   left Stripe's page: nothing charged, the owing block again
 *   paid           the receipt(s); the balance still owed, if any, under them
 *   nothing / already paid / refused, and NOT TAKING PAYMENTS — today's panel, word for word (A6)
 */
import { useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { PAY_WORDS as W, cardLabel, money, paidAtLabel, receiptLabel } from '@/lib/online-payment-words';
import { formatStoredDate } from '@/lib/timezone';
import type { PayPageView, PayPageReceipt } from '@/lib/team-pay-view';
import type { PayScope } from '@/lib/team-pay-options';
import reg from '@/app/[orgSlug]/register/register.module.css';
import styles from './TeamPay.module.css';

const SLOW_AFTER_MS = 20_000;
const dollars = (cents: number) => money(cents / 100);
const day = (d: string | null) => (d ? formatStoredDate(d, { withYear: false }) : null);

export default function TeamPayContent({ token, view, returnedSession, left }: {
  token: string; view: PayPageView; returnedSession: string | null; left: boolean;
}) {
  // Back from Stripe: wait for the record. Paid reloads the page from the server; nothing here ever says Paid by itself.
  const phase: 'idle' | 'confirming' = returnedSession ? 'confirming' : 'idle';
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!returnedSession || phase !== 'confirming') return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      const res = await fetch(`/api/pay/team/${token}/status?session=${encodeURIComponent(returnedSession)}`, { cache: 'no-store' }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (stop) return;
      // A session this link doesn't know: stop waiting and show the page as it stands.
      if (res?.status === 404) { window.location.replace(window.location.pathname); return; }
      if (data?.state === 'paid') {
        // The record has it: re-read the page from the server so the receipt is the stored one.
        window.location.replace(window.location.pathname);
        return;
      }
      if (data?.state === 'not_finished') { window.location.replace(`${window.location.pathname}?left=1`); return; }
      if (Date.now() - started > SLOW_AFTER_MS) setSlow(true);
      setTimeout(() => void tick(), 2_000);
    };
    void tick();
    return () => { stop = true; };
  }, [returnedSession, phase, token]);

  if (view.kind === 'invalid') {
    return <div className={reg.errorCard}><p>{view.message}</p></div>;
  }

  return (
    <div className={styles.page}>
      <div className={reg.formCard}>
        <p className={styles.eyebrow}>{view.tournamentName}</p>
        <h1 className={styles.title}>{W.who(view.teamName, view.divisionName)}</h1>
        {view.testMode && <p className={styles.test}>{W.testLine}</p>}

        {phase === 'confirming' ? (
          <div className={styles.state} role="status" aria-live="polite">
            <h2>{W.confirmingTitle}</h2>
            <p>{slow ? W.confirmingSlow(view.payerEmail) : W.confirmingBody}</p>
          </div>
        ) : (
          <>
            {left && view.kind === 'owing' && (
              <div className={styles.state} role="status">
                <h2>{W.notFinishedTitle}</h2>
                <p>{W.notFinishedBody}</p>
              </div>
            )}
            <Receipts view={view} />
            {view.kind === 'owing' && <Owing token={token} view={view} />}
            {view.kind === 'already' && view.receipts.length === 0 && (
              <div className={styles.state}><h2>{W.alreadyTitle(view.teamName)}</h2><p>{W.alreadyBody}</p></div>
            )}
            {view.kind === 'already' && view.receipts.length > 0 && !view.receipts.every(r => r.refunded) && (
              <p className={styles.note}>{W.alreadyBody}</p>
            )}
            {view.kind === 'nothing' && (
              <div className={styles.state}><h2>{W.nothingTitle}</h2><p>{W.nothingBody(view.teamName)}</p></div>
            )}
            {view.kind === 'refused' && <div className={styles.state}><p>{view.message}</p></div>}
            {view.kind === 'not_taking' && <TodaysPanel view={view} />}
          </>
        )}
      </div>
    </div>
  );
}

/** The team's receipts on this link: each card payment, newest first, with a refund marked as such. */
function Receipts({ view }: { view: PayPageView }) {
  if (!view.receipts.length) return null;
  return (
    <section className={styles.receipts} aria-label={W.receiptsHeading}>
      {view.receipts.map(r => <Receipt key={r.id} r={r} view={view} />)}
      <p className={styles.note}>{W.revisit}</p>
    </section>
  );
}

function Receipt({ r, view }: { r: PayPageReceipt; view: PayPageView }) {
  return (
    <div className={styles.receipt}>
      {r.test && <p className={styles.test}>{W.testReceipt}</p>}
      <h2>{r.refunded && r.refundedAt ? W.refundedTag(day(r.refundedAt) ?? '') : W.paidTitle}</h2>
      <p className={styles.receiptTo}>{W.paidTo(dollars(r.totalCents), view.clubName)}</p>
      <p className={styles.note}>{W.paidLine(cardLabel(r.brand, r.last4), r.paidAt ? paidAtLabel(r.paidAt) : '', receiptLabel(r.receiptNo ?? ''))}</p>
      <dl className={styles.lines}>
        <div><dt>{W.receiptLine[r.scope]}</dt><dd>{dollars(r.baseCents)}</dd></div>
        {r.feePaidByPayer && r.feeCents > 0 && <div><dt>{W.receiptFee}</dt><dd>{dollars(r.feeCents)}</dd></div>}
        <div className={styles.total}><dt>{W.receiptTotal}</dt><dd>{dollars(r.totalCents)}</dd></div>
      </dl>
    </div>
  );
}

/** Deposit or full (A7), then Pay by card. The server re-reads the amount; a changed amount sends the team back here. */
function Owing({ token, view }: { token: string; view: PayPageView }) {
  const [scope, setScope] = useState<PayScope | null>(view.preselected);
  const [email, setEmail] = useState(view.payerEmail ?? '');
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const chosen = useMemo(() => view.choices.find(c => c.scope === scope) ?? view.choices[0], [scope, view.choices]);
  const deposit = view.choices.find(c => c.scope === 'deposit');
  const full = view.choices.find(c => c.scope === 'full');
  const balance = view.choices.find(c => c.scope === 'balance');

  async function pay() {
    if (!chosen) return;
    setOpening(true);
    setError(null);
    try {
      const res = await fetch(`/api/pay/team/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: chosen.scope, totalCents: chosen.totalCents, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        if (data.changed) { window.location.reload(); return; }
        throw new Error(data.error ?? W.error.couldntOpen);
      }
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : W.error.couldntOpen);
      setOpening(false);
    }
  }

  return (
    <section className={styles.owing}>
      {balance ? (
        <>
          {view.totalPaidCents > 0 && <p className={styles.note}>{W.paidSoFar(view.teamName, dollars(view.totalPaidCents))}</p>}
          <h2>{W.balanceHeading(dollars(balance.baseCents))}</h2>
          {balance.dueDate && <p className={styles.note}>{W.balanceDue(day(balance.dueDate)!)}</p>}
        </>
      ) : deposit && full ? (
        <fieldset className={styles.choices} disabled={opening}>
          <legend className={styles.legend}>{W.heading}</legend>
          <label className={styles.choice}>
            <input type="radio" name="pay-scope" checked={scope === 'deposit'} onChange={() => setScope('deposit')} />
            <span>
              <strong>{W.chooseDeposit(dollars(deposit.baseCents))}</strong>
              <span className={styles.note}>{W.chooseDepositHint(dollars(full.baseCents - deposit.baseCents), day(full.dueDate))}</span>
            </span>
          </label>
          <label className={styles.choice}>
            <input type="radio" name="pay-scope" checked={scope === 'full'} onChange={() => setScope('full')} />
            <span>
              <strong>{W.chooseFull(dollars(full.baseCents))}</strong>
              {view.savingCents ? <span className={styles.note}>{W.savingLine(dollars(view.savingCents))}</span> : null}
            </span>
          </label>
        </fieldset>
      ) : full ? (
        <h2>{W.noDepositHeading(dollars(full.baseCents))}</h2>
      ) : null}

      <label className={styles.field}>
        <span className={styles.legend}>{W.emailLabel}</span>
        <input type="email" className={styles.input} value={email} onChange={e => setEmail(e.target.value)} disabled={opening} autoComplete="email" />
      </label>

      {chosen && (
        <div className={styles.payRow}>
          <button type="button" className={`btn btn-primary ${styles.payButton}`} onClick={() => void pay()} disabled={opening}>
            <CreditCard size={18} aria-hidden /> {opening ? W.opening : W.button(dollars(chosen.totalCents))}
          </button>
          {view.feePaidByPayer && chosen.feeCents > 0 && <span className={styles.note}>{W.buttonFeeNote(dollars(chosen.feeCents))}</span>}
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {view.refundPolicy && (
        <>
          <button type="button" className={styles.link} onClick={() => setShowPolicy(s => !s)} aria-expanded={showPolicy}>{W.refundPolicyLink}</button>
          {showPolicy && <p className={styles.note}>{view.refundPolicy}</p>}
        </>
      )}
      {view.howToPay && <p className={styles.note}>{W.otherWays(view.howToPay)}</p>}
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
