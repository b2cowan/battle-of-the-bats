/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE BANK CHECK — ONE ENGINE FOR BOTH PORTALS (Bank reconciliation R1; plan
 * docs/projects/active/BANK_RECONCILIATION_PLAN.md, asks B1–B12 and drawing asks 1–14, all ruled A 2026-11-04).
 *
 * A treasurer (club) or a coach with money write (team) types a bank statement's END DATE and ENDING BALANCE,
 * ticks the book's lines the statement shows, reaches a Difference of $0.00 and marks the statement checked.
 * This file is the arithmetic and the rules; it knows nothing about where lines come from. The club's source is
 * posted club-book entries in the account's books (R2); the coach's is the settled rows of the team register (R4).
 *
 * ⚖ THE UNIT IS A BANK ACCOUNT (B1, Ask 13), never a book: lines come in already scoped to one account.
 * ⚖ A TICK IS A MARK BESIDE THE MONEY, never on it (architectural decision 1). A mark carries the line AS IT WAS
 *   CHECKED, so "changed since" (B4, Ask 11) is a comparison, and a line that has left the source (a coach season
 *   rolled over) still reads from its mark.
 * ⚖ NOTHING HERE IS KEYED TO A YEAR (B3, B10): no fiscal year, no season. A statement may straddle either. A tick in
 *   a closed fiscal year is allowed (a mark, not money); only the bank-fee helper's date knows the lock
 *   (`bankFeeDate`, B4 + Ask 8).
 * ⚖ $0.00 IS REQUIRED to mark checked (B5). A Stripe payout's gap between deposit and book is a NAMED amount
 *   (`payoutGaps`), never part of the Difference (B2, Ask 7).
 *
 * THE LINE KEY (`line_key` in `bank_check_marks`, mig 436) — stable across reads, unique within an account:
 *   · club book line:     `entry:{accounting_entries.id}`
 *   · coach register row: the register row's own id for a SETTLED row (`money-in-{uuid}`, `dues-payment-{uuid}`,
 *     `expense-{expenseId}-payment-{paymentId}` …; minted once in lib/coach-register-book.ts, verified stable R1).
 *     A SCHEDULED row is never tickable (it has not moved), so its unstable id never reaches a mark.
 *   · automatic Stripe payout: `payout:{po_id}` (its member lines are stamped too, at tick time — payouts are not
 *     stored);
 *   · a line typed into the first check that exists in no book (Ask 3): `typed:{bank_saved_lines.id}` (mig 436
 *     holds the key equal to the row's own id).
 *
 * Pure and client-safe: integer cents, ISO dates compared as strings, no IO, no Date.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type BankDirection = 'in' | 'out';

/** Why a line left the tick list without anyone tapping (B6). */
export type AutoExcludeReason = 'void' | 'pending' | 'same_account_transfer' | 'family_paid_vendor';

/** A book line as its source reads it NOW. */
export interface BankLine {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  direction: BankDirection;
  /** > 0, integer cents. */
  amountCents: number;
  /** posted = the money moved; pending / void never tick (B6). A coach register row: settled = posted. */
  status: 'posted' | 'pending' | 'void';
  label?: string;
  /** Club transfer half: the OTHER half's key. Both halves in this account = never reached the bank (B6). */
  transferPairKey?: string | null;
  /** Coach: a bill a family paid the vendor direct (`RegisterRow.movesCash === false`). */
  familyPaidVendor?: boolean;
  /** A member of an automatic Stripe payout: that payout's key (`payout:{po_id}`). */
  payoutKey?: string | null;
}

/** An automatic Stripe payout (read live, never stored). A manual payout is not passed; its lines tick by hand. */
export interface BankPayout {
  key: string;
  /** The day the money arrives (YYYY-MM-DD): the payout's place on a statement. */
  arrivalDate: string;
  /** Signed cents: + a deposit, − a debit (refunds can outrun payments). */
  amountCents: number;
  label?: string;
}

/** A line saved by the account itself: a checked statement's outstanding list (B10) or the carried list (Ask 12). */
export interface SavedLine {
  key: string;
  date: string;
  direction: BankDirection;
  amountCents: number;
  label?: string;
}

/** The first check's "still outstanding then" (Ask 3): picked from a book (its key) or typed (`typed:{id}`). */
export interface OpeningItem extends SavedLine {
  kind: 'picked' | 'typed';
}

/** A tick: the line as it was when ticked (refreshed when the check is marked checked, and checked again). */
export interface BankMark {
  key: string;
  checkId: string;
  date: string;
  direction: BankDirection;
  amountCents: number;
  /** Set on a payout's member lines: the payout tick that stamped them. */
  payoutKey?: string | null;
}

/** A change a write route stamped on a ticked line (R3/R6), still waiting for "Mark checked again" (Ask 11). */
export interface StampedChange {
  key: string;
  checkId: string;
  changedBy: string | null;
  changedAt: string;
  /** The line was voided or deleted. */
  removed?: boolean;
}

export interface BankCheckRecord {
  id: string;
  statementEndDate: string;
  statementEndingBalanceCents: number;
  status: 'open' | 'checked';
  /** A bank fee or interest line added from this statement's helper (B5): ticks HERE whatever its date (Ask 8). */
  addedLineKeys?: string[];
  /** What was still outstanding when it was marked checked (B10); null while it has never been checked. */
  outstandingSnapshot?: SavedLine[] | null;
}

export interface BankAccountState {
  /** The account's starting point (C1/K1): null until it is set up. */
  setup: { openingDate: string; openingBalanceCents: number } | null;
  /** Live lines: every line now in the account's books (club) or the team's working season (coach), plus any line
   *  a mark on this account names that the source can still read. */
  lines: BankLine[];
  payouts?: BankPayout[];
  openingItems?: OpeningItem[];
  checks: BankCheckRecord[];
  marks: BankMark[];
  /** "Didn't go through the bank" (B6): keys marked out on THIS account. */
  exclusions?: string[];
  /** Ask 12: the closing season's unticked lines, saved at Start next season. */
  carried?: SavedLine[];
  stampedChanges?: StampedChange[];
  /** Keys that belong to ANOTHER account of the same club: a moved book's lines (Ask 13) and lines ticked on
   *  another account. Dropped here unless a mark on this account names them. */
  claimedElsewhere?: Iterable<string>;
}

/** A row of the tick list: one line, or one automatic payout with its members (B2). */
export type TickRow =
  | {
      kind: 'line'; key: string; date: string; direction: BankDirection; amountCents: number; label?: string;
      /** The payout this line belongs to, when the book or its mark says so (kept so a re-mark can keep it). */
      payoutKey?: string | null;
      /** Where the engine read it: the book now, a mark (the source no longer reads it), a saved list, or typed. */
      origin: 'book' | 'mark' | 'saved' | 'carried' | 'opening';
      /** A ticked line that has since been voided: it contributes nothing until the treasurer sorts it out. */
      voidedSinceTick?: boolean;
    }
  | {
      kind: 'payout'; key: string; date: string; direction: BankDirection; amountCents: number; label?: string;
      members: BankLine[]; bookCents: number; gapCents: number;
    };

export interface PayoutGap { key: string; depositCents: number; bookCents: number; gapCents: number }

export interface ChangedLine {
  key: string;
  was: SavedLine;
  /** null = voided or no longer in any book. */
  now: SavedLine | null;
  changedBy: string | null;
  changedAt: string | null;
}

export interface CheckEvaluation {
  checkId: string;
  /** The day the check starts after: the previous statement's end, or the account's starting date. */
  startDate: string;
  startingBalanceCents: number;
  statementEndDate: string;
  statementEndingBalanceCents: number;
  ticked: TickRow[];
  /** Unticked and eligible: what the statement does not (yet) show. Ordered by date (Ask 4). */
  outstanding: TickRow[];
  tickedInCents: number;
  tickedOutCents: number;
  payoutGaps: PayoutGap[];
  payoutGapCents: number;
  /** start + ticked in − ticked out + payout gaps. */
  tickedBalanceCents: number;
  /** statement ending balance − ticked balance. Must be 0 to mark checked (B5). */
  differenceCents: number;
  outstandingInCents: number;
  outstandingOutCents: number;
  /** B6, inside this statement's dates. */
  keptOut: TickRow[];
  keptOutInCents: number;
  keptOutOutCents: number;
  autoExcluded: { row: TickRow; reason: AutoExcludeReason }[];
  /** Lines dated after the statement's end: they wait for the next one (B5). */
  waitingCount: number;
  /** Only on a checked statement (B4). */
  changedSince: ChangedLine[];
}

// ── small pure helpers ───────────────────────────────────────────────────────────────────────

const signed = (direction: BankDirection, cents: number) => (direction === 'in' ? cents : -cents);

function assertCents(n: number, what: string): void {
  if (!Number.isInteger(n)) throw new Error(`bank-check: ${what} must be integer cents, got ${n}`);
}

const byDateThenKey = (a: { date: string; key: string }, b: { date: string; key: string }) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

const isPayoutKey = (key: string) => key.startsWith('payout:');

/** The line fields a saved list, a mark and a changed-since row all carry (label only when there is one). */
const toSaved = (l: SavedLine): SavedLine => ({
  key: l.key, date: l.date, direction: l.direction, amountCents: l.amountCents, ...(l.label ? { label: l.label } : {}),
});

/** A payout as one signed line: its arrival day, deposit or debit. */
const payoutAsSaved = (p: BankPayout): SavedLine => ({
  key: p.key, date: p.arrivalDate, direction: p.amountCents < 0 ? 'out' : 'in', amountCents: Math.abs(p.amountCents),
});

/** Checks in statement order (end date). One account never holds two statements with the same end date. */
export function orderedChecks(state: Pick<BankAccountState, 'checks'>): BankCheckRecord[] {
  return [...state.checks].sort((a, b) => (a.statementEndDate < b.statementEndDate ? -1 : a.statementEndDate > b.statementEndDate ? 1 : 0));
}

/** The latest statement ending before `before` (any date when omitted), optionally only CHECKED ones. */
function lastCheck(
  state: Pick<BankAccountState, 'checks'>, opts: { before?: string; checkedOnly?: boolean } = {},
): BankCheckRecord | null {
  let last: BankCheckRecord | null = null;
  for (const c of orderedChecks(state)) {
    if (opts.before !== undefined && c.statementEndDate >= opts.before) continue;
    if (opts.checkedOnly && c.status !== 'checked') continue;
    last = c;
  }
  return last;
}

/** The latest CHECKED statement — the only one Undo reaches (B4, Ask 9). */
export function latestCheckedCheck(state: Pick<BankAccountState, 'checks'>): BankCheckRecord | null {
  return lastCheck(state, { checkedOnly: true });
}

// ── the evaluation ───────────────────────────────────────────────────────────────────────────

/**
 * Everything one statement shows: its tick list, its band (Statement · Ticked · Difference), what is outstanding,
 * what is kept out, and — on a checked statement — what changed since.
 */
export function evaluateCheck(state: BankAccountState, checkId: string): CheckEvaluation {
  if (!state.setup) throw new Error('bank-check: the account has no starting point yet');
  const check = state.checks.find(c => c.id === checkId);
  if (!check) throw new Error(`bank-check: no check ${checkId}`);
  assertCents(check.statementEndingBalanceCents, 'statement ending balance');

  const prev = lastCheck(state, { before: check.statementEndDate });
  const startDate = prev ? prev.statementEndDate : state.setup.openingDate;
  const startingBalanceCents = prev ? prev.statementEndingBalanceCents : state.setup.openingBalanceCents;
  const endDate = check.statementEndDate;

  // Marks: this check's, and every key ticked on ANY check of this account.
  const marksByKey = new Map<string, BankMark>();
  for (const m of state.marks) marksByKey.set(m.key, m);
  const elsewhere = new Set(state.claimedElsewhere ?? []);
  const isElsewhere = (key: string) => elsewhere.has(key) && !marksByKey.has(key);
  const excluded = new Set(state.exclusions ?? []);
  const added = new Set(check.addedLineKeys ?? []);
  const live = new Map<string, BankLine>();
  for (const l of state.lines) {
    assertCents(l.amountCents, `line ${l.key}`);
    if (isElsewhere(l.key)) continue;
    live.set(l.key, l);
  }
  const payouts = new Map((state.payouts ?? []).map(p => [p.key, p]));

  /* Candidates, by key, first source wins: the book now → a mark → the last check's saved list → the carried
     list → the first check's opening items. A saved copy only stands in for a line the book no longer reads. */
  type Cand = { line: BankLine; origin: Extract<TickRow, { kind: 'line' }>['origin'] };
  const cands = new Map<string, Cand>();
  const put = (line: BankLine, origin: Cand['origin']) => {
    if (cands.has(line.key) || isElsewhere(line.key)) return;
    assertCents(line.amountCents, `line ${line.key}`);
    cands.set(line.key, { line, origin });
  };
  const fromSaved = (s: SavedLine): BankLine => ({ ...s, status: 'posted' });
  for (const l of live.values()) put(l, 'book');
  for (const m of state.marks) {
    if (isPayoutKey(m.key)) continue;
    put({ key: m.key, date: m.date, direction: m.direction, amountCents: m.amountCents, status: 'posted',
      payoutKey: m.payoutKey ?? null }, 'mark');
  }
  const lastChecked = lastCheck(state, { before: endDate, checkedOnly: true });
  for (const s of lastChecked?.outstandingSnapshot ?? []) put(fromSaved(s), 'saved');
  for (const s of state.carried ?? []) put(fromSaved(s), 'carried');
  /* Keys a list has PLACED on this account (the last check's outstanding list, the carried list, the first check's
     opening items): they stay on the tick list even when dated before the account's start — whether or not the
     book still reads them, so the caller need not re-pass the opening items on every later statement. */
  const placed = new Set<string>();
  for (const s of lastChecked?.outstandingSnapshot ?? []) placed.add(s.key);
  for (const s of state.carried ?? []) placed.add(s.key);
  for (const o of state.openingItems ?? []) { placed.add(o.key); put(fromSaved(o), 'opening'); }
  // A ticked line the book has since deleted (a route stamped it `removed`) reads from its mark but counts for nothing.
  const removedKeys = new Set<string>();
  for (const s of state.stampedChanges ?? []) if (s.removed && s.checkId === check.id) removedKeys.add(s.key);

  const inWindow = (date: string) => date > startDate && date <= endDate;
  const ticked: TickRow[] = [];
  const outstanding: TickRow[] = [];
  const keptOut: TickRow[] = [];
  const autoExcluded: { row: TickRow; reason: AutoExcludeReason }[] = [];
  let waitingCount = 0;

  // Payout members are never rows of their own while their payout is known (B2): they ride the payout row.
  const membersOf = new Map<string, BankLine[]>();

  for (const { line, origin } of cands.values()) {
    const mark = marksByKey.get(line.key);
    // A member rides its payout unless it was ticked on its own (a plain mark, e.g. while Stripe could not be read).
    if (line.payoutKey && payouts.has(line.payoutKey) && (!mark || mark.payoutKey === line.payoutKey)) {
      const list = membersOf.get(line.payoutKey) ?? [];
      list.push(line);
      membersOf.set(line.payoutKey, list);
      continue;
    }
    const row: TickRow = { kind: 'line', key: line.key, date: line.date, direction: line.direction,
      amountCents: line.amountCents, label: line.label, origin,
      ...(line.payoutKey ? { payoutKey: line.payoutKey } : {}) };
    if (mark) {
      if (mark.checkId !== check.id) continue; // ticked on another statement
      if (line.status !== 'posted' || (origin === 'mark' && removedKeys.has(line.key))) row.voidedSinceTick = true;
      ticked.push(row);
      continue;
    }
    const auto = autoExcludeReason(line, live);
    if (auto) { if (inWindow(line.date)) autoExcluded.push({ row, reason: auto }); continue; }
    if (excluded.has(line.key)) { if (inWindow(line.date)) keptOut.push(row); continue; }
    // Before the account's start: already through the bank, unless the first check said it was still out (Ask 3).
    if (line.date <= state.setup.openingDate && !placed.has(line.key)) continue;
    if (line.date > endDate && !added.has(line.key)) { waitingCount++; continue; }
    outstanding.push(row);
  }

  const payoutGaps: PayoutGap[] = [];
  for (const p of payouts.values()) {
    assertCents(p.amountCents, `payout ${p.key}`);
    const members = (membersOf.get(p.key) ?? []).filter(m => m.status === 'posted').sort(byDateThenKey);
    const bookCents = members.reduce((s, m) => s + signed(m.direction, m.amountCents), 0);
    const gapCents = p.amountCents - bookCents;
    const row: TickRow = { kind: 'payout', ...payoutAsSaved(p), label: p.label, members, bookCents, gapCents };
    const mark = marksByKey.get(p.key);
    if (mark) {
      if (mark.checkId !== check.id) continue;
      ticked.push(row);
      if (gapCents !== 0) payoutGaps.push({ key: p.key, depositCents: p.amountCents, bookCents, gapCents });
      continue;
    }
    if (p.arrivalDate <= state.setup.openingDate) continue;
    if (p.arrivalDate > endDate) { waitingCount++; continue; }
    outstanding.push(row);
  }

  // The band. A ticked payout counts its BOOK side; its gap is named on its own and added after (Ask 7).
  let tickedInCents = 0, tickedOutCents = 0;
  for (const r of ticked) {
    if (r.kind === 'line' && r.voidedSinceTick) continue;
    const cents = r.kind === 'payout' ? r.bookCents : signed(r.direction, r.amountCents);
    if (cents >= 0) tickedInCents += cents; else tickedOutCents -= cents;
  }
  const payoutGapCents = payoutGaps.reduce((s, g) => s + g.gapCents, 0);
  const tickedBalanceCents = startingBalanceCents + tickedInCents - tickedOutCents + payoutGapCents;
  const sum = (rows: TickRow[], d: BankDirection) =>
    rows.reduce((s, r) => s + (r.direction === d ? r.amountCents : 0), 0);

  ticked.sort(byDateThenKey); outstanding.sort(byDateThenKey); keptOut.sort(byDateThenKey);
  autoExcluded.sort((a, b) => byDateThenKey(a.row, b.row));

  return {
    checkId: check.id, startDate, startingBalanceCents, statementEndDate: endDate,
    statementEndingBalanceCents: check.statementEndingBalanceCents,
    ticked, outstanding, tickedInCents, tickedOutCents, payoutGaps, payoutGapCents, tickedBalanceCents,
    differenceCents: check.statementEndingBalanceCents - tickedBalanceCents,
    outstandingInCents: sum(outstanding, 'in'), outstandingOutCents: sum(outstanding, 'out'),
    keptOut, keptOutInCents: sum(keptOut, 'in'), keptOutOutCents: sum(keptOut, 'out'),
    autoExcluded, waitingCount,
    changedSince: check.status === 'checked' ? changedSince(state, check.id, live, payouts) : [],
  };
}

function autoExcludeReason(line: BankLine, live: Map<string, BankLine>): AutoExcludeReason | null {
  if (line.status === 'void') return 'void';
  if (line.status === 'pending') return 'pending';
  if (line.familyPaidVendor) return 'family_paid_vendor';
  if (line.transferPairKey && live.has(line.transferPairKey)) return 'same_account_transfer';
  return null;
}

/**
 * B4 + Ask 11: a ticked line on a checked statement whose amount, date or direction is not what was checked, or
 * that was voided — found by comparing, and joined with what the write routes stamped (who and when). A stamped
 * change stays listed until "Mark checked again", even if the line was put back.
 */
function changedSince(
  state: BankAccountState, checkId: string, live: Map<string, BankLine>, payouts: Map<string, BankPayout>,
): ChangedLine[] {
  const stamps = new Map<string, StampedChange>();
  for (const s of state.stampedChanges ?? []) {
    if (s.checkId !== checkId) continue;
    const had = stamps.get(s.key);
    if (!had || s.changedAt > had.changedAt) stamps.set(s.key, s);
  }
  const out: ChangedLine[] = [];
  for (const m of state.marks) {
    if (m.checkId !== checkId) continue;
    const was: SavedLine = { key: m.key, date: m.date, direction: m.direction, amountCents: m.amountCents };
    const p = isPayoutKey(m.key) ? payouts.get(m.key) : undefined;
    const l = isPayoutKey(m.key) ? undefined : live.get(m.key);
    const readable = !!(p ?? l);
    const now: SavedLine | null = p ? payoutAsSaved(p) : l && l.status === 'posted' ? toSaved(l) : null;
    const stamp = stamps.get(m.key) ?? null;
    // A line the source no longer reads (a rolled-over season) is NOT a change unless a route stamped it.
    const differs = readable && (!now || now.date !== was.date || now.direction !== was.direction
      || now.amountCents !== was.amountCents);
    if (!differs && !stamp) continue;
    out.push({ key: m.key, was, now, changedBy: stamp?.changedBy ?? null,
      changedAt: stamp?.changedAt ?? null });
  }
  return out.sort((a, b) => byDateThenKey(a.was, b.was));
}

// ── what may happen next ─────────────────────────────────────────────────────────────────────

export type Refusal = { ok: false; reason: string } | { ok: true };

/** Starting a new statement (B3): the account is set up, every statement so far is checked, and the new one ends
 *  after the last one (and after the starting date). */
export function canStartCheck(state: BankAccountState, statementEndDate: string): Refusal {
  if (!state.setup) return { ok: false, reason: 'not_set_up' };
  if (state.checks.some(c => c.status === 'open')) return { ok: false, reason: 'one_is_open' };
  const last = orderedChecks(state).at(-1);
  const floor = last ? last.statementEndDate : state.setup.openingDate;
  if (statementEndDate <= floor) return { ok: false, reason: 'ends_too_early' };
  return { ok: true };
}

/** Mark checked (B5): $0.00, and every earlier statement is checked (after stepping back, they re-check in order). */
export function canMarkChecked(state: BankAccountState, checkId: string): Refusal {
  const check = state.checks.find(c => c.id === checkId);
  if (!check || check.status !== 'open') return { ok: false, reason: 'not_open' };
  if (state.checks.some(c => c.statementEndDate < check.statementEndDate && c.status !== 'checked')) {
    return { ok: false, reason: 'earlier_open' };
  }
  if (evaluateCheck(state, checkId).differenceCents !== 0) return { ok: false, reason: 'not_zero' };
  return { ok: true };
}

/** Undo (B4, Ask 9): the latest CHECKED statement only. It reopens with its ticks kept; the one before then
 *  becomes the latest, so a treasurer can step back one at a time. The reason is the route's to require. */
export function canUndo(state: BankAccountState, checkId: string): Refusal {
  const latest = latestCheckedCheck(state);
  if (!latest || latest.id !== checkId) return { ok: false, reason: 'not_latest' };
  return { ok: true };
}

/** Mark checked again (Ask 11): a checked statement that has changed since, back at $0.00 with today's figures. */
export function canMarkCheckedAgain(state: BankAccountState, checkId: string): Refusal {
  const check = state.checks.find(c => c.id === checkId);
  if (!check || check.status !== 'checked') return { ok: false, reason: 'not_checked' };
  const ev = evaluateCheck(state, checkId);
  if (ev.changedSince.length === 0) return { ok: false, reason: 'nothing_changed' };
  if (ev.differenceCents !== 0) return { ok: false, reason: 'not_zero' };
  return { ok: true };
}

/**
 * What a route writes when it marks a statement checked, or checked again: the outstanding list to keep (B10) and
 * every tick refreshed to the line as it is now (so "changed since" starts from what was just checked).
 */
export function snapshotForMarking(state: BankAccountState, checkId: string): {
  outstandingSnapshot: SavedLine[]; marks: BankMark[];
} {
  const ev = evaluateCheck(state, checkId);
  const outstandingSnapshot: SavedLine[] = [];
  for (const r of ev.outstanding) {
    // A payout not on this statement yet keeps its member lines, so a club whose Stripe read fails next time
    // still sees that money as outstanding, line by line.
    if (r.kind === 'line') outstandingSnapshot.push(toSaved(r));
    else for (const m of r.members) outstandingSnapshot.push(toSaved(m));
  }
  // The COMPLETE set of ticks this statement keeps (a route replaces its marks with this). A line that was voided
  // after it was ticked is dropped — otherwise "Mark checked again" could never clear its amber (Ask 11).
  const marks: BankMark[] = [];
  const kept = new Set<string>();
  for (const r of ev.ticked) {
    if (r.kind === 'line' && r.voidedSinceTick) continue;
    marks.push({ key: r.key, checkId, date: r.date, direction: r.direction, amountCents: r.amountCents,
      ...(r.kind === 'line' && r.payoutKey ? { payoutKey: r.payoutKey } : {}) });
    kept.add(r.key);
    if (r.kind === 'payout') {
      for (const m of r.members) {
        marks.push({ key: m.key, checkId, date: m.date, direction: m.direction, amountCents: m.amountCents, payoutKey: r.key });
        kept.add(m.key);
      }
    }
  }
  // A payout tick whose payout the Stripe read cannot return right now keeps its mark (its members keep theirs above).
  for (const m of state.marks) {
    if (m.checkId === checkId && isPayoutKey(m.key) && !kept.has(m.key)) marks.push({ ...m });
  }
  return { outstandingSnapshot, marks };
}

/** Ticking a payout stamps its members (B2): the marks a route writes for one payout tick. */
export function payoutTickMarks(state: BankAccountState, checkId: string, payoutKey: string): BankMark[] {
  const p = (state.payouts ?? []).find(x => x.key === payoutKey);
  if (!p) throw new Error(`bank-check: no payout ${payoutKey}`);
  const marks: BankMark[] = [{ ...payoutAsSaved(p), checkId }];
  for (const l of state.lines) {
    if (l.payoutKey === payoutKey && l.status === 'posted') {
      marks.push({ key: l.key, checkId, date: l.date, direction: l.direction, amountCents: l.amountCents, payoutKey });
    }
  }
  return marks;
}

/**
 * Ask 12 (amends B10): at Start next season, the closing season's lines that no list will hold once the season
 * stops being read — unticked, not kept out, not auto-excluded, not already on the last check's saved list. The
 * ruling names those dated after the last check; a line back-dated INTO a checked period after that check is the
 * same case (it would otherwise be in nobody's list), so it is carried too.
 */
export function carriedAtRollover(state: BankAccountState, seasonLines: BankLine[]): SavedLine[] {
  const marked = new Set(state.marks.map(m => m.key));
  const excluded = new Set(state.exclusions ?? []);
  const last = latestCheckedCheck(state);
  const saved = new Set((last?.outstandingSnapshot ?? []).map(s => s.key));
  const already = new Set((state.carried ?? []).map(s => s.key));
  const seasonByKey = new Map(seasonLines.map(l => [l.key, l]));
  const openingDate = state.setup?.openingDate ?? '';
  const out: SavedLine[] = [];
  for (const l of seasonLines) {
    if (marked.has(l.key) || excluded.has(l.key) || saved.has(l.key) || already.has(l.key)) continue;
    if (autoExcludeReason(l, seasonByKey)) continue;
    if (l.date <= openingDate) continue;
    out.push(toSaved(l));
  }
  return out.sort(byDateThenKey);
}

/**
 * B4 + Ask 8: the date a bank fee or interest line takes. The statement's end date, unless that day is inside a
 * closed fiscal year (the lock refuses it) — then today, and the line still ticks on the statement it was added
 * from (`addedLineKeys`). Team books are exempt from the lock: pass `booksClosedThrough: null`.
 */
export function bankFeeDate(input: { statementEndDate: string; booksClosedThrough: string | null; today: string }): {
  date: string; redated: boolean;
} {
  const { statementEndDate, booksClosedThrough, today } = input;
  if (booksClosedThrough && statementEndDate <= booksClosedThrough) return { date: today, redated: true };
  return { date: statementEndDate, redated: false };
}
