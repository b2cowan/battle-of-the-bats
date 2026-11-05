/**
 * THE BANK TAB'S SHARED PARTS (Bank reconciliation R2c). What the screens read is the server's own answer (R2b's
 * routes): the types are the routes' return types, never a restatement, and every figure is the engine's — a screen
 * formats, it never re-adds (rule 6). Client-safe.
 */
import { money } from '../MoneyKit';
import { formatStoredDate, utcToZonedInputs } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import type { bankAccountView, bankOverview } from '@/lib/bank-club-steps';
import type { TickRow } from '@/lib/bank-check';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';

export type Overview = Awaited<ReturnType<typeof bankOverview>>;
export type AccountView = NonNullable<Awaited<ReturnType<typeof bankAccountView>>>;
export type Shown = NonNullable<AccountView['shown']>;
export type Summary = AccountView['checks'][number];
export type { TickRow };

/** A Bank route, always with the club (`orgSlug` — the admin routes fail closed without it). */
export function bankUrl(orgSlug: string, path = '', params: Record<string, string | null | undefined> = {}): string {
  const extra = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('');
  return `/api/admin/accounting/bank${path}?orgSlug=${encodeURIComponent(orgSlug)}${extra}`;
}

/** "$1,284.50" from integer cents. */
export const cents = (c: number | null | undefined): string => (c == null ? '' : money(c / 100));
/** "Oct 31, 2026" — a statement's day always carries its year (a statement may straddle one). */
export const dayYear = (d: string | null | undefined): string => formatStoredDate(d);
/** "Nov 3, 2026, 8:14 p.m." — a moment, in the club's zone, the clock through `formatTime` only. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return '';
  return `${formatStoredDate(iso)}, ${formatTime(utcToZonedInputs(iso).time)}`;
}

/** A typed amount in cents ("$5,402.10", "-12.40"), or null. A balance may be zero or below (an overdraft). */
export function parseCents(s: string, opts: { positive: boolean }): number | null {
  const t = s.replace(/[$,\s]/g, '').replace(/^−/, '-');
  if (!/^-?\d+(\.\d{0,2})?$/.test(t)) return null;
  const c = Math.round(Number(t) * 100);
  if (!Number.isSafeInteger(c) || Math.abs(c) > 99_999_999_999) return null;
  if (opts.positive && c <= 0) return null;
  return c;
}

/** A cents figure as the field shows it ("5402.10"), for a field opened with a value. */
export const centsField = (c: number): string => (c / 100).toFixed(2);

/** A row's words: its own label, else "a line". */
export const rowWhat = (r: { label?: string | null }): string => r.label?.trim() || W.noLine;

/** A write's answer: the account read again (the server's numbers), or a coded refusal in words. */
export type BankAnswer =
  | { ok: true; view: AccountView }
  | { ok: false; code: string | null; error: string; network: boolean };

export async function bankWrite(url: string, method: 'POST' | 'PATCH' | 'PUT', body: unknown, fallback: string): Promise<BankAnswer> {
  try {
    const init = method === 'PUT'
      ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : jsonInit(method, body);
    const r = await moneyFetch<Record<string, unknown>>(url, init);
    if (r.ok) return { ok: true, view: r.data as unknown as AccountView };
    const code = typeof r.data.code === 'string' ? r.data.code : null;
    return { ok: false, code, error: refusalText(r.data, `${fallback} Please try again.`), network: false };
  } catch {
    return { ok: false, code: null, error: `${fallback} ${W.connection}`, network: true };
  }
}

/**
 * Is the treasurer stuck? The Difference isn't $0.00 and no unticked line would bring it closer (drawings C2 against
 * C3: the callout and the amber come once ticking can no longer help — "every line is either ticked or left for next
 * month"). A screen decision from the server's figures, not a figure.
 */
export function isStuck(shown: Pick<Shown, 'differenceCents' | 'outstanding'>): boolean {
  const d = shown.differenceCents;
  if (d === 0) return false;
  return !shown.outstanding.some(r => {
    const next = r.direction === 'in' ? d - r.amountCents : d + r.amountCents;
    return Math.abs(next) < Math.abs(d);
  });
}
