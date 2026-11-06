/**
 * THE BANK TAB'S SHARED PARTS (Bank balance check BC1). What the screens read is the server's own answer (the routes'
 * return types, never a restatement); a saved check's band is the engine's (`figureOfSaved`, figured on the server) — a
 * screen formats, it never re-adds (rule 6). Client-safe.
 */
import { money } from '../MoneyKit';
import { formatStoredDate } from '@/lib/timezone';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import type { bankAccountView, bankOverview } from '@/lib/bank-club-steps';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { typedCents } from '@/lib/bank-check';

export type Overview = Awaited<ReturnType<typeof bankOverview>>;
export type AccountView = NonNullable<Awaited<ReturnType<typeof bankAccountView>>>;
export type SavedCheckView = AccountView['checks'][number];

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

export type Figure = NonNullable<AccountView['figure']>;

/** A typed amount in cents ("$5,402.10", "-12.40", "($50.00)"), or null — the engine's own parser. */
export const parseCents = typedCents;

/**
 * A refusal that means "the view you are looking at is stale" (BC1 review): another treasurer started, saved or moved
 * something first, or the account is gone. The screen re-reads the overview and the account BEFORE it says the sentence.
 */
const STALE_CODES: ReadonlySet<string> = new Set(['changed', 'account_not_found', 'start_exists', 'start_after_checks', 'no_start', 'check_not_found']);
export const isStaleView = (code: string | null): boolean => code !== null && STALE_CODES.has(code);

/** The figure for a day (`GET …?date=`): what the screen draws from, or the sentence the server refused it with. */
export type FigureAnswer =
  | { ok: true; figure: Figure }
  | { ok: false; code: string | null; error: string };

export async function readFigure(orgSlug: string, accountId: string, date: string, asked: 'start' | 'check'): Promise<FigureAnswer> {
  try {
    const r = await moneyFetch<Record<string, unknown>>(bankUrl(orgSlug, `/accounts/${accountId}`, { date, asked }));
    const figure = (r.data as unknown as AccountView).figure;
    if (r.ok && figure) return { ok: true, figure };
    return { ok: false, code: typeof r.data.code === 'string' ? r.data.code : null, error: refusalText(r.data, W.figureFailed) };
  } catch {
    return { ok: false, code: null, error: `${W.figureFailed} ${W.connection}` };
  }
}

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

/** Ask 4: "{date} · Matches" / "{date} · Off by $X" — an account's latest check, as the pill and the line say it. */
export const throughWords = (t: AccountView['checkedThrough']): string =>
  t ? W.throughResult(dayYear(t.date), t.result === 'matches' ? W.matches : W.offBy(cents(t.offByCents))) : W.notChecked;
