'use client';
/**
 * THE CLUB'S MONEY SCREENS' SHARED PARTS (Club Tier Stage 3a, session 2). Small, and only what RepKit
 * does not already draw: a money figure and a day in the club's words, the figure cards and tiles, a
 * window's facts, a coach's quote, the state chip an allocation or a bill carries, the method picker,
 * and the one way a refused money move is read back to the screen.
 *
 * ⚠ NO FIGURE IS COMPUTED HERE. Collected, Outstanding, Overdue, Next due, Sent and a book's Balance come
 * from the server, which takes them from lib/club-money-figures.ts (the "same figure, one definition"
 * guard holds it). A screen formats; it never re-adds.
 */
import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import KitDialog from '../KitDialog';
import { CoachCard, CoachEyebrow, CoachFigure, kit } from '@/components/coaches/kit';
import { fmt } from '@/lib/coach-money-summary';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { formatStoredDate } from '@/lib/timezone';
import { DUES_PAYMENT_METHODS, DUES_PAYMENT_METHOD_LABEL, type DuesPaymentMethod } from '@/lib/types';
import type { ClubBillChip } from '@/lib/club-money-figures';
import { RepChip, repKit } from '../RepKit';
import ck from '../ClubKit.module.css';
import styles from './Money.module.css';

export { styles as moneyKit };

/** "$1,350.00" — every money figure carries its dollar sign (standard §3.7). Null → blank. */
export const money = (n: number | null | undefined): string => (n == null ? '' : fmt(n));

/** "Sep 28" — a day this year in the club's words (`formatStoredDate`, never a hand-roll). */
export const day = (d: string | null | undefined): string => formatStoredDate(d, { withYear: false });

/** "One installment" / "three installments" — a count said as a word up to ten, as the drawings say it. */
const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function installmentsWord(n: number, capital = false): string {
  const w = `${NUMBER_WORD[n] ?? n} ${n === 1 ? 'installment' : 'installments'}`;
  return capital ? `${w.charAt(0).toUpperCase()}${w.slice(1)}` : w;
}

/* A money route's answer read once, a JSON body, a refusal in words — `lib/money-fetch.ts` (the coach's
   Payees page reads its routes the same way, and the admin kit is admin-only). Re-exported for every
   club caller. */
export { jsonInit, moneyFetch, refusalText };

/** A typed amount ("$1,250.00", "1250") in dollars to the cent, or null when it isn't a positive amount up to `max`
 *  (a ledger line's cap by default; the plan's lines allow more). */
export function parseAmount(s: string, max = 999_999.99): number | null {
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
}

/** Did the money change under the caller? (409 `money_state_changed` — refresh in place.) */
export const isStale = (status: number, data: unknown): boolean =>
  status === 409 && (data as { code?: string })?.code === 'money_state_changed';

/** What a money move came back as: done (with the page's notice), or refused in words (stale = re-read). */
export type MoveResult = { ok: true; text: string } | { ok: false; error: string; stale: boolean };

/**
 * One money move, read into a `MoveResult`: the server's refusal sentence (a coded one mapped through
 * `codeWords` first — `unlinked`, say), else the fallback. Network failures throw; the window says so.
 */
export async function moneyMove(url: string, init: RequestInit, p: {
  fallback: string; done: string; codeWords?: Record<string, string>;
}): Promise<MoveResult> {
  const r = await moneyFetch(url, init);
  if (r.ok) return { ok: true, text: p.done };
  const code = (r.data as { code?: string }).code;
  return {
    ok: false,
    error: (code && p.codeWords?.[code]) || refusalText(r.data, p.fallback),
    stale: isStale(r.status, r.data),
  };
}

/**
 * THE CORRECTION QUESTION — Decline, Undo a payment, Reverse an approval, Void a line, Void a transfer
 * (Ask 3). One shape: what changes (named on both sides), a required reason, Keep it, and the act —
 * NEVER red, because each keeps its lines (marked void) and can be done again. A stale answer is
 * refused in words and the caller re-reads in place (`onDone(null, true)`).
 */
export function ReasonQuestion({
  eyebrow, title, lead, extra, label, placeholder, hint, missing, keepLabel = 'Keep it', confirmLabel, busyLabel, failText,
  ready = true, submit, onClose, onDone,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  /** A control above the reason (which payment to undo). */
  extra?: ReactNode;
  /** False holds the act (nothing left to act on after a re-read); Keep it still answers. */
  ready?: boolean;
  label?: string;
  placeholder?: string;
  hint?: ReactNode;
  /** Said when the reason is empty ("Say why — the coach reads it."). */
  missing: string;
  keepLabel?: string;
  confirmLabel: string;
  busyLabel: string;
  /** "The line couldn’t be voided." — the start of both failure sentences. */
  failText: string;
  submit: (reason: string) => Promise<MoveResult>;
  onClose: () => void;
  onDone: (text: string | null, keepOpen?: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    if (busy || !ready) return;
    if (!reason.trim()) { setError(missing); return; }
    setBusy(true); setError('');
    try {
      const r = await submit(reason.trim());
      if (r.ok) { onDone(r.text); return; }
      setError(r.error || `${failText} Please try again.`);
      if (r.stale) onDone(null, true);
    } catch {
      setError(`${failText} Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KitDialog
      kind="question"
      eyebrow={eyebrow}
      title={title}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{keepLabel}</button>
          <button type="button" className="btn btn-outline" onClick={() => void go()} disabled={busy || !ready}>{busy ? busyLabel : confirmLabel}</button>
        </>
      }
    >
      {extra}
      {lead != null && <p className={styles.lead1}>{lead}</p>}
      <FormError>{error}</FormError>
      <ReasonField id="reason-why" label={label} value={reason} onChange={setReason} placeholder={placeholder} hint={hint} />
    </KitDialog>
  );
}

/** A page's figure cards (an allocation's four, a team's four): the label, the figure, one fact. */
export function FigureCards({ items, three = false }: {
  /** `tone` colours the figure — `bad` for money that is late (an allocation's Overdue, as drawn). `held`: a
   *  figure the club READS but doesn't own (a team's cash on hand, Club Tier Stage 3b Ask 4e) — the lock in its
   *  label and the blue edge of "held by the team". */
  items: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'muted'; held?: boolean }[];
  three?: boolean;
}) {
  return (
    <div className={`${three ? styles.cards3 : repKit.cards4} ${styles.figures}`}>
      {items.map(i => (
        <CoachCard key={i.label} className={i.held ? styles.heldCard : undefined}>
          <CoachEyebrow>{i.held && <Lock size={11} aria-hidden className={styles.heldLock} />}{i.label}</CoachEyebrow>
          <CoachFigure className={styles.figure} tone={i.tone}>{i.value}</CoachFigure>
          {i.sub != null && <p className={kit.sub}>{i.sub}</p>}
        </CoachCard>
      ))}
    </div>
  );
}

/** The four tiles at the top of a window (a team's bill). */
export function Tiles({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className={styles.tiles}>
      {items.map(i => (
        <div key={i.label} className={styles.tile}>
          <span className={styles.tileLabel}>{i.label}</span>
          <span className={styles.tileValue}>{i.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A window's facts: a label on the left, its value on the right (the drawing's record box). ⚠ The
 * shared kit's box (Ledger Parity, 2026-10-02) — the coach's read window draws the same one, so the
 * recipe lives once, in `components/coaches/kit/Ledger.module.css`.
 */
export { RecordFacts as Facts } from '@/components/coaches/kit';

/** A coach's own words, quoted. */
export const Quote = ({ children }: { children: ReactNode }) => <p className={styles.quote}>“{children}”</p>;

/**
 * The ONE chip an allocation or a team's bill carries (specimen 2), in words and colour: Overdue with
 * its count (red — only the club can chase it), Sent · confirm (blue — waiting on the club), Due and the
 * date (amber), First due (quiet), Paid in full (olive). The chip key is the server's (`clubBillChip`).
 */
/** "1 day late" / "15 days late" — ONE wording for how late an installment is, wherever the club's screens say it. */
export const daysLateWords = (days: number) => `${days} ${days === 1 ? 'day' : 'days'} late`;

/** The red chip that says it: an allocation's team row, Coming due's overdue row, a team's bill. */
export function LateChip({ days }: { days: number }) {
  return <RepChip tone="bad">{daysLateWords(days)}</RepChip>;
}

export function BillChip({ chip, overdueCount, sentCount, nextDue, daysLate, firstDue }: {
  chip: ClubBillChip;
  overdueCount: number;
  sentCount?: number;
  nextDue: string | null;
  /** A team's bill reads "15 days late" where the list reads "2 overdue". */
  daysLate?: number | null;
  firstDue?: string | null;
}) {
  switch (chip) {
    case 'overdue':
      return <RepChip tone="bad">{daysLate != null && daysLate > 0 ? daysLateWords(daysLate) : `${overdueCount} overdue`}</RepChip>;
    case 'sent':
      return <RepChip tone="info">{sentCount && sentCount > 1 ? `${sentCount} sent · confirm` : 'Sent · confirm'}</RepChip>;
    case 'due_soon':
      return <RepChip tone="warn">{nextDue ? `Due ${day(nextDue)}` : 'Due soon'}</RepChip>;
    case 'paid_in_full':
      return <RepChip tone="good">Paid in full</RepChip>;
    default:
      return <RepChip>{firstDue ?? nextDue ? `${firstDue ? 'First due' : 'Next due'} ${day(firstDue ?? nextDue)}` : 'Not due yet'}</RepChip>;
  }
}

/** How the money came: the product's one method list (one spelling — "E-Transfer"), as a dropdown. */
export function MethodField({ id, label, value, onChange, required = true }: {
  id: string; label: string; value: DuesPaymentMethod | ''; onChange: (v: DuesPaymentMethod | '') => void; required?: boolean;
}) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}{required && <span className={repKit.req} aria-hidden>*</span>}</span>
      <select id={id} className={ck.select} value={value} onChange={e => onChange(e.target.value as DuesPaymentMethod | '')}>
        <option value="">Choose…</option>
        {DUES_PAYMENT_METHODS.map(m => <option key={m} value={m}>{DUES_PAYMENT_METHOD_LABEL[m]}</option>)}
      </select>
    </label>
  );
}

/** A required day field (the club's day by default — never UTC). */
export function DayField({ id, label, value, onChange, max }: {
  id: string; label: string; value: string; onChange: (v: string) => void; max?: string;
}) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}<span className={repKit.req} aria-hidden>*</span></span>
      <input id={id} type="date" className={ck.input} value={value} max={max} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

/** A plain text field with an optional hint. */
export function TextField({ id, label, value, onChange, placeholder, hint, required = false, maxLength = 100 }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  hint?: ReactNode; required?: boolean; maxLength?: number;
}) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}{required && <span className={repKit.req} aria-hidden>*</span>}</span>
      <input id={id} className={ck.input} value={value} placeholder={placeholder} maxLength={maxLength} onChange={e => onChange(e.target.value)} />
      {hint != null && <p className={ck.hint}>{hint}</p>}
    </label>
  );
}

/** The required reason a correction asks for (Undo, Reverse, Void, Decline). */
export function ReasonField({ id, label = 'Why?', value, onChange, placeholder, hint }: {
  id: string; label?: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: ReactNode;
}) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}<span className={repKit.req} aria-hidden>*</span></span>
      <textarea id={id} className={ck.textarea} value={value} maxLength={500} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} rows={2} data-autofocus="" />
      {hint != null && <p className={ck.hint}>{hint}</p>}
    </label>
  );
}

/** A refusal line inside a window (standard §3.7's error row). */
export const FormError = ({ children }: { children: ReactNode }) =>
  children ? <p className={repKit.formError} role="alert">{children}</p> : null;
