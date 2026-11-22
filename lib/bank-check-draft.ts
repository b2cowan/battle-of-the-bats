/**
 * THE BANK CHECK'S WORK, THE PURE HALF (Bank check: work it down to zero, WD1/WD2, plan
 * docs/projects/active/BANK_CHECK_WORKING_DRAFT_PLAN.md §3.1; kept by S7). What a mark may be on a day's figure, how a
 * kept mark comes back (`keepOffered`: only as a line the books offer NOW, with the books' own amount) and the "Started off
 * by" anchor. Both portals' cards use them; nothing here knows a portal or a store.
 * ⚖ S7 (plan BANK_CHECK_NOVICE_UX_PLAN.md §0 A18) moved the work itself to our servers (lib/bank-check-work.ts, the hook
 *   lib/hooks/useBankCheckWork.ts): the browser store, its 14 idle days and the sign-out sweep are gone. Sign-out no longer
 *   clears the work, which follows the person (ruling). `clearLegacyDrafts` deletes the pre-S7 browser copies (marked
 *   lines' keys) wherever they are left; nothing reads them, and nothing is carried to the server.
 */
import type { BankLine, WaitingItem } from './bank-check';

/** "Started off by": the difference when this date's balance was last typed (`anchorStarted`). */
export interface StartedAnchor { date: string; balance: string; differenceCents: number }

/** The pre-S7 browser drafts' key prefix (WD1/WD2): only ever deleted now. */
export const LEGACY_DRAFT_PREFIX = 'fieldlogic:bank-check-draft:v1:';

/** The pre-S7 browser drafts go (at sign-out, and as a card opens). Blocked storage just means nothing to clear. */
export function clearLegacyDrafts(store: Pick<Storage, 'length' | 'key' | 'removeItem'> | null = browserStore()): void {
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k?.startsWith(LEGACY_DRAFT_PREFIX)) keys.push(k); }
    for (const k of keys) store.removeItem(k);
  } catch { /* blocked storage */ }
}

function browserStore(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
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
