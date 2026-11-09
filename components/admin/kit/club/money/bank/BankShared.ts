/**
 * THE BANK TAB'S SHARED PARTS (Bank balance check BC1). What the screens read is the server's own answer (the routes'
 * return types, never a restatement); a saved check's band is the engine's (`figureOfSaved`, figured on the server) — a
 * screen formats, it never re-adds (rule 6). Client-safe.
 */
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import type { bankAccountView, bankOverview } from '@/lib/bank-club-steps';
import { BANK_WORDS as W } from '@/lib/bank-tab-words';
import { typedCents } from '@/lib/bank-check';
import { paymentMethodWord } from '@/lib/house-league-money-words';

export type Overview = Awaited<ReturnType<typeof bankOverview>>;
export type AccountView = NonNullable<Awaited<ReturnType<typeof bankAccountView>>>;
export type SavedCheckView = AccountView['checks'][number];

/** A Bank route, always with the club (`orgSlug` — the admin routes fail closed without it). */
export function bankUrl(orgSlug: string, path = '', params: Record<string, string | null | undefined> = {}): string {
  const extra = Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `&${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('');
  return `/api/admin/accounting/bank${path}?orgSlug=${encodeURIComponent(orgSlug)}${extra}`;
}

/** The Bank TAB's address (a page, not a route), opened on an account and a check: the tab reads `account` and `check`
 *  on arrival (BC5a: the Overview's line, the fiscal-year close's row). `check` is dropped after that read; `account` STAYS
 *  in the address, and the Account pill writes it (bank check S2, A16). */
export const bankTabHref = (accountingBase: string, accountId?: string, checkId?: string): string => {
  const p = new URLSearchParams();
  if (accountId) p.set('account', accountId);
  if (checkId) p.set('check', checkId);
  const qs = p.toString();
  return `${accountingBase}/bank${qs ? `?${qs}` : ''}`;
};

/* The look-free formatting is shared with the coach's Bank view (BC7a, owner "Coach sharing"): one home, lib/bank-screen.ts. */
export { cents, fieldAmount, moved, dayYear, nameOf, throughWords } from '@/lib/bank-screen';
/** The server's "Stripe failed between your read and the save" refusal (warn, never block): which notice it is. */
export const notCountedOf = (code: string | null): 'stripe_down' | 'unlisted' | null =>
  code === 'not_counted_down' ? 'stripe_down' : code === 'not_counted_unlisted' ? 'unlisted' : null;

export type Figure = NonNullable<AccountView['figure']>;

/** How a line came, as the Ledger words it ("Cheque 214", "E-Transfer", "Online, card"), or null when it doesn't say. */
export const howWord = (method: string | null | undefined): string | null => (method ? paymentMethodWord(method) : null);

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

export async function bankWrite(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body: unknown, fallback: string): Promise<BankAnswer> {
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

/** "Waiting at the start" and "Take it off" (Q2, BC3b): correct the starting statement by one line's KEY only (rule 6). */
export const patchStart = (orgSlug: string, accountId: string, body: { add: string } | { remove: string }): Promise<BankAnswer> =>
  bankWrite(bankUrl(orgSlug, `/accounts/${accountId}/setup`), 'PATCH', body, W.atStartFailed);

