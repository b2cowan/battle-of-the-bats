/**
 * "MARK AS FILED" (GST/HST Stage 4b Session C; build prompt docs/projects/active/GST_HST_STAGE4B_SESSION_C_BUILD_PROMPT.md, ruling 12).
 * Pure: no I/O, no clock. The store is lib/bookkeeping-store.ts (`bookkeeping.gst_return_filings`, migration 007, append-only);
 * the route is app/api/platform-admin/bookkeeping/gst-return/filings/route.ts; the words are lib/gst-return-worksheet-text.ts.
 *
 *   · A filing freezes the worksheet the SERVER worked out (never figures sent by the browser): the eight lines, 101's whole dollars,
 *     and the sources behind them (every invoice, credit note, write-off, recovery, credit and earlier-period credit, and what was
 *     still under "Before you file"), so "Changed since you filed" never has to trust today's data about the past.
 *   · Refused while any line is Not available, before the period has ended, or when it overlaps a filed period with other dates.
 *     Open "Before you file" items and a partial period WARN, never block; the filing records that they were open.
 *   · Marking the same dates again is an amended return: a new revision with a required reason. The latest shows; history stays.
 *   · What a change after filing means (GST_HST_RETURN_LINES.md §10, CRA P-149R / RC4022 / ETA s.231-232): more credit goes on a
 *     LATER return (the engine carries it as "Credits from earlier periods"); anything that raises net tax for the filed period means
 *     adjusting the filed return; a late-recorded write-off may go on a later return; a late-recorded credit note dated inside the
 *     period, or a sale that left the return, is a question for the accountant.
 */
import {
  WORKSHEET_LINES, type FiledCredits, type LineNumber, type UnresolvedKind, type Worksheet, type WorksheetPeriod,
} from './gst-return-worksheet';
import { isCalendarDate } from './timezone';

/** The format of `sources`. A reader that meets a newer one says it cannot compare, rather than guessing. */
export const FILED_SOURCES_VERSION = 1;

export type FiledSources = {
  v: typeof FILED_SOURCES_VERSION;
  invoices: { invoiceId: string; invoiceNumber: string | null; issuedOn: string; beforeTaxCad: number | null; gstHstCad: number | null }[];
  creditNotes: { noteId: string | null; noteNumber: string | null; invoiceId: string; invoiceNumber: string | null; on: string; cents: number }[];
  badDebts: { invoiceId: string; invoiceNumber: string | null; on: string; cents: number }[];
  recoveries: { invoiceId: string; invoiceNumber: string | null; on: string; cents: number }[];
  /** Every expense line 106 looked at, with the credit it counted (0 when it did not count) and its state then. */
  credits: { expenseId: string; revision: number; supplier: string; incurredOn: string; creditCents: number; state: string }[];
  earlierCredits: { expenseId: string; revision: number; supplier: string; incurredOn: string; landsOn: string; cents: number }[];
  /** "Before you file" as it stood: the kind and what it named. */
  open: { kind: UnresolvedKind; invoiceId: string | null; expenseId: string | null; noteId: string | null }[];
};

export type GstReturnFiling = {
  filingNo: number;
  period: WorksheetPeriod;
  /** 1 = first filing of these dates; 2+ = marked again (an amended return), with a reason. */
  periodRevision: number;
  filedOn: string;
  registrationDate: string;
  /** Cents for every line, 101 too; its whole dollars apart. Never null: a line that was Not available is refused. */
  lines: Record<LineNumber, number>;
  wholeDollars101: number;
  partial: boolean;
  /** Items under "Before you file" when it was marked (warned, not blocked). */
  openItems: number;
  sources: FiledSources;
  reason: string | null;
  createdAt: string;
  createdBy: string;
};

/** A filing as the browser gets it: never its sources (the route works out the comparison) and never who saved it. */
export type FilingSummary = Omit<GstReturnFiling, 'sources' | 'createdBy'>;
export function filingSummary(f: Omit<GstReturnFiling, 'sources'>): FilingSummary {
  return {
    filingNo: f.filingNo, period: f.period, periodRevision: f.periodRevision, filedOn: f.filedOn, registrationDate: f.registrationDate,
    lines: f.lines, wholeDollars101: f.wholeDollars101, partial: f.partial, openItems: f.openItems, reason: f.reason, createdAt: f.createdAt,
  };
}

/** The size a frozen period's sources may take, in BYTES (a supplier name can be multibyte; the column CHECK is octet_length). */
export const MAX_SOURCES_BYTES = 1_000_000;

// ── Freezing ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The worksheet's sources, as filed. */
export function freezeSources(w: Worksheet): FiledSources {
  return {
    v: FILED_SOURCES_VERSION,
    invoices: w.parts[101].invoices.map(i => ({ invoiceId: i.invoiceId, invoiceNumber: i.invoiceNumber, issuedOn: i.issuedOn, beforeTaxCad: i.beforeTaxCad, gstHstCad: i.gstHstCad })),
    creditNotes: w.parts[107].creditNotes.map(r => ({ noteId: r.noteId ?? null, noteNumber: r.noteNumber ?? null, invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, on: r.on, cents: r.cents })),
    badDebts: w.parts[107].badDebts.map(r => ({ invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, on: r.on, cents: r.cents })),
    recoveries: w.parts[104].recoveries.map(r => ({ invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, on: r.on, cents: r.cents })),
    credits: w.parts[106].credits.map(c => ({ expenseId: c.expenseId, revision: c.revision, supplier: c.supplier, incurredOn: c.incurredOn, creditCents: c.creditCents, state: c.state })),
    earlierCredits: w.parts[106].earlierCredits.map(c => ({ expenseId: c.expenseId, revision: c.revision, supplier: c.supplier, incurredOn: c.incurredOn, landsOn: c.landsOn, cents: c.cents })),
    open: w.unresolved.map(u => ({ kind: u.kind, invoiceId: u.invoiceId ?? null, expenseId: u.expenseId ?? null, noteId: u.noteId ?? null })),
  };
}

/** Read stored sources back. Null = not a format this code knows (the screen says it can't compare, never guesses). */
export function parseSources(text: string): FiledSources | null {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object') return null;
    const s = value as FiledSources;
    if (s.v !== FILED_SOURCES_VERSION) return null;
    const lists = [s.invoices, s.creditNotes, s.badDebts, s.recoveries, s.credits, s.earlierCredits, s.open];
    return lists.every(Array.isArray) ? s : null;
  } catch { return null; }
}

// ── Which filing is which ───────────────────────────────────────────────────────────────────────────────────────────────

const samePeriod = (a: WorksheetPeriod, b: WorksheetPeriod) => a.from === b.from && a.to === b.to;
const overlaps = (a: WorksheetPeriod, b: WorksheetPeriod) => a.from <= b.to && b.from <= a.to;

/** The latest revision of each filed period, oldest period first. */
export function latestFilings<T extends Pick<GstReturnFiling, 'period' | 'periodRevision'>>(filings: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const f of filings) {
    const key = `${f.period.from}|${f.period.to}`;
    if ((latest.get(key)?.periodRevision ?? 0) < f.periodRevision) latest.set(key, f);
  }
  return [...latest.values()].sort((a, b) => a.period.from.localeCompare(b.period.from));
}

/** What a period is, against the filings: filed (these exact dates; latest + history newest first), overlapping a filed one, or open. */
export function filingFor<T extends Pick<GstReturnFiling, 'period' | 'periodRevision'>>(filings: readonly T[], period: WorksheetPeriod):
  { state: 'filed'; latest: T; history: T[] } | { state: 'overlaps'; with: T[] } | { state: 'open' } {
  const same = filings.filter(f => samePeriod(f.period, period)).sort((a, b) => b.periodRevision - a.periodRevision);
  if (same.length) return { state: 'filed', latest: same[0], history: same };
  const near = latestFilings(filings).filter(f => overlaps(f.period, period));
  return near.length ? { state: 'overlaps', with: near } : { state: 'open' };
}

/** What every filing already claimed per expense, for the engine's "Credits from earlier periods". Latest revision of each period. */
export function filedCredits(filings: readonly Pick<GstReturnFiling, 'period' | 'periodRevision' | 'createdAt' | 'sources'>[], dayOf: (iso: string) => string): FiledCredits[] {
  return latestFilings(filings).map(f => ({
    period: f.period,
    filedDay: dayOf(f.createdAt),
    claimed: [
      ...f.sources.credits.filter(c => c.creditCents > 0).map(c => ({ expenseId: c.expenseId, cents: c.creditCents })),
      ...f.sources.earlierCredits.map(c => ({ expenseId: c.expenseId, cents: c.cents })),
    ],
    carried: f.sources.earlierCredits.map(c => ({ expenseId: c.expenseId, cents: c.cents, landsOn: c.landsOn })),
  }));
}

/**
 * Where a credit released after filing goes, for "Changed since you filed": the filed return that already carried it (another
 * filing's earlier-period credits), or else the day it lands (the later of the day it was saved and the most recent filing), the
 * engine's own rule.
 */
export type CarryContext = { latestFiledDay: string; carriedBy: (expenseId: string) => WorksheetPeriod | null };
export function carryContext(filings: readonly Pick<GstReturnFiling, 'period' | 'periodRevision' | 'createdAt' | 'sources'>[], dayOf: (iso: string) => string): CarryContext {
  const latest = latestFilings(filings);
  return {
    latestFiledDay: latest.reduce((day, f) => (dayOf(f.createdAt) > day ? dayOf(f.createdAt) : day), ''),
    carriedBy: id => latest.find(f => f.sources.earlierCredits.some(c => c.expenseId === id))?.period ?? null,
  };
}

// ── The rules for marking a period ──────────────────────────────────────────────────────────────────────────────────────

export type FilingRefusal =
  | { why: 'not_available'; lines: LineNumber[] }
  | { why: 'not_ended' }
  | { why: 'filed_on_invalid' }
  | { why: 'filed_on_too_early' }
  | { why: 'filed_on_future' }
  | { why: 'overlaps'; with: WorksheetPeriod }
  | { why: 'changed'; current: number }
  | { why: 'reason_missing' }
  | { why: 'reason_too_long' }
  /** The lines the server works out now are not the ones the question showed (something changed while it was open). */
  | { why: 'figures_changed' }
  /** Another filing (of any period) was saved at the same moment; nothing about this period changed. */
  | { why: 'busy' };

/**
 * The eight lines as the question showed them, to compare with what the server works out. A fingerprint only: the server never saves
 * a figure the browser sends, it refuses when they differ (review 2026-11-07: never freeze lines the owner did not see).
 */
export const linesKey = (w: Worksheet): string => WORKSHEET_LINES.map(line => w.lines[line].cents ?? 'na').join('|');

/**
 * What stops a period being marked filed whatever is typed: a line that is Not available (nothing can be frozen from an unknown),
 * or a period that has not ended (a return is filed for a period once it is over). The question shows it; the server enforces it.
 */
export function filingBlock(w: Worksheet, today: string): Extract<FilingRefusal, { why: 'not_available' | 'not_ended' }> | null {
  const missing = WORKSHEET_LINES.filter(line => w.lines[line].cents == null);
  if (missing.length) return { why: 'not_available', lines: missing };
  if (w.period.to >= today) return { why: 'not_ended' };
  return null;
}

/**
 * May this period be marked filed now? `today` is the Ontario day; `expectedRevision` is the period's latest revision the person was
 * looking at (0 = never filed), so a second person's filing in between is refused rather than silently amended.
 */
export function checkFiling(input: {
  worksheet: Worksheet; filings: readonly Pick<GstReturnFiling, 'period' | 'periodRevision'>[]; filedOn: string; today: string;
  expectedRevision: number; reason: string; shownLines: string;
}): { ok: true; periodRevision: number } | { ok: false; refusal: FilingRefusal } {
  const { worksheet: w, today } = input;
  const blocked = filingBlock(w, today);
  if (blocked) return { ok: false, refusal: blocked };
  if (input.shownLines !== linesKey(w)) return { ok: false, refusal: { why: 'figures_changed' } };
  if (!isCalendarDate(input.filedOn)) return { ok: false, refusal: { why: 'filed_on_invalid' } };
  if (input.filedOn <= w.period.to) return { ok: false, refusal: { why: 'filed_on_too_early' } };
  if (input.filedOn > today) return { ok: false, refusal: { why: 'filed_on_future' } };
  const now = filingFor(input.filings, w.period);
  if (now.state === 'overlaps') return { ok: false, refusal: { why: 'overlaps', with: now.with[0].period } };
  const current = now.state === 'filed' ? now.latest.periodRevision : 0;
  if (current !== input.expectedRevision) return { ok: false, refusal: { why: 'changed', current } };
  if (current > 0 && !input.reason.trim()) return { ok: false, refusal: { why: 'reason_missing' } };
  if (input.reason.trim().length > 500) return { ok: false, refusal: { why: 'reason_too_long' } };
  return { ok: true, periodRevision: current + 1 };
}

// ── Changed since you filed ─────────────────────────────────────────────────────────────────────────────────────────────

/** What to do about a change, from CRA's rules (§10). `info` = nothing to do; it moved no figure. */
export type ChangeEffect = 'later_return' | 'adjust_filed' | 'ask_accountant' | 'info';
export type ChangeKind =
  | 'sale_added' | 'sale_removed' | 'sale_changed'
  | 'note_added' | 'note_removed' | 'write_off_added' | 'write_off_removed' | 'recovery_added' | 'recovery_removed'
  | 'credit_more' | 'credit_less' | 'earlier_credit_less' | 'answer_added';
export type FilingChange = {
  kind: ChangeKind; effect: ChangeEffect;
  /** Size of the change, always positive (the kind says which way). */
  cents: number;
  invoiceId?: string; invoiceNumber?: string | null; noteNumber?: string | null;
  expenseId?: string; supplier?: string; on?: string;
  /** credit_more: the day it became claimable, the day it lands on a later return, and whether it was held (number missing) when filed. */
  savedOn?: string; landsOn?: string; released?: boolean;
  /** credit_more: the filed return that already carries it as an earlier-period credit, when one does. */
  carriedIn?: WorksheetPeriod;
  /** sale_changed: only the amount before tax moved (line 101), not its GST/HST. */
  baseOnly?: boolean;
};
export type FilingComparison =
  | { state: 'compared'; lines: { line: LineNumber; filed: number; today: number }[]; changes: FilingChange[] }
  | { state: 'unknown'; why: 'lines_not_available' | 'sources_unreadable' };

/**
 * The frozen filing against today's worksheet for the SAME dates: which lines moved, and each source that explains it, with what to
 * do. Compared only when every line can be known today (a "Not available" line could hide a change) and the sources can be read.
 */
export function changedSinceFiled(filed: Pick<GstReturnFiling, 'lines'> & { sources: FiledSources | null }, live: Worksheet, carry: CarryContext): FilingComparison {
  if (!filed.sources) return { state: 'unknown', why: 'sources_unreadable' };
  if (WORKSHEET_LINES.some(line => live.lines[line].cents == null)) return { state: 'unknown', why: 'lines_not_available' };
  const s = filed.sources;
  const lines = WORKSHEET_LINES.filter(line => live.lines[line].cents !== filed.lines[line])
    .map(line => ({ line, filed: filed.lines[line], today: live.lines[line].cents! }));
  const changes: FilingChange[] = [];

  // Sales (101/103): by issue day, so a change here is a record that arrived late, or a registration-date change.
  const filedSales = new Map(s.invoices.map(i => [i.invoiceId, i]));
  const liveSales = new Map(live.parts[101].invoices.map(i => [i.invoiceId, i]));
  for (const [id, i] of liveSales) {
    const was = filedSales.get(id);
    const ref = { invoiceId: id, invoiceNumber: i.invoiceNumber, on: i.issuedOn };
    if (!was) { changes.push({ kind: 'sale_added', effect: 'adjust_filed', cents: i.gstHstCad ?? 0, ...ref }); continue; }
    const delta = (i.gstHstCad ?? 0) - (was.gstHstCad ?? 0);
    const before = (i.beforeTaxCad ?? 0) - (was.beforeTaxCad ?? 0);
    if (delta) changes.push({ kind: 'sale_changed', effect: delta > 0 ? 'adjust_filed' : 'ask_accountant', cents: Math.abs(delta), ...ref });
    else if (before) changes.push({ kind: 'sale_changed', effect: 'adjust_filed', cents: Math.abs(before), baseOnly: true, ...ref });
  }
  for (const [id, i] of filedSales) if (!liveSales.has(id)) {
    changes.push({ kind: 'sale_removed', effect: 'ask_accountant', cents: i.gstHstCad ?? 0, invoiceId: id, invoiceNumber: i.invoiceNumber, on: i.issuedOn });
  }

  // Relief (104/107): each lands by its own date, so only a record that arrived late for a date inside the period moves it.
  const key = (r: { invoiceId: string; on: string; noteId?: string | null }) => `${r.invoiceId}|${r.noteId ?? ''}|${r.on}`;
  const relief = (filedRows: { invoiceId: string; invoiceNumber: string | null; on: string; cents: number; noteId?: string | null; noteNumber?: string | null }[],
    liveRows: { invoiceId: string; invoiceNumber: string | null; on: string; cents: number; noteId?: string; noteNumber?: string | null }[],
    added: ChangeKind, removed: ChangeKind, addedEffect: ChangeEffect, removedEffect: ChangeEffect) => {
    const was = new Map(filedRows.map(r => [key(r), r]));
    const now = new Map(liveRows.map(r => [key(r), r]));
    for (const [k, r] of now) {
      const delta = r.cents - (was.get(k)?.cents ?? 0);
      if (delta) changes.push({ kind: delta > 0 ? added : removed, effect: delta > 0 ? addedEffect : removedEffect, cents: Math.abs(delta), invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, noteNumber: r.noteNumber ?? null, on: r.on });
    }
    for (const [k, r] of was) if (!now.has(k) && r.cents) {
      changes.push({ kind: removed, effect: removedEffect, cents: r.cents, invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, noteNumber: r.noteNumber ?? null, on: r.on });
    }
  };
  // A note dated inside the period but recorded late: s.232(3)(b) names the issue period; CRA says nothing on catching up (§10).
  relief(s.creditNotes, live.parts[107].creditNotes, 'note_added', 'note_removed', 'ask_accountant', 'adjust_filed');
  // A write-off may be deducted in its period "or a subsequent reporting period" (s.231(1)), within four years (s.231(4)).
  relief(s.badDebts, live.parts[107].badDebts, 'write_off_added', 'write_off_removed', 'later_return', 'adjust_filed');
  relief(s.recoveries, live.parts[104].recoveries, 'recovery_added', 'recovery_removed', 'adjust_filed', 'ask_accountant');

  // Credits (106): more = a later return's line 106 (CRA refuses an ITC-only amendment, P-149R); less = over-claimed.
  const filedCreditsBy = new Map(s.credits.map(c => [c.expenseId, c]));
  const liveCredits = new Map(live.parts[106].credits.map(c => [c.expenseId, c]));
  for (const [id, c] of liveCredits) {
    const delta = c.creditCents - (filedCreditsBy.get(id)?.creditCents ?? 0);
    const carriedIn = carry.carriedBy(id);
    if (delta > 0) changes.push({ kind: 'credit_more', effect: 'later_return', cents: delta, expenseId: id, supplier: c.supplier, on: c.incurredOn,
      savedOn: c.savedOn, landsOn: c.savedOn > carry.latestFiledDay ? c.savedOn : carry.latestFiledDay, released: filedCreditsBy.get(id)?.state === 'held',
      ...(carriedIn ? { carriedIn } : {}) });
    else if (delta < 0) changes.push({ kind: 'credit_less', effect: 'adjust_filed', cents: -delta, expenseId: id, supplier: c.supplier, on: c.incurredOn });
  }
  for (const [id, c] of filedCreditsBy) if (!liveCredits.has(id) && c.creditCents > 0) {
    changes.push({ kind: 'credit_less', effect: 'adjust_filed', cents: c.creditCents, expenseId: id, supplier: c.supplier, on: c.incurredOn });
  }
  const liveEarlier = new Map(live.parts[106].earlierCredits.map(c => [c.expenseId, c.cents]));
  for (const c of s.earlierCredits) {
    const delta = c.cents - (liveEarlier.get(c.expenseId) ?? 0);
    if (delta > 0) changes.push({ kind: 'earlier_credit_less', effect: 'adjust_filed', cents: delta, expenseId: c.expenseId, supplier: c.supplier, on: c.incurredOn });
  }

  // A sale that has its GST/HST answer now: it moved no figure by itself (103 counts what the invoice charged), so it is information.
  const stillMissing = new Set(live.unresolved.filter(u => u.kind === 'sale_missing_answer').map(u => u.invoiceId));
  for (const o of s.open) if (o.kind === 'sale_missing_answer' && o.invoiceId && !stillMissing.has(o.invoiceId) && liveSales.has(o.invoiceId)) {
    changes.push({ kind: 'answer_added', effect: 'info', cents: 0, invoiceId: o.invoiceId, invoiceNumber: liveSales.get(o.invoiceId)!.invoiceNumber });
  }

  const order: Record<ChangeEffect, number> = { adjust_filed: 0, ask_accountant: 1, later_return: 2, info: 3 };
  changes.sort((a, b) => order[a.effect] - order[b.effect] || (a.on ?? '').localeCompare(b.on ?? ''));
  return { state: 'compared', lines, changes };
}
