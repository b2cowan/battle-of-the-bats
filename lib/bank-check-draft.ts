/**
 * THE BANK CHECK'S WORKING DRAFT (Bank check: work it down to zero, WD1; plan
 * docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md §3.1, owner asks 1A 4A 5A, 2026-11-07). A treasurer types a
 * statement's date and balance, marks lines "Not in the bank yet", leaves to book lines in the Ledger and comes back to
 * the card as they left it.
 * ⚖ ASK 1 = A: THIS BROWSER ONLY, per club + account + signed-in person. No server draft, no route, no migration. Pure
 *   helpers over an injected store (`DraftStore`), so they test without a browser; `browserDraftStore()` hands the real one.
 * ⚖ WHAT A DRAFT HOLDS: the date, the typed balance, the cash not deposited yet (the coach card's; WD2, optional, so a
 *   WD1 draft still reads), the KEYS of the marked lines and the "Started off by" anchor. Never a
 *   line's figures: a mark comes back only as a line the books offer NOW, with the books' own amount (`keepOffered`), and
 *   the day's figure is always re-read. The server's `bad_item` refusal on Save stays the backstop.
 * ⚖ WRITTEN ONLY WHEN WORTH KEEPING (a balance or cash typed, or a line marked); an empty card removes it. Removed on Save, Start
 *   over, 14 days idle (ask 4 = A) and at sign-out (`signOut()` in lib/auth, beside the support console's Recent).
 * ⚖ EVERY STORAGE TOUCH IS WRAPPED: a private window, blocked or full storage just means no draft. The card works without.
 * WD2: the coach card reuses these helpers (account = the team); nothing here knows a portal.
 */
import type { BankLine, WaitingItem } from './bank-check';

/** The browser storage a draft lives in, injected (tests hand an in-memory one). */
export interface DraftStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

/** "Started off by": the difference when this date's balance was last typed (`anchorStarted`). */
export interface StartedAnchor { date: string; balance: string; differenceCents: number }

export interface BankCheckDraft {
  date: string;
  balance: string;
  /** The cash not deposited yet, as typed: the coach card's field, stored only when typed (absent in a WD1 draft). */
  cash?: string;
  /** The marked lines' keys, in the order marked. */
  marked: string[];
  started: StartedAnchor | null;
  /** The day it was last written (YYYY-MM-DD, the app's own today): "last worked on {date}". */
  savedOn: string;
  /** When it was last written (ms): the 14-day idle clock. */
  savedAt: number;
}

export type DraftContent = Omit<BankCheckDraft, 'savedOn' | 'savedAt'>;

export const DRAFT_PREFIX = 'fieldlogic:bank-check-draft:v1:';
export const DRAFT_IDLE_DAYS = 14;
const IDLE_MS = DRAFT_IDLE_DAYS * 24 * 60 * 60 * 1000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One draft per club, account and signed-in person (a second treasurer on the same browser has their own). */
export function draftKey(p: { club: string; account: string; person: string }): string {
  return `${DRAFT_PREFIX}${encodeURIComponent(p.club)}:${encodeURIComponent(p.account)}:${encodeURIComponent(p.person)}`;
}

/** The real store, or null where the browser won't give one (a server render, storage blocked). */
export function browserDraftStore(): DraftStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Something worth keeping: a balance or cash typed, or a line marked. Never an empty card. */
export const isWorthKeeping = (d: Pick<DraftContent, 'balance' | 'cash' | 'marked'>): boolean =>
  d.balance.trim() !== '' || (d.cash ?? '').trim() !== '' || d.marked.length > 0;

function isAnchor(v: unknown): v is StartedAnchor {
  const a = v as StartedAnchor;
  return !!a && typeof a === 'object' && typeof a.date === 'string' && typeof a.balance === 'string'
    && Number.isInteger(a.differenceCents);
}

/** A stored draft, or null when it is missing, not a draft, empty, or idle 14 days (an idle one is removed). */
export function readDraft(store: DraftStore | null, key: string, now: number): BankCheckDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<BankCheckDraft>;
    const ok = !!v && typeof v === 'object' && typeof v.date === 'string' && ISO_DAY.test(v.date)
      && typeof v.balance === 'string' && (v.cash === undefined || typeof v.cash === 'string') && Array.isArray(v.marked) && v.marked.every(k => typeof k === 'string')
      && typeof v.savedOn === 'string' && ISO_DAY.test(v.savedOn) && typeof v.savedAt === 'number'
      && (v.started === null || isAnchor(v.started));
    if (!ok) { store.removeItem(key); return null; }
    const d = v as BankCheckDraft;
    if (now - d.savedAt > IDLE_MS || !isWorthKeeping(d)) { store.removeItem(key); return null; }
    return {
      date: d.date, balance: d.balance, ...(d.cash ? { cash: d.cash } : {}), marked: [...d.marked], started: d.started, savedOn: d.savedOn, savedAt: d.savedAt,
    };
  } catch {
    return null;
  }
}

/** This browser keeps drafts at all (asked once, as the card opens): blocked storage never hears "Kept in this browser". */
export function canKeepDrafts(store: DraftStore | null): boolean {
  if (!store) return false;
  try {
    const probe = `${DRAFT_PREFIX}probe`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep the card's work: written when worth keeping, removed when not (an emptied card leaves nothing behind). True only
 * when the browser holds it now. `today` is the app's own day (the restore line's "last worked on").
 */
export function writeDraft(store: DraftStore | null, key: string, d: DraftContent, today: string, now = Date.now()): boolean {
  if (!store) return false;
  try {
    if (!isWorthKeeping(d)) { store.removeItem(key); return false; }
    // The cash only when typed: a card without the field stores what WD1 stored.
    const out: BankCheckDraft = {
      date: d.date, balance: d.balance, ...(d.cash?.trim() ? { cash: d.cash } : {}), marked: [...d.marked], started: d.started, savedOn: today, savedAt: now,
    };
    store.setItem(key, JSON.stringify(out));
    return true;
  } catch {
    // Full or blocked storage: the card keeps working, it just won't be there next time.
    return false;
  }
}

/** Save, Start over: the draft goes. */
export function clearDraft(store: DraftStore | null, key: string): void {
  if (!store) return;
  try { store.removeItem(key); } catch { /* nothing to clear */ }
}

/** Every draft key in the store (read before removing: removing shifts the indexes). */
function draftKeys(store: DraftStore): string[] {
  const keys: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (k?.startsWith(DRAFT_PREFIX)) keys.push(k);
  }
  return keys;
}

/** The 14-day idle rule for drafts of accounts never opened again: each one past it goes. */
export function sweepIdleDrafts(store: DraftStore | null, now: number): void {
  if (!store) return;
  try { for (const k of draftKeys(store)) readDraft(store, k, now); } catch { /* blocked storage */ }
}

/** Sign-out on a shared computer: every bank check draft in this browser goes. */
export function clearAllDrafts(store: DraftStore | null): void {
  if (!store) return;
  try { for (const k of draftKeys(store)) store.removeItem(k); } catch { /* blocked storage */ }
}

/** A line as a Not-in-the-bank-yet item: its own key, date, direction, amount and words (the server re-reads them). */
export const itemOfLine = (l: BankLine): WaitingItem =>
  ({ key: l.key, date: l.date, direction: l.direction, amountCents: l.amountCents, ...(l.label ? { label: l.label } : {}) });

/**
 * What a mark may be on this day's figure: a line Find lists (less online payments on their way, which are counted above
 * and never markable), the earlier season's lines Find lists under their own name (a cheque across a rollover), and the
 * items "Still waiting?" asks about. The server's own rule on Save is the same set. A figure with no online payments
 * (the coach's team) has no `onItsWay`; one with no earlier season's lines has no `lastSeason`.
 */
export function offeredItems(figure: {
  suspects: { lines: readonly BankLine[] };
  lastSeason?: { lines: readonly BankLine[] } | null;
  stillWaiting: readonly WaitingItem[];
  onItsWay?: { state: string; lines?: readonly { key: string }[] };
}): Map<string, WaitingItem> {
  const onWay = new Set(figure.onItsWay?.state === 'counted' ? (figure.onItsWay.lines ?? []).map(l => l.key) : []);
  const out = new Map<string, WaitingItem>();
  for (const lines of [figure.suspects.lines, figure.lastSeason?.lines ?? []]) {
    for (const l of lines) if (!onWay.has(l.key) && !out.has(l.key)) out.set(l.key, itemOfLine(l));
  }
  for (const w of figure.stillWaiting) if (!out.has(w.key)) out.set(w.key, w);
  return out;
}

/** The marks the books still offer, each as the books read it NOW (never the remembered figures), and how many went. */
export function keepOffered(keys: readonly string[], offered: ReadonlyMap<string, WaitingItem>): { kept: WaitingItem[]; dropped: number } {
  const kept: WaitingItem[] = [];
  for (const k of keys) { const w = offered.get(k); if (w) kept.push(w); }
  return { kept, dropped: keys.length - kept.length };
}

/**
 * "Started off by" (ask 2 = A): the difference when this date's balance was last typed. A new date or a new balance
 * re-anchors (typing "5402.10" passes through "5", so the first difference seen is not where the work started); marks
 * and lines added to the books never do: they are the work. No band yet (no balance, no figure): no anchor.
 */
export function anchorStarted(anchor: StartedAnchor | null, at: { date: string; balance: string }, differenceCents: number | null): StartedAnchor | null {
  if (anchor && anchor.date === at.date && anchor.balance === at.balance) return anchor;
  if (differenceCents === null) return null;
  return { date: at.date, balance: at.balance, differenceCents };
}

/** The anchor's amount to show, or null: hidden while it equals the live difference, and when it started at a match. */
export function startedOffCents(anchor: StartedAnchor | null, liveDifferenceCents: number | null): number | null {
  if (!anchor || liveDifferenceCents === null || anchor.differenceCents === 0) return null;
  return anchor.differenceCents === liveDifferenceCents ? null : Math.abs(anchor.differenceCents);
}
