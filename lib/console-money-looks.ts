/**
 * "MARK AS LOOKED AT" (GST/HST Stage 3 Part 3b; drawing tab 5 "Mark as looked at", owner Ask 6 + the 2026-11-06 re-list ruling:
 * a mark holds by reason CODE plus a small fingerprint). Pure rules, no database import. The table is
 * `platform_charge_tax_looks` (migration 452); the table is read and written by lib/console-money-sales-store.ts alone.
 *
 * ⚖ A mark never touches the record or the return. It only says "a person looked at this sale for THESE reasons". The
 *   GST/HST return reads the tax records and nothing here: tests/unit/console-money-looks.test.ts holds the importers.
 *
 * ⚖ A sale is looked at only while EVERY reason it has now is inside the set its newest, un-undone mark was made for. A mark is
 *   made for KEYS, not sentences, so rewording a sentence never brings a sale back; a key is a reason code, and for two codes
 *   a fingerprint of the fact the person looked at:
 *     · rate_mismatch   + the province of the address kept with the sale  ("rate_mismatch:AB")
 *     · refund_no_note  + the amount refunded so far                      ("refund_no_note:5000")
 *   so a second refund made in Stripe's dashboard, or a changed province, is a NEW problem and puts the sale back on the list.
 */
import { holdsCardNumber, REFUND_REASON_MAX } from './console-money';
import { needsLook, type LookedMark, type LookReason, type NeedsLookRecord } from './console-money-needs-look';
import { NEEDS_LOOK_WORDS } from './console-money-sales';

/** The longest Why a mark takes: the refund reason's length, the console's one rule for a typed why. */
export const LOOK_WHY_MAX = REFUND_REASON_MAX;

/** One row of `platform_charge_tax_looks` as the rules read it. A mark has keys; a put-back (`putBackOf` set) has none. */
export type LookRow = {
  id: string;
  seq: number;
  stripe_invoice_id: string;
  looked_keys: string[];
  put_back_of: string | null;
  looked_by: string;
  looked_at: string;
  why: string;
};

/** The characters a fingerprint may carry (the table's CHECK allows the same). */
const clean = (text: string | null | undefined): string => (text ?? '').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40);

/** The key of one reason on this record: its code, and the fact looked at for the two codes that carry one. */
export function lookKey(record: Pick<NeedsLookRecord, 'evidence_region' | 'refunded_cents'>, code: LookReason['code']): string {
  if (code === 'rate_mismatch') return `${code}:${clean(record.evidence_region) || 'unknown'}`;
  if (code === 'refund_no_note') return `${code}:${Math.max(0, Math.trunc(record.refunded_cents))}`;
  return code;
}

/** The keys of every reason a sale has now, sorted and without repeats (what a mark is made for). */
export function lookKeysOf(record: Pick<NeedsLookRecord, 'evidence_region' | 'refunded_cents'>, reasons: readonly LookReason[]): string[] {
  return [...new Set(reasons.map(r => lookKey(record, r.code)))].sort();
}

/** The newest row of one invoice (mark or put-back): the one the next row is written after. */
export function newestRow(rows: readonly LookRow[]): LookRow | null {
  let newest: LookRow | null = null;
  for (const row of rows) if (!newest || row.seq > newest.seq) newest = row;
  return newest;
}

/** The newest row of one invoice, when it is a mark (a put-back, or no row at all, means the sale is not marked). */
export function currentMark(rows: readonly LookRow[]): LookRow | null {
  const newest = newestRow(rows);
  return newest && newest.put_back_of === null ? newest : null;
}

/** Looked at = there is a current mark and every reason the sale has now is inside the set it was made for. */
export function looksHold(mark: Pick<LookRow, 'looked_keys'> | null, currentKeys: readonly string[]): boolean {
  if (!mark || currentKeys.length === 0) return false;
  const marked = new Set(mark.looked_keys);
  return currentKeys.every(k => marked.has(k));
}

/** What the window prints about a mark that holds (never the keys). */
export const lookedMarkOf = (row: LookRow): LookedMark => ({ id: row.id, by: row.looked_by, at: row.looked_at, why: row.why });

const REFUSALS = NEEDS_LOOK_WORDS.mark.refusals;

/** The refusal sentence for a typed why, or null when it is acceptable (the same checks as a refund's reason). */
export function lookWhyRefusal(why: unknown, putBack = false): string | null {
  const text = typeof why === 'string' ? why.trim() : '';
  if (!text) return putBack ? REFUSALS.whyBlankPutBack : REFUSALS.whyBlank;
  if (text.length > LOOK_WHY_MAX) return REFUSALS.whyLong(LOOK_WHY_MAX);
  if (holdsCardNumber(text)) return REFUSALS.whyCard;
  return null;
}

/**
 * THE RULE, over what has been read (no database here, so it is tested on fixtures): each record's reasons now (check 7 settled by
 * what the ISSUED credit notes paid back, `refunded` keyed by invoice), then its newest un-undone mark applied. `standing` = still needs a look; `looked` = a mark
 * holds (so it is NOT in `standing` / `reasons`, but its window can say who looked); `allReasons` = every reason, marked or not.
 * A club's read and Today's count both come through here (lib/console-money-sales-store.ts `judgeSales`), so they cannot differ.
 */
export function settleLooks<T extends NeedsLookRecord>(
  records: readonly T[],
  ctx: { registration: string | null; refunded: ReadonlyMap<string, number> },
  rows: ReadonlyMap<string, readonly LookRow[]>,
): { standing: T[]; reasons: Record<string, LookReason[]>; allReasons: Record<string, LookReason[]>; looked: Record<string, LookedMark> } {
  const reasons: Record<string, LookReason[]> = {};
  const allReasons: Record<string, LookReason[]> = {};
  const looked: Record<string, LookedMark> = {};
  const standing: T[] = [];
  for (const r of records) {
    const id = r.stripe_invoice_id;
    const found = needsLook(r, { registration: ctx.registration, notesRefundedCents: ctx.refunded.get(id) ?? 0 });
    if (!found.length) continue;
    allReasons[id] = found;
    const mark = currentMark(rows.get(id) ?? []);
    if (mark && looksHold(mark, lookKeysOf(r, found))) { looked[id] = lookedMarkOf(mark); continue; }
    reasons[id] = found;
    standing.push(r);
  }
  return { standing, reasons, allReasons, looked };
}
