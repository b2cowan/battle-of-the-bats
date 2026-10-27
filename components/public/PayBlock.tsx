'use client';
/**
 * THE ONE PAY BLOCK (Club Tier Stage 12b, owner §0e d — the drawings' k1, "one pay block for every flow"). The pieces a
 * tournament team's pay page (`TeamPayContent`) and a house-league family's status page (`LeaguePayBlock`) share, so the
 * six states read the same for both and bank debit (12c) is added in one place:
 *
 *   owing          each button carries its own total — by card, and (12c) by bank debit while the club takes it; the
 *                  processing fee under it only while the payer pays it (A14); both disable on press
 *   confirming     back from Stripe: waits for the RECORD, never "Paid" on the redirect alone (`usePaymentConfirming`)
 *   not finished   left Stripe's page: nothing charged
 *   paid           the receipt card(s); a bank debit's reads the account and both dates (12c)
 *   clearing       12c: a bank debit on its way — no button, the place held, the club's contact (`ClearingState`)
 *   returned       12c: a bank debit that came back before it cleared — said above the owing block (`ReturnedNotice`)
 *   not taking payments / no longer payable — the flow's own words (each page keeps today's panel verbatim, A6)
 * Words are 12a's (`PAY_WORDS`); no rate is typed here.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CreditCard, Landmark } from 'lucide-react';
import { BANK_DEBIT_WORDS as B, DEBIT_NOTICE_WORDS as DW, PAY_WORDS as W, cardLabel, money, paidAtLabel, reasonFull, receiptLabel } from '@/lib/online-payment-words';
import { formatStoredDate, orgDayKey } from '@/lib/timezone';
import styles from './PayBlock.module.css';

const SLOW_AFTER_MS = 20_000;
export const payDollars = (cents: number) => money(cents / 100);
/** "Oct 26" — a bank debit's days on a screen, in the club's zone; the year only when it is not this year (words, "How to read this"). */
const clubDay = (iso: string | null) => {
  if (!iso) return '';
  const day = iso.length > 10 ? orgDayKey(iso) : iso;
  return formatStoredDate(day, { withYear: day.slice(0, 4) !== orgDayKey(new Date().toISOString()).slice(0, 4) });
};

/** The block's colour frame: the tournament's theme by default, the club's inside a club page. */
export function PayFrame({ inClub = false, centered = false, children }: { inClub?: boolean; centered?: boolean; children: ReactNode }) {
  return <div className={`${styles.block} ${inClub ? styles.inClub : ''} ${centered ? styles.centered : ''}`}>{children}</div>;
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

/** A receipt card: the title, "{total} to {club}", the card (or 12c: bank debit) line, then the lines, the fee (only when
 *  the payer paid it) and the total. */
export function ReceiptCard({ title, test, totalCents, clubName, brand, last4, paidAt, receiptNo, lines, feeCents, bank, reversedAt = null }: {
  title: string; test: boolean; totalCents: number; clubName: string; brand: string | null; last4: string | null;
  paidAt: string | null; receiptNo: number | null; lines: { label: string; cents: number }[]; feeCents: number | null;
  bank?: { last4: string | null; startedAt: string | null } | null;
  /** 12c Part 6: the bank took it back after it cleared — "Reversed {day}. This receipt no longer counts." */
  reversedAt?: string | null;
}) {
  return (
    <div className={styles.receipt}>
      {test && <p className={styles.test}>{W.testReceipt}</p>}
      <h2>{title}</h2>
      {reversedAt && <p className={styles.note}>{B.receiptReversedLine(clubDay(reversedAt))}</p>}
      <p className={styles.receiptTo}>{W.paidTo(payDollars(totalCents), clubName)}</p>
      <p className={styles.note}>
        {bank
          ? (bank.last4
            ? B.methodBank(bank.last4, clubDay(bank.startedAt), clubDay(paidAt), receiptLabel(receiptNo ?? ''))
            : B.methodBankNoAccount(clubDay(bank.startedAt), clubDay(paidAt), receiptLabel(receiptNo ?? '')))
          : W.paidLine(cardLabel(brand, last4), paidAt ? paidAtLabel(paidAt) : '', receiptLabel(receiptNo ?? ''))}
      </p>
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

export type PayRail = 'card' | 'bank_debit';

/**
 * Pay {total} by card, and (12c) Pay {total} by bank debit beside it while the club's account takes it — each label one
 * row, the amount always; the fee is the note under it only while the payer pays the fee (A14), and the bank's note keeps
 * "Takes up to 5 business days." either way. Both disable on press; the pressed one says it is opening.
 */
export function PayButtons({ totalCents, feeCents, bankTotalCents, bankFeeCents, feePaidByPayer, opening, onPay, buttonClass, bankButtonClass }: {
  totalCents: number; feeCents: number; bankTotalCents: number | null; bankFeeCents: number | null; feePaidByPayer: boolean;
  opening: PayRail | null; onPay: (rail: PayRail) => void; buttonClass: string; bankButtonClass: string;
}) {
  return (
    <div className={styles.payButtons}>
      <div className={styles.payRow}>
        <button type="button" className={`${buttonClass} ${styles.payButton}`} onClick={() => onPay('card')} disabled={opening !== null}>
          <CreditCard size={18} aria-hidden /> {opening === 'card' ? W.opening : W.button(payDollars(totalCents))}
        </button>
        {feePaidByPayer && feeCents > 0 && <span className={styles.note}>{W.buttonFeeNote(payDollars(feeCents))}</span>}
      </div>
      {bankTotalCents != null && (
        <div className={styles.payRow}>
          <button type="button" className={`${bankButtonClass} ${styles.payButton}`} onClick={() => onPay('bank_debit')} disabled={opening !== null}>
            <Landmark size={18} aria-hidden /> {opening === 'bank_debit' ? W.opening : W.buttonBank(payDollars(bankTotalCents))}
          </button>
          <span className={styles.note}>
            {feePaidByPayer && (bankFeeCents ?? 0) > 0 ? W.buttonBankNote(payDollars(bankFeeCents!)) : W.buttonBankNoteClubPays}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 12c: a bank debit on its way — the heading in the info colour, the sentence, the held line, and the page's exit (the
 * club's contact). No Pay button and no other way to pay while it clears (ask 6).
 */
export function ClearingState({ totalCents, last4, startedAt, held, clubName, contact, balance = null }: {
  totalCents: number; last4: string | null; startedAt: string | null; held: string; clubName: string; contact: string | null;
  /** A team's deposit clearing: "The {balance} balance is due {date}." (words §2.5). */
  balance?: string | null;
}) {
  const started = clubDay(startedAt);
  return (
    <div className={`${styles.state} ${styles.clearing}`} role="status">
      <h2>{B.clearingTitle}</h2>
      <p>{last4 ? B.clearingBody(payDollars(totalCents), last4, started) : B.clearingBodyNoAccount(payDollars(totalCents), started)}</p>
      <p>{held}</p>
      {balance && <p>{balance}</p>}
      <p className={styles.note}>{B.contact(clubName, contact)}</p>
    </div>
  );
}

/** 12c Part 6: the bank reversed a debit after it cleared — above the owing block, which is back with both buttons. */
export function ReversedNotice({ totalCents, reversedAt, reason, receiptNo, owingAgainCents }: {
  totalCents: number; reversedAt: string | null; reason: string | null; receiptNo: number | null; owingAgainCents: number;
}) {
  return (
    <div className={styles.state} role="status">
      <h2>{B.reversedTitle}</h2>
      <p>{B.reversedBody(payDollars(totalCents), clubDay(reversedAt), reasonFull(reason), receiptLabel(receiptNo ?? ''), DW.owingAgain(payDollars(owingAgainCents)))}</p>
    </div>
  );
}

/** 12c: a bank debit that came back before it cleared — nothing taken, still held; the owing block follows with both buttons. */
export function ReturnedNotice({ returnedAt, reason, held }: { returnedAt: string | null; reason: string | null; held: string }) {
  return (
    <div className={styles.state} role="status">
      <h2>{B.returnedTitle}</h2>
      <p>{B.returnedBody(clubDay(returnedAt), reasonFull(reason))}</p>
      <p>{held}</p>
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
