/**
 * "NEEDS A LOOK" (GST/HST Stage 3 Part 3a; drawing tab 5 of docs/projects/active/GST_HST_STAGE3_PART2_DRAWINGS.html, owner Asks
 * 4 and 8 = A, the four undrawn states ruled 2026-11-06 as recommended). Pure rules, no database import (the one paging loop the
 * reader uses takes its query as a callback). The reader is
 * lib/console-money-sales-store.ts `readNeedsLook`; the words are `NEEDS_LOOK_WORDS` beside the sales words.
 *
 *   · Seven checks over the stored record, in priority order. A sale shows once with its first reason; its window lists all.
 *   · Never on the list: a void sale, and a sale issued before our GST/HST registration took effect (the changeable Stage 4a
 *     setting). With that date unread, nothing is called missing (checks 1–3, Part 2's rule); the others still run.
 *   · Open and written-off sales ARE on it (undrawn state (c) = as recommended: an open invoice still owes its tax).
 *   · Check 7 is "refunded, and no issued credit note at all" (as drawn; a partial note clears it, owner 2026-11-06).
 *   · "Mark as looked at" (Part 3b) is applied by the reader, never here: these rules say what is wrong with the record.
 */
import { regionName } from './billing-location';
import { isCanadianGstHst, isRatedTaxReason, type GstHstPositionWhy } from './charge-tax-record';
import { NEEDS_LOOK_WORDS, beforeRegistration, saleCents, type SaleNoteRecord, type SaleRecord } from './console-money-sales';
import { orgDayKey } from './timezone';

// ── The GST/HST rate for a province (check 4) ─────────────────────────────────────────────────────

/**
 * Where the rates below come from: the /accounting agent's research (CRA "GST/HST rates by province", the page dated
 * 2025-04-01, accessed 2026-10-31, file last verified 2026-11-05). A guard test names these dates; a rate change is a change
 * to that file first, then here.
 */
export const GST_HST_RATES_SOURCE = {
  doc: 'docs/agents/accounting/GST_HST_ON_SUBSCRIPTIONS_CANADA.md',
  ratesAsOf: '2025-04-01',
  verified: '2026-11-05',
} as const;

const HST_RATES: Readonly<Record<string, number>> = { ON: 13, NB: 15, NL: 15, PE: 15, NS: 14 };
/** BC, MB, SK and QC charge their own PST/RST/QST beside it: that is not GST/HST and is never compared here. */
const GST_ONLY = new Set(['AB', 'BC', 'MB', 'SK', 'QC', 'NT', 'NU', 'YT']);
/** Nova Scotia's HST fell from 15% to 14% on this day. */
const NS_CUT = '2025-04-01';

type GstHstRate = { kind: 'GST' | 'HST'; rate: number };

/** The GST/HST a sale to this Canadian province owed on its issue day; null for a code we do not know. */
export function gstHstRateFor(region: string | null | undefined, issuedAt: string): GstHstRate | null {
  const code = (region ?? '').trim().toUpperCase();
  if (code === 'NS') return { kind: 'HST', rate: orgDayKey(issuedAt) < NS_CUT ? 15 : 14 };
  if (HST_RATES[code] != null) return { kind: 'HST', rate: HST_RATES[code] };
  if (GST_ONLY.has(code)) return { kind: 'GST', rate: 5 };
  return null;
}

// ── The checks ──────────────────────────────────────────────────────────────────────────────────

/** The columns the checks read (a narrow pick of the sale record; every `SaleRecord` is one). */
export type NeedsLookRecord = Pick<SaleRecord,
  | 'stripe_invoice_id' | 'issued_at' | 'status' | 'currency' | 'gst_hst_position' | 'gst_hst_position_why' | 'tax_lines'
  | 'review_reason' | 'review_note' | 'evidence_missing' | 'evidence_country' | 'evidence_region' | 'refunded_cents'>;

export type LookReasonCode =
  | 'not_worked_out' | 'unexpected' | 'buyer_not_charged' | 'no_zero_rating_proof' | 'rate_mismatch' | 'review' | 'no_evidence' | 'refund_no_note';

/** Check 7's trigger: only a refunded sale can need a credit note, so the reader looks for notes for these alone. */
export const mayNeedCreditNote = (record: Pick<NeedsLookRecord, 'refunded_cents'>): boolean => record.refunded_cents > 0;
/** One reason, its sentence WITHOUT the "Needs a look: " lead (the row and the window add it). */
export type LookReason = { code: LookReasonCode; text: string };

type MissingCode = 'not_worked_out' | 'unexpected' | 'buyer_not_charged' | 'no_zero_rating_proof';
const MISSING_CODE: Record<GstHstPositionWhy, MissingCode> = {
  stripe_did_not_work_out: 'not_worked_out',
  unexpected_reason: 'unexpected',
  canadian_buyer_not_charged: 'buyer_not_charged',
  no_evidence_for_zero_rating: 'no_zero_rating_proof',
};

const W = NEEDS_LOOK_WORDS.reasons;

/** Check 4: taxed, and the GST/HST line's rate is not the rate for the province of the address kept with the sale. */
function rateMismatch(record: NeedsLookRecord): LookReason | null {
  if (record.gst_hst_position !== 'taxed' || record.evidence_missing || record.evidence_country !== 'CA') return null;
  const expected = gstHstRateFor(record.evidence_region, record.issued_at);
  const lines = record.tax_lines.filter(l => l.source === 'stripe' && isCanadianGstHst(l) && isRatedTaxReason(l.taxability_reason) && l.rate != null);
  if (!expected || !lines.length) return null;
  const charged = lines.reduce((sum, l) => sum + Number(l.rate), 0);
  if (Math.abs(charged - expected.rate) < 0.001) return null;
  const taxedAt = lines.map(l => `${l.name} ${Number(l.rate)}%`).join(' + ');
  const place = regionName('CA', record.evidence_region) ?? record.evidence_region!;
  return { code: 'rate_mismatch', text: W.rate_mismatch(taxedAt, place, `${expected.kind} ${expected.rate}%`) };
}

/**
 * Every reason this sale needs a look, in priority order; empty when it needs none. `registration` is the `YYYY-MM-DD`
 * effective date, or null when it could not be read. `hasCreditNote`: an ISSUED credit note exists for the invoice.
 */
export function needsLook(record: NeedsLookRecord, ctx: { registration: string | null; hasCreditNote: boolean }): LookReason[] {
  if (record.status === 'void' || beforeRegistration(record.issued_at, ctx.registration)) return [];
  const reasons: LookReason[] = [];
  // Checks 1–3 (and the unexpected reason after 1): exclusive, one `why` per missing answer.
  if (record.gst_hst_position === 'missing' && ctx.registration && record.gst_hst_position_why) {
    const code = MISSING_CODE[record.gst_hst_position_why];
    reasons.push({ code, text: W[code] });
  }
  const rate = rateMismatch(record);
  if (rate) reasons.push(rate);
  if (record.review_reason) reasons.push({ code: 'review', text: W.review(record.review_note) });
  if (record.evidence_missing) reasons.push({ code: 'no_evidence', text: W.no_evidence });
  if (mayNeedCreditNote(record) && !ctx.hasCreditNote) {
    reasons.push({ code: 'refund_no_note', text: W.refund_no_note(saleCents(record.refunded_cents, record.currency)) });
  }
  return reasons;
}

/** A mark that holds on a sale (Part 3b): who looked, when, and what they wrote. The reason keys it was made for stay on the server. */
export type LookedMark = { id: string; by: string; at: string; why: string };

/**
 * One customer's sales that need a look (lib/console-money-sales-store.ts `readNeedsLook`), reasons keyed by invoice. A sale that was
 * marked as looked at (and has no new problem) is NOT in `sales`/`notes`/`reasons`: it is in `looked`, so its window can say who looked.
 */
export type NeedsLookRead =
  | { state: 'read'; sales: SaleRecord[]; notes: SaleNoteRecord[]; reasons: Record<string, LookReason[]>; looked: Record<string, LookedMark>; registrationDate: string | null }
  | { state: 'failed' };

// ── Reading every page ──────────────────────────────────────────────────────────────────────────

/** PostgREST answers at most this many rows to one request (and a project may cap it lower). */
export const LOOK_PAGE = 1000;

/**
 * Every row of a ranged query, page by page. It stops on an EMPTY page, never on a short one: a project whose row cap is below
 * `size` answers short pages that are not the last, and stopping there would quietly lose sales. The query must be ordered
 * on a unique key so a page boundary never repeats or skips a row.
 */
export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = LOOK_PAGE,
): Promise<T[]> {
  const all: T[] = [];
  for (;;) {
    const { data, error } = await page(all.length, all.length + size - 1);
    if (error) throw error;
    if (!data?.length) return all;
    all.push(...data);
  }
}
