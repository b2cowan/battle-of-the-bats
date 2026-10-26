'use client';
/**
 * THE ONE PAY BLOCK (Club Tier Stage 12b, owner §0e d — the drawings' k1, "one pay block for every flow"). The pieces a
 * tournament team's pay page (`TeamPayContent`) and a house-league family's status page (`LeaguePayBlock`) share, so the
 * six states read the same for both and bank debit (12c) is added in one place:
 *
 *   owing          the button carries its own total; the processing fee under it only while the payer pays it (A14);
 *                  it disables on press ("Opening the secure payment page…")
 *   confirming     back from Stripe: waits for the RECORD, never "Paid" on the redirect alone (`usePaymentConfirming`)
 *   not finished   left Stripe's page: nothing charged
 *   paid           the receipt card(s)
 *   not taking payments / no longer payable — the flow's own words (each page keeps today's panel verbatim, A6)
 * Words are 12a's (`PAY_WORDS`); no rate is typed here.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CreditCard } from 'lucide-react';
import { PAY_WORDS as W, cardLabel, money, paidAtLabel, receiptLabel } from '@/lib/online-payment-words';
import styles from './PayBlock.module.css';

const SLOW_AFTER_MS = 20_000;
export const payDollars = (cents: number) => money(cents / 100);

/** The block's colour frame: the tournament's theme by default, the club's inside a club page. */
export function PayFrame({ inClub = false, children }: { inClub?: boolean; children: ReactNode }) {
  return <div className={`${styles.block} ${inClub ? styles.inClub : ''}`}>{children}</div>;
}

/**
 * Back from Stripe with `?paid={session}`: poll the flow's status route until the payment is RECORDED, then reload the
 * page from the server (the receipt is the stored one). `not_finished` sends the page to `?left=1`; a session the link
 * doesn't know stops waiting and shows the page as it stands.
 */
export function usePaymentConfirming(statusUrl: (session: string) => string, returnedSession: string | null): { confirming: boolean; slow: boolean } {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!returnedSession) return;
    let stop = false;
    const started = Date.now();
    const tick = async () => {
      if (stop) return;
      const res = await fetch(statusUrl(returnedSession), { cache: 'no-store' }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (stop) return;
      if (res?.status === 404) { window.location.replace(window.location.pathname); return; }
      if (data?.state === 'paid') { window.location.replace(window.location.pathname); return; }
      if (data?.state === 'not_finished') { window.location.replace(`${window.location.pathname}?left=1`); return; }
      if (Date.now() - started > SLOW_AFTER_MS) setSlow(true);
      setTimeout(() => void tick(), 2_000);
    };
    void tick();
    return () => { stop = true; };
    // statusUrl is a pure builder; re-polling on a new function identity would double the timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedSession]);
  return { confirming: !!returnedSession, slow };
}

export function ConfirmingState({ slow, payerEmail }: { slow: boolean; payerEmail: string | null }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <h2>{W.confirmingTitle}</h2>
      <p>{slow ? W.confirmingSlow(payerEmail) : W.confirmingBody}</p>
    </div>
  );
}

export function NotFinishedState() {
  return (
    <div className={styles.state} role="status">
      <h2>{W.notFinishedTitle}</h2>
      <p>{W.notFinishedBody}</p>
    </div>
  );
}

export function TestLine({ text }: { text: string }) {
  return <p className={styles.test}>{text}</p>;
}

/** A receipt card: the title, "{total} to {club}", the card line, then the lines, the fee (only when the payer paid it)
 *  and the total. */
export function ReceiptCard({ title, test, totalCents, clubName, brand, last4, paidAt, receiptNo, lines, feeCents }: {
  title: string; test: boolean; totalCents: number; clubName: string; brand: string | null; last4: string | null;
  paidAt: string | null; receiptNo: number | null; lines: { label: string; cents: number }[]; feeCents: number | null;
}) {
  return (
    <div className={styles.receipt}>
      {test && <p className={styles.test}>{W.testReceipt}</p>}
      <h2>{title}</h2>
      <p className={styles.receiptTo}>{W.paidTo(payDollars(totalCents), clubName)}</p>
      <p className={styles.note}>{W.paidLine(cardLabel(brand, last4), paidAt ? paidAtLabel(paidAt) : '', receiptLabel(receiptNo ?? ''))}</p>
      <dl className={styles.lines}>
        {lines.map((l, i) => <div key={i}><dt>{l.label}</dt><dd>{payDollars(l.cents)}</dd></div>)}
        {feeCents != null && feeCents > 0 && <div><dt>{W.receiptFee}</dt><dd>{payDollars(feeCents)}</dd></div>}
        <div className={styles.total}><dt>{W.receiptTotal}</dt><dd>{payDollars(totalCents)}</dd></div>
      </dl>
    </div>
  );
}

export function Receipts({ children, revisit }: { children: ReactNode; revisit: string }) {
  return (
    <section className={styles.receipts} aria-label={W.receiptsHeading}>
      {children}
      <p className={styles.note}>{revisit}</p>
    </section>
  );
}

/** The payer's email for the receipt (prefilled when the flow knows one). */
export function PayerEmailField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{W.emailLabel}</span>
      <input type="email" className={styles.input} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} autoComplete="email" />
    </label>
  );
}

/** Pay {total} by card — the label is the amount, always; the fee note only while the payer pays the fee (A14). */
export function PayButton({ totalCents, feeCents, feePaidByPayer, opening, onPay, buttonClass }: {
  totalCents: number; feeCents: number; feePaidByPayer: boolean; opening: boolean; onPay: () => void; buttonClass: string;
}) {
  return (
    <div className={styles.payRow}>
      <button type="button" className={`${buttonClass} ${styles.payButton}`} onClick={onPay} disabled={opening}>
        <CreditCard size={18} aria-hidden /> {opening ? W.opening : W.button(payDollars(totalCents))}
      </button>
      {feePaidByPayer && feeCents > 0 && <span className={styles.note}>{W.buttonFeeNote(payDollars(feeCents))}</span>}
    </div>
  );
}

export function PayError({ message }: { message: string | null }) {
  return message ? <p className={styles.error} role="alert">{message}</p> : null;
}

/** The club's optional refund policy (A9) and its "How to pay" text as the other way to pay. */
export function PolicyAndOtherWays({ refundPolicy, howToPay }: { refundPolicy: string | null; howToPay: string | null }) {
  const [showPolicy, setShowPolicy] = useState(false);
  return (
    <>
      {refundPolicy && (
        <>
          <button type="button" className={styles.link} onClick={() => setShowPolicy(s => !s)} aria-expanded={showPolicy}>{W.refundPolicyLink}</button>
          {showPolicy && <p className={styles.note}>{refundPolicy}</p>}
        </>
      )}
      {howToPay && <p className={styles.note}>{W.otherWays(howToPay)}</p>}
    </>
  );
}

/** Open the flow's Checkout: POST the amount the page showed; a changed amount reloads the page (the server re-read). */
export async function openCheckout(url: string, body: Record<string, unknown>): Promise<{ url: string } | { error: string } | { changed: true }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) return { url: data.url as string };
    if (data.changed) return { changed: true };
    return { error: (data.error as string | undefined) ?? W.error.couldntOpen };
  } catch {
    return { error: W.error.couldntOpen };
  }
}

export { styles as payBlockStyles };
